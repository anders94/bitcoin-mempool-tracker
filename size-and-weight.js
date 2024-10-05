const RpcClient = require('bitcoind-rpc');
const db = require('./db');
const Throttle = require('./throttle');

const config = require('./config');
const limit = 2000000;

const throttle = new Throttle(8);

const rpc = new RpcClient({
    protocol: config.rpc.protocol,
    host: config.rpc.host,
    port: config.rpc.port,
    user: config.rpc.user,
    pass: config.rpc.pass

});

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
	`SELECT *
         FROM txs 
         WHERE txsize IS NULL AND 
           (
             mempool_entry IS NOT NULL OR
             mempool_seen_at IS NOT NULL OR 
             mempool_unseen_at IS NOT NULL OR 
             mempool_exit IS NOT NULL
           )
         LIMIT ` + limit);

    console.log(res.rows.length, 'transactions');

    for (let i=0; i<res.rows.length; i++) {
	const row = res.rows[i];

	throttle.enqueue(async () => {
	    if (i % 1000 == 0)
		console.log(new Date(), i, '/', res.rows.length, row.txid);
	    const tx = await decodeRawTransaction(row.raw);
	    await db.query('UPDATE txs SET txsize = $1, txvsize = $2, txweight = $3 WHERE txid = $4', [tx.size, tx.vsize, tx.weight, row.txid]);

	});

    }

    const interval = setInterval(async () => {
	if (throttle.isEmpty()) {
	    await db.end();
	    clearInterval(interval);

	}

    }, 1000);

})();
