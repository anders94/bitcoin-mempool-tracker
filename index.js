const RpcClient = require('bitcoind-rpc');
const util = require('util');
const db = require('./db');
const config = require('./config');

const delay = 5 * 1000;

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

const update = async () => {
    const txids = await getMemPool();

    // find new entries
    for (let x = 0; x < txids.length; x++) {
	const txid = txids[x];

	if (!mempool[txid]) {
	    console.log('adding', txid);
	    mempool[txid] = 1;
	    const res = await db.query('SELECT * FROM txs WHERE txid = $1', [txid]);
	    if (res.rows.length == 0)
		await db.query('INSERT INTO txs (txid, mempool_entry) VALUES ($1, now())', [txid]);
	    else
		console.log('skipping', txid, 'already in db - maybe there was a reorg');

	}

    }

    // find dropped entries
    const memids = Object.keys(mempool);
    for (let x = 0; x < memids.length; x++) {
	const memid = memids[x];

	if (!txids.find(el => el == memid)) {
	    console.log('dropping', memid);
	    delete mempool[memid];
	    const res = await db.query('UPDATE txs SET mempool_exit = now() WHERE txid = $1', [memid]);

	}

    }
    console.log('mempool size:', memids.length, '\n');

}

const mempool = {};

(async () => {
    const tmp = await getMemPool();
    for (let x = 0; x < tmp.length; x++) {
	mempool[tmp[x]] = 1;
	await db.query('INSERT INTO txs (txid) VALUES ($1) ON CONFLICT DO NOTHING', [tmp[x]]);

    }
    console.log('mempool size:', Object.keys(mempool).length, '\n');

    setInterval(update, delay);

})();
