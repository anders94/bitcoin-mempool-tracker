const RpcClient = require('bitcoind-rpc');
const util = require('util');
const db = require('./db');
const config = require('./config');

const delay = 1 * 1000;

const rpc = new RpcClient({
    protocol: config.rpc.protocol,
    host: config.rpc.host,
    port: config.rpc.port,
    user: config.rpc.user,
    pass: config.rpc.pass
});

const sleep = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

const toInt = (num) => {
    return BigInt(Math.ceil(num * 100000000));

};

const getMemPool = async () => {
    const res = await new Promise((resolve) => {
	rpc.getRawMemPool((err, res) => {
	    if (err)
		console.log(err);
	    return resolve(res.result);

	});

    });
    return res;

};

const getBestBlockHash = async () => {
    const res = await new Promise((resolve) => {
        rpc.getBestBlockHash((err, res) => {
            if (err)
                console.log(err);
            return resolve(res.result);

        });

    });
    return res;

};

const getBlock = async (hash) => {
    const res = await new Promise((resolve) => {
        rpc.getBlock(hash, 1, (err, res) => {
            if (err)
                console.log(err);
            return resolve(res.result);

        });

    });
    return res;

};

const getRawTransaction = async (txid) => {
    let value;
    await new Promise((resolve) => {
        rpc.getRawTransaction(txid, async (err, res) => {
            if (err)
                console.log(err);
            else
                value = res.result;

            return resolve();
        });

    });

    return value;

};

const updateTip = async () => {
    const hash = await getBestBlockHash();
    const blockRes = await db.query(
        'SELECT * FROM blocks WHERE hash = $1',
        [hash]);

    if (blockRes.rows.length == 0) {
	console.log('adding new block', hash);
        const block = await getBlock(hash);
        const insertRes = await db.query(
            'INSERT INTO blocks (height, hash, previoushash) VALUES ($1, $2, $3) RETURNING id',
            [block.height, hash, block.previousblockhash]);

        if (insertRes.rows.length == 1) {
            for (let x = 0; x < block.tx.length; x++)
                await db.query(
                    'UPDATE txs SET block_id = $1 WHERE txid = $2',
                    [insertRes.rows[0].id, block.tx[x]]);

        }
        else
            console.log('block insert didnt work');

    }
    else
        console.log('tip hasn\'t changed', hash);

};

const update = async () => {
    console.log('loop start');
    const txids = await getMemPool();

    console.log('finding new entries');
    for (let x = 0; x < txids.length; x++) {
	const txid = txids[x];

	if (!mempool[txid]) {
	    console.log('  adding', txid);
	    mempool[txid] = 1;
	    const res = await db.query('SELECT * FROM txs WHERE txid = $1', [txid]);
	    if (res.rows.length == 0) {
		const raw = await getRawTransaction(txid);
		await db.query('INSERT INTO txs (txid, mempool_entry, raw) VALUES ($1, now(), $2)', [txid, raw]);

	    }
	    else
		console.log('  skipping', txid, 'already in db - maybe there was a reorg');

	}

    }

    const memids = Object.keys(mempool);
    console.log('finding dropped entries', memids.length, txids.length);
    for (let x = 0; x < memids.length; x++) {
	if (txids.indexOf(memids[x]) == -1) {
            console.log('  dropping', memids[x]);
	    delete mempool[memids[x]];
	    await db.query('UPDATE txs SET mempool_exit = now() WHERE txid = $1', [memids[x]]);

	}

    }
    console.log('done finding dropped entries');
    console.log();
    console.log('mempool size:', memids.length, '\n');

    await updateTip();
    console.log('loop end');
    console.log();

}

const mempool = {};

(async () => {
    await updateTip();

    const tmp = await getMemPool();

    for (let x = 0; x < tmp.length; x++) {
	console.log('adding', x, 'of', tmp.length, tmp[x]);
	mempool[tmp[x]] = 1;
	const res = await db.query('SELECT raw FROM txs WHERE txid = $1', [tmp[x]]);
	if (res.rows.length == 0 || res.rows[0].raw == '') {
	    const raw = await getRawTransaction(tmp[x]);
	    await db.query(
		'INSERT INTO txs (txid, mempool_entry, raw) VALUES ($1, now(), $2) ON CONFLICT DO NOTHING',
		[tmp[x], raw]);

	}

    }
    console.log('mempool size:', Object.keys(mempool).length, '\n');

    while (true) {
	await update();
	await sleep(delay);

    }

})();
