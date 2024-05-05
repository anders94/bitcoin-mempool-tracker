const RpcClient = require('bitcoind-rpc');
const util = require('util');
const config = require('./config');
const db = require('./db');

const delay = 1;

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

(async () => {
    const txsRes = await db.query('SELECT txid, raw FROM txs');

    for (let t = 0; t < txsRes.rows.length; t++) {
	const tx = txsRes.rows[t];
	console.log(t + 1, 'of', txsRes.rows.length, tx.txid);
	const dtx = await decodeRawTransaction(tx.raw);

	// record the inputs
	if (dtx && dtx.vin)
	    for (let d = 0; d < dtx.vin.length; d++) {
		const vin = dtx.vin[d];
		console.log(' ', d + 1, 'of', dtx.vin.length, 'destroys', vin.txid, vin.vout);
		// add it if we don't have it
		const inRes = await db.query('SELECT txid FROM txis WHERE txid = $1 AND idx = $2', [vin.txid, vin.vout]);
		if (inRes.rows.length == 0)
		    await db.query('INSERT INTO txis (txid, idx, spent_in_txid) VALUES ($1, $2, $3)', [vin.txid, vin.vout, dtx.txid]);

		await sleep(delay);

	    }
	else
	    console.log('skipping transaction', dtx, 'no vins');

	// record the outputs
	if (dtx && dtx.vout)
	    for (let d = 0; d < dtx.vout.length; d++) {
		const vout = dtx.vout[d];
		console.log(' ', d + 1, 'of', dtx.vout.length, 'creates', dtx.txid, vout.n, 'value', vout.value);
		// add it if we don't have it
		const outRes = await db.query('SELECT txid FROM txos WHERE txid = $1 AND idx = $2', [dtx.txid, vout.n]);
		if (outRes.rows.length == 0)
		    await db.query('INSERT INTO txos (txid, idx, amount) VALUES ($1, $2, $3)', [dtx.txid, vout.n, toInt(vout.value)]);

		await sleep(delay);

	    }
	else
	    console.log('skipping transaction', dtx, 'no vouts');

    }

})();
