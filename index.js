const RpcClient = require('bitcoind-rpc');
const zmq = require('zeromq');
const db = require('./db');
const Throttle = require('./throttle');

const sock = zmq.socket('sub');
const config = require('./config');

const rpc = new RpcClient({
    protocol: config.rpc.protocol,
    host: config.rpc.host,
    port: config.rpc.port,
    user: config.rpc.user,
    pass: config.rpc.pass

});

const throttle = new Throttle(6);

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

const decodeRawTransaction = async (tx) => {
    let value;
    await new Promise((resolve) => {
	rpc.decodeRawTransaction(tx, (err, res) => {
	    if (err)
		console.log(err);
	    else
		value = res.result;

	    return resolve();

	});

    });

    return value;

};

const getBlock = async (hash) => {
    let value;
    await new Promise((resolve) => {
	rpc.getBlock(hash, (err, res) => {
	    if (err)
		console.log(err);
	    else
		value = res.result;

	    return resolve();

	});

    });

    return value;

};

const addTx = async (txid) => {
    const txRes = await db.query('SELECT txid FROM txs WHERE txid = $1', [txid]);
    if (txRes.rows.length == 0) {
	const raw = await getRawTransaction(txid);
	const tx = await decodeRawTransaction(raw);
	await db.query(
	    'INSERT INTO txs (txid, raw) VALUES ($1, $2) ON CONFLICT DO NOTHING',
	    [txid, raw]);
	console.log('added', txid);

    }

};

const sequence = async (data) => {
    const hash = data.subarray(0, 32).toString('hex');
    const cmd = data.subarray(32, 33).toString('ascii');

    switch (cmd) {
    case 'A':
	const seq1 = data.readUIntLE(34, 4);
	console.log('adding', hash, seq1);
	await db.query('INSERT INTO txs (txid, mempool_entry) VALUES ($1, now())', [hash]);
	break;
    case 'R':
	const seq2 = data.readUIntLE(34, 4);
	console.log('removing', hash, seq2);
	// TODO: add if we don't already have this one
	await db.query('UPDATE txs SET mempool_exit = now() WHERE txid = $1', [hash]);
	break;
    case 'C':
	console.log('blockhash connected', hash);
	const block1 = await getBlock(hash);

	if (block1) {
	    const res = await db.query(
		'INSERT INTO blocks (height, hash, previoushash) VALUES ($1, $2, $3) RETURNING id',
		[block1.height, block1.hash, block1.previousblockhash]);
	    for (let t = 0; t < block1.tx.length; t++) {
		console.log('update tx', block1.tx[t], 'to', res.rows[0].id);
		await db.query('UPDATE txs SET block_id = $1 WHERE txid = $2', [res.rows[0].id, block1.tx[t]]);

	    }

	}
	else
	    console.log('skipping block', hash, 'no such block');
	break;
    case 'R':
	console.log('blockhash disconnected', hash);
	await db.query('UPDATE txs SET block_id = NULL WHERE block_id = (SELECT id FROM blocks WHERE hash = $1)', [hash]);
	break;
    default:
	console.log('unrecognized command', cmd);

    }

};

const rawtx = async (data) => {
    const tx = await decodeRawTransaction(data.toString('hex'));
    await db.query('UPDATE txs SET raw = $1 WHERE txid = $2', [data.toString('hex'), tx.txid]);

    // record the inputs
    if (tx && tx.vin) {
	for (let t = 0; t < tx.vin.length; t++) {
	    const vin = tx.vin[t];
	    console.log(' ', tx.txid, t + 1, 'of', tx.vin.length, 'destroys', vin.txid, vin.vout);
	    if (vin.txid) {
		// add it if we don't have it
		const inRes = await db.query('SELECT txid FROM txis WHERE txid = $1 AND idx = $2 AND spent_in_txid = $3', [vin.txid, vin.vout, tx.txid]);
		if (inRes.rows.length == 0) {
		    await addTx(vin.txid);
		    await addTx(tx.txid);
		    await db.query('INSERT INTO txis (txid, idx, spent_in_txid) VALUES ($1, $2, $3)', [vin.txid, vin.vout, tx.txid]);

		}

	    }
	    else {
		if (!vin.coinbase) {
		    console.log(vin);
		    process.exit();

		}

	    }

	}

    }
    else
	console.log('skipping transaction', tx.txid, 'no vins');

    // record the outputs
    if (tx && tx.vout) {
	let value_out = 0n;
	for (let t = 0; t < tx.vout.length; t++) {
	    const vout = tx.vout[t];
	    console.log(' ', tx.txid,  t + 1, 'of', tx.vout.length, 'creates', tx.txid, vout.n, 'value', vout.value);
	    value_out += toInt(vout.value);
	    // add it if we don't have it
	    const outRes = await db.query('SELECT txid FROM txos WHERE txid = $1 AND idx = $2', [tx.txid, vout.n]);
	    if (outRes.rows.length == 0) {
		await addTx(tx.txid);
		await db.query('INSERT INTO txos (txid, idx, amount) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [tx.txid, vout.n, toInt(vout.value)]);

	    }

	}
	await db.query('UPDATE txs SET value_out = $2 WHERE txid = $1', [tx.txid, value_out]);

    }
    else
	console.log('skipping transaction', tx.txid, 'no vouts');

};

const processMemPool = async () => {
    const mempool = await getMemPool();
    for (let m = 0; m < mempool.length; m++) {
	console.log('mempool', m + 1, 'of', mempool.length);
	await addTx(mempool[m]);

    }

};

(async () => {
    sock.connect(config.zmq.url);

    sock.on('message', (topic, data) => {
	switch (topic.toString()) {
	case 'sequence':
	    sequence(data);
	    break;
	case 'rawtx':
	    throttle.enqueue(() => rawtx(data));
	    break;
	default:
	    console.log('unknown topic', topic.toString());

	}

    });

    sock.subscribe('rawtx');
    sock.subscribe('sequence');

    processMemPool();

    setInterval(async () => {
	processMemPool()

    }, 5 * 60 * 1000);

})();
