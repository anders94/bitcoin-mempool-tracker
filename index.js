const RpcClient = require('bitcoind-rpc');
const util = require('util');
const config = require('./config');

const delay = 100;

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
    const txids = await getMemPool();

    for (let x = 0; x < txids.length; x++) {
	const txid = txids[x];
	const rtx = await getRawTransaction(txid);
	if (rtx) {
	    const tx = await decodeRawTransaction(rtx);

	    // https://en.bitcoin.it/wiki/Weight_units
	    console.log((x+1) + ' of ' + txids.length + ' = ' + ((x/txids.length) * 100).toFixed(2) + '%');

	    console.log(txid, 'size', tx.size, 'vsize', tx.vsize, 'weight', tx.weight)
	    //console.log(util.inspect(tx, {depth: 6}));

	    // go through the vins and find the value of each output
	    let inval = 0n;
	    for (let v = 0; v < tx.vin.length; v++) {
		const vin = tx.vin[v];
		const vinrtx = await getRawTransaction(vin.txid);
		const vintx = await decodeRawTransaction(vinrtx);

		let val = 0;
		for (let w = 0; w < vintx.vout.length; w++) {
		    if (vintx.vout[w].n == vin.vout)
			val = toInt(vintx.vout[w].value);

		}
		inval += val;
		console.log(' ', vin.txid, '+', val.toString());

	    }
	    // add up outputs
	    let outval = 0n;
	    for (let v = 0; v < tx.vout.length; v++) {
		console.log(' ', txid, '-', toInt(tx.vout[v].value).toString());
		outval += toInt(tx.vout[v].value);

	    }
	    const fee = inval - outval;
	    console.log('  fee ------------------------------------------------------------ =', fee.toString());
	    console.log();

	}
	await sleep(delay);

    }

})();
