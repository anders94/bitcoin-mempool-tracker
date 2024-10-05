const RpcClient = require('bitcoind-rpc');
const db = require('./db');
const Throttle = require('./throttle');

const config = require('./config');

const throttle = new Throttle(16);

const rpc = new RpcClient({
    protocol: config.rpc.protocol,
    host: config.rpc.host,
    port: config.rpc.port,
    user: config.rpc.user,
    pass: config.rpc.pass

});

const toInt = (num) => {
    return BigInt(Math.ceil(Number(num) * 100000000));

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
    let res = await db.query(
	`SELECT txid
         FROM txs 
         WHERE value_out IS NULL`
    );

    console.log(res.rows.length, 'transactions');

    let ts = new Date();
    for (let i=0; i<res.rows.length; i++) {
	const row = res.rows[i];

	throttle.enqueue(async () => {
	    if (i % 1000 == 0) {
		console.log('vout', new Date(), i, '/', res.rows.length, Number(i/res.rows.length*100).toFixed(4) + '%', row.txid, Number(new Date().getTime() - ts.getTime())/1000, 'seconds per 1000');
		ts = new Date();

	    }
	    const raw = await db.query('SELECT raw FROM txs WHERE txid = $1', [row.txid]);
	    const tx = await decodeRawTransaction(raw.rows[0].raw);
	    let total = 0n;
	    for (let v=0; v<tx.vout.length; v++) {
		const vout = tx.vout[v];
		total += toInt(vout.value);

	    }
	    //console.log('UPDATE txs SET value_out = ' + total + ' WHERE txid = ' + row.txid);
	    await db.query('UPDATE txs SET value_out = $1 WHERE txid = $2', [total, row.txid]);

	});

    }

    const interval = setInterval(async () => {
	if (throttle.isEmpty()) {
	    await db.end();
	    clearInterval(interval);

	}

    }, 1000);

})();
