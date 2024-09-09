const RpcClient = require('bitcoind-rpc');
const db = require('./db');

const limit = 10000000;

const config = require('./config');

const rpc = new RpcClient({
    protocol: config.rpc.protocol,
    host: config.rpc.host,
    port: config.rpc.port,
    user: config.rpc.user,
    pass: config.rpc.pass

});

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

const addTx = async (txid) => {
    const txRes = await db.query('SELECT txid FROM txs WHERE txid = $1', [txid]);
    if (txRes.rows.length == 0) {
	const raw = await getRawTransaction(txid);
	await db.query(
	    'INSERT INTO txs (txid, raw) VALUES ($1, $2) ON CONFLICT DO NOTHING',
	    [txid, raw]);
	console.log('added', txid);

    }

};

(async () => {
    let res = await db.query('SELECT * FROM txs WHERE value_out IS NULL AND raw IS NOT NULL LIMIT ' + limit);

    console.log('Populating', res.rows.length, 'unpopulated value_out fields');

    for (let i=0; i<res.rows.length; i++) {
	const row = res.rows[i];
	const tx = await decodeRawTransaction(row.raw);

	let total = 0;
	for (let y=0; y<tx.vout.length; y++)
	    total += Number(tx.vout[y].value);

	if (i % 100 == 0)
	    console.log(' ', i, row.txid, total);

	await db.query('UPDATE txs SET value_out = $2 WHERE txid = $1', [row.txid, toInt(total)]);

    }

    res = await db.query('SELECT * FROM txs WHERE value_in IS NULL LIMIT ' + limit);
    console.log('Populating', res.rows.length, 'unpopulated value_in fields');

    for (let i=0; i<res.rows.length; i++) {
	const row = res.rows[i];
	const tx = await decodeRawTransaction(row.raw);

	let record = true;
	let total = 0;
	if (tx.coinbase)
	    total = Number(3.125);
	else {
	    for (let y=0; y<tx.vin.length; y++) {
		const txid = tx.vin[y].txid;

		try {
		    const txinRaw = await getRawTransaction(txid);
		    const txin = await decodeRawTransaction(txinRaw);

		    for (let v=0; v<txin.vout.length; v++) {
			if (txin.vout[v] && txin.vout[v].value)
			    total += Number(txin.vout[v].value);

		    }

		}
		catch(e) {
		    console.log('died on', txid, 'vin', y);
		    console.log(tx.vin[y]);
		    console.log(e);
		    record = false;

		}

	    }

	}

	if (total > 0 && record)
	    await db.query('UPDATE txs SET value_in = $2 WHERE txid = $1', [row.txid, toInt(total)]);

	if (i % 100 == 0)
	    console.log(' ', i, row.txid);

    }
/*
bitcoin=> select s.txid, s.idx, (select o.amount from txos o where o.txid = s.spent_in_txid and o.idx = s.idx) from txis s where s.spent_in_txid = '3c8def586fc89169ad3b3fd7bc02f1e67af89f1a3f65eb7a001b6709705182ac';
                               txid                               | idx | amount 
------------------------------------------------------------------+-----+--------
 b4026f6479487b6de0e5b25b8f256ba7d2302ebd1b905351eeb31d31e62caa6b |  33 |       
 b4026f6479487b6de0e5b25b8f256ba7d2302ebd1b905351eeb31d31e62caa6b |  37 |       
 5c0173b2440416269b7ce068251c1c614249127abcc54807868084aefb50e2a7 |   0 |   1200
 93648706ba0ffe0bd0f766da3c4e14df5e942e4ca4b4ca42d3ecbf04bcc09cdc |   2 | 776433
(4 rows)

Time: 0.473 ms
*/

    await db.end();

})();
