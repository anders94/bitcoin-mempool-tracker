const RpcClient = require('bitcoind-rpc');
const db = require('./db');
const Throttle = require('./throttle');

const config = require('./config');

const throttle = new Throttle(8);

const rpc1 = new RpcClient({
    protocol: config.rpc.protocol,
    host: config.rpc.host,
    port: config.rpc.port,
    user: config.rpc.user,
    pass: config.rpc.pass

});

const rpc2 = new RpcClient({
    protocol: config.rpc.protocol,
    host: '10.20.2.8',
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
	rpc1.decodeRawTransaction(tx, (err, res) => {
	    if (err)
		console.log(err);
	    else
		value = res.result;

	    return resolve();

	});

    });

    return value;

};

const getRawTransaction = async (txid) => {
    let value;
    await new Promise((resolve) => {
        rpc2.getRawTransaction(txid, async (err, res) => {
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
         WHERE value_in IS NULL
           AND (
             mempool_entry IS NOT NULL
             OR mempool_seen_at IS NOT NULL
             OR mempool_unseen_at IS NOT NULL
             OR mempool_exit IS NOT NULL
           )`
    );

    console.log(res.rows.length, 'transactions');

    let ts = new Date();
    for (let i=0; i<res.rows.length; i++) {
	const row = res.rows[i];

	throttle.enqueue(async () => {
	    if (i % 1000 == 0) {
		console.log('vin', new Date(), i, 'of', res.rows.length, Number(i / res.rows.length * 100).toFixed(4) + '%', row.txid, Number(new Date().getTime() - ts.getTime())/1000, 'seconds per 1000');
		ts = new Date();

	    }

	    const raw = await db.query('SELECT raw FROM txs WHERE txid = $1', [row.txid]);
	    const tx = await decodeRawTransaction(raw.rows[0].raw);
	    let total = 0n;
	    for (let v=0; v<tx.vin.length; v++) {
		let found = false;
		const vin = tx.vin[v];

		if (vin.coinbase) {
		    total = toInt('3.125');
		}
		else {
		    const inrawRes = await db.query('SELECT raw FROM txs WHERE txid = $1', [vin.txid]);
		    let inraw;
		    if (inrawRes.rows.length < 1)
			inraw = await getRawTransaction(vin.txid);
		    else
			inraw = inrawRes.rows[0].raw;
		    if (!inraw) {
			console.log('No raw transaction for ' + vin.txid);
			process.exit();

		    }
		    const intx = await decodeRawTransaction(inraw);

		    for (let c=0; c<intx.vout.length; c++) {
			if (vin.vout == intx.vout[c].n) {
			    total += toInt(intx.vout[c].value);
			    found = true;

			}

		    }
		    if (!found) {
			console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAA')
			process.exit();

		    }

		}

	    }
	    if (total < 1) {
		console.log('total', total);
		process.exit();

	    }
	    console.log('UPDATE txs SET value_in = ' + total + ' WHERE txid = ' + row.txid);
	    await db.query('UPDATE txs SET value_in = $1 WHERE txid = $2', [total, row.txid]);

	});

    }

    const interval = setInterval(async () => {
	if (throttle.isEmpty()) {
	    clearInterval(interval);
	    setTimeout(async() => {
		await db.end();

	    }, 60 * 1000);

	}

    }, 1 * 1000);

})();
