const RpcClient = require('bitcoind-rpc');
const util = require('util');
const config = require('./config');
const db = require('./db');

const shortDelay = 100;
const longDelay = 10 * 1000;

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

(async () => {
    while (true) {
	const txRes = await db.query('SELECT txid, raw FROM txs WHERE value_in IS NULL');
	for (let x = 0; x < txRes.rows.length; x++) {
	    const txid = txRes.rows[x].txid;
	    const rtx = txRes.rows[x].raw;
	    console.log(txid);
	    if (rtx) {
		const tx = await decodeRawTransaction(rtx);

		// https://en.bitcoin.it/wiki/Weight_units
		console.log((x+1) + ' of ' + txRes.rows.length + ' = ' + ((x/txRes.rows.length) * 100).toFixed(2) + '%');
		console.log('  ', txid, 'size', tx.size, 'vsize', tx.vsize, 'weight', tx.weight)

		// go through the vins and find the value of each output
		let inval = 0n;
		for (let v = 0; v < tx.vin.length; v++) {
		    const vin = tx.vin[v];
		    const vinrtx = await getRawTransaction(vin.txid);
		    const vintx = await decodeRawTransaction(vinrtx);

		    if (vintx) {
			let val = 0;
			for (let w = 0; w < vintx.vout.length; w++) {
			    if (vintx.vout[w].n == vin.vout) {
				val = toInt(vintx.vout[w].value);
				await db.query(
				    'INSERT InTO txos (txid, idx, amount) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
				    [vin.txid, vintx.vout[w].n, val]);

			    }

			}
			inval += val;
			console.log(' ', vin.txid, '+', val.toString());

		    }
		    else
			console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX Didn\'t get a raw transaction');

		}
		// add up outputs
		let outval = 0n;
		for (let v = 0; v < tx.vout.length; v++) {
		    console.log(' ', txid, '-', toInt(tx.vout[v].value).toString());
		    outval += toInt(tx.vout[v].value);

		}
		const fee = inval - outval;

		if (inval > 0)
		    db.query(
			'UPDATE txs SET value_in = $1, value_out = $2, txsize = $3, txvsize = $4, txweight = $5 WHERE txid = $6',
			[inval, outval, tx.size, tx.vsize, tx.weight, txid]);

		console.log('  fee ------------------------------------------------------------ =', fee.toString());
		console.log();
	    
	    }
	    await sleep(shortDelay);

	}
	await sleep(longDelay);

    }

})();
