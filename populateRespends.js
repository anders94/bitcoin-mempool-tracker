const RpcClient = require('bitcoind-rpc');
const util = require('util');
const config = require('./config');
const db = require('./db');

const delay = 10;

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
    const blockRes = await db.query('SELECT id, height, hash FROM blocks ORDER BY created ASC');

    for (let b = 0; b < blockRes.rows.length; b++) {
	console.log(blockRes.rows[b].height, blockRes.rows[b].hash);
	const block = await getBlock(blockRes.rows[b].hash);
	for (let t = 0; t < block.tx.length; t++) {
	    console.log(' ', t, block.tx[t]);
	    const txRaw = await getRawTransaction(block.tx[t]);
	    const tx = await decodeRawTransaction(txRaw);

	    for (let s = 0; s < tx.vin.length; s++) {
		console.log('   ', t, s, tx.vin[s].txid, tx.vin[s].vout);
		const res = await db.query('SELECT * FROM txos WHERE txid = $1 AND idx = $2', [tx.vin[s].txid, tx.vin[s].vout]);
		for (let x = 0; x < res.rows; x++) {
		    // we are respending a txo - see if any of the newly created txos are also in the table 
		    const respends = await db.query('SELECT idx, amount FROM txos WHERE txid = $1', [res.rows[x].txid]);
		    if (respends.rows.length > 0) {
			console.log('UPDATE txos SET spent_in_txid = ' + res.rows[x].txid + ' WHERE txid = ' + tx.vin[s].txid + ' AND idx = ' + tx.vin[s].vout);
			await db.query('UPDATE txos SET spent_in_txid = $1 WHERE txid = $2 AND idx = $3', [res.rows[x].txid, tx.vin[s].txid, tx.vin[s].vout]);

		    }

		}

	    }
	    await sleep(delay);

	}

    }

})();

/*
{
  txid: '39727e8c27f5cf326bb8a0f5c707d2f5a56ac8395b45b456233965bb780b8790',
  hash: '39727e8c27f5cf326bb8a0f5c707d2f5a56ac8395b45b456233965bb780b8790',
  version: 1,
  size: 347,
  vsize: 347,
  weight: 1388,
  locktime: 0,
  vin: [
    {
      txid: 'a736f4c2691b75bc9c41786c0080a06f3e3cb2853cb4407c1c29d5452516a01d',
      vout: 3,
      scriptSig: [Object],
      sequence: 4294967293
    }
  ],
  vout: [
    { value: 0, n: 0, scriptPubKey: [Object] },
    { value: 0.002875, n: 1, scriptPubKey: [Object] },
    { value: 0.002875, n: 2, scriptPubKey: [Object] },
    { value: 0.56786091, n: 3, scriptPubKey: [Object] }
  ]
}

bitcoin_prod=> select * from blocks;
                  id                  | height |                               hash                               |                           previoushash                           |          created           
--------------------------------------+--------+------------------------------------------------------------------+------------------------------------------------------------------+----------------------------
 bc9738c0-e368-448e-a641-5a1128074805 | 841643 | 0000000000000000000286a89124b64069de9d482605d576190367afbd6474cd | 00000000000000000002f046aef6e9d6c21fd45023b5f3b7b9df8bfacbc02076 | 2024-05-01 12:08:55.67124
 c1a3fcf6-f05e-4a95-a299-2fbeb9f7aeab | 841644 | 0000000000000000000058fe1ee4d773ac36fcd83ae31ce55f5746c30bc4895e | 0000000000000000000286a89124b64069de9d482605d576190367afbd6474cd | 2024-05-01 12:27:12.131029
(2 rows)

bitcoin_prod=> select * from txos limit 10;
                               txid                               | idx |  amount  | spent_in_txid 
------------------------------------------------------------------+-----+----------+---------------
 a581238b0946491e9bc1eaa004e986fd7c1839651b43fdccc0ce6f206a4c41ff |   0 | 86022034 | 
 39727e8c27f5cf326bb8a0f5c707d2f5a56ac8395b45b456233965bb780b8790 |   3 | 56786092 | 
 b22b23899a7fbd70c128d3e5d1b0784070a4f5025fe3fbfceccd4ff590131111 |   2 |    75000 | 
 e96225d61b9365aa9ae8f20d06655cc4f8590603802f13c0872e7f8fd3d5cf2c |  44 |  1749330 | 
 e96225d61b9365aa9ae8f20d06655cc4f8590603802f13c0872e7f8fd3d5cf2c | 141 |   779975 | 
 e96225d61b9365aa9ae8f20d06655cc4f8590603802f13c0872e7f8fd3d5cf2c |   8 |  1972456 | 
 e96225d61b9365aa9ae8f20d06655cc4f8590603802f13c0872e7f8fd3d5cf2c | 105 |  1881803 | 
 e96225d61b9365aa9ae8f20d06655cc4f8590603802f13c0872e7f8fd3d5cf2c | 108 |  7165924 | 
 e96225d61b9365aa9ae8f20d06655cc4f8590603802f13c0872e7f8fd3d5cf2c |  95 |   101884 | 
 e96225d61b9365aa9ae8f20d06655cc4f8590603802f13c0872e7f8fd3d5cf2c | 106 |  2463229 | 
(10 rows)




  5341 064ab7342f974feb486e20ef8d05a6ef6176a5699602c10212223a265669f557
    5341 0 0a79f518bc1ccff0ca85c932e3cfb8430d0e60fd60a41cf16c327298e48f5d68 1
  5342 9241033cb60060066819bcf721b9ba9550f40dd8d85b14151361a487d9120aac
    5342 0 67071d7f9dc6954845bf8b6ac2cb48640a78f8dede783ea4c775040b128a5e31 1
  5343 18a0c20d31dc302ae01c46f9827ce2462e1cd0b344da1f86a25207f2cfedbe58
    5343 0 9241033cb60060066819bcf721b9ba9550f40dd8d85b14151361a487d9120aac 1
  5344 3b5889f7ace439053a2f784949a9f52db927176d8796c94b7cc343ea9789b45a
    5344 0 a3b254da298d8d6bb24c0b1d84d1c698e81941fa48fea91ecb952a9ef7da9e22 1
841644 0000000000000000000058fe1ee4d773ac36fcd83ae31ce55f5746c30bc4895e
  0 d6ca33d3b048f42437f62a8a9ae022463fae8d915b4702707939d7a8a0c97ff2
    0 0 undefined undefined
  1 442b33f29640591cefae1281244477d304b166afff639b0dc756c11c167ce3a5
    1 0 d63c6b0c430caacf941dc58e56e3d4ed9ff0fecbaed93b487ee96be3f02c59f0 0
[
  {
    txid: 'd63c6b0c430caacf941dc58e56e3d4ed9ff0fecbaed93b487ee96be3f02c59f0',
    idx: 0,
    amount: '546',
    spent_in_txid: null
  }
]
UPDATE txos SET spent_in_txid = 442b33f29640591cefae1281244477d304b166afff639b0dc756c11c167ce3a5 WHERE txid = d63c6b0c430caacf941dc58e56e3d4ed9ff0fecbaed93b487ee96be3f02c59f0 AND idx = 0
UPDATE txos SET spent_in_txid = $1 WHERE txid = $2 AND idx = $3 [
  '442b33f29640591cefae1281244477d304b166afff639b0dc756c11c167ce3a5',
  'd63c6b0c430caacf941dc58e56e3d4ed9ff0fecbaed93b487ee96be3f02c59f0',
  0
]
    1 1 247a6a780b41ca066bcaa77c8d6b827b25c0e0c4544eb55a5add8a9a9f5ae4a7 606
[
  {
    txid: '247a6a780b41ca066bcaa77c8d6b827b25c0e0c4544eb55a5add8a9a9f5ae4a7',
    idx: 606,
    amount: '330',
    spent_in_txid: null
  }
]
UPDATE txos SET spent_in_txid = 442b33f29640591cefae1281244477d304b166afff639b0dc756c11c167ce3a5 WHERE txid = 247a6a780b41ca066bcaa77c8d6b827b25c0e0c4544eb55a5add8a9a9f5ae4a7 AND idx = 606
UPDATE txos SET spent_in_txid = $1 WHERE txid = $2 AND idx = $3 [
  '442b33f29640591cefae1281244477d304b166afff639b0dc756c11c167ce3a5',
  '247a6a780b41ca066bcaa77c8d6b827b25c0e0c4544eb55a5add8a9a9f5ae4a7',
  606
]
    1 2 8c5fb69293345af8c54f1d8cf5f79f232717c67abed158caaaf140d9ecaa0b32 1409
[
  {
    txid: '8c5fb69293345af8c54f1d8cf5f79f232717c67abed158caaaf140d9ecaa0b32',
    idx: 1409,
    amount: '330',
    spent_in_txid: null
  }
]
UPDATE txos SET spent_in_txid = 442b33f29640591cefae1281244477d304b166afff639b0dc756c11c167ce3a5 WHERE txid = 8c5fb69293345af8c54f1d8cf5f79f232717c67abed158caaaf140d9ecaa0b32 AND idx = 1409
UPDATE txos SET spent_in_txid = $1 WHERE txid = $2 AND idx = $3 [
  '442b33f29640591cefae1281244477d304b166afff639b0dc756c11c167ce3a5',
  '8c5fb69293345af8c54f1d8cf5f79f232717c67abed158caaaf140d9ecaa0b32',
  1409
]
    1 3 7a3911c3772447ffd087181435a61fe5811ef107e1b83cc14868d22997c17af6 3
  2 cbd0feb54ad6feb642a133ad36b4b8999417c7345424b13a1eadd5e489cf1c50
    2 0 a581238b0946491e9bc1eaa004e986fd7c1839651b43fdccc0ce6f206a4c41ff 0
[
  {
    txid: 'a581238b0946491e9bc1eaa004e986fd7c1839651b43fdccc0ce6f206a4c41ff',
    idx: 0,
    amount: '86022034',
    spent_in_txid: null
  }
]
UPDATE txos SET spent_in_txid = cbd0feb54ad6feb642a133ad36b4b8999417c7345424b13a1eadd5e489cf1c50 WHERE txid = a581238b0946491e9bc1eaa004e986fd7c1839651b43fdccc0ce6f206a4c41ff AND idx = 0
UPDATE txos SET spent_in_txid = $1 WHERE txid = $2 AND idx = $3 [
  'cbd0feb54ad6feb642a133ad36b4b8999417c7345424b13a1eadd5e489cf1c50',
  'a581238b0946491e9bc1eaa004e986fd7c1839651b43fdccc0ce6f206a4c41ff',
  0
]
  3 612b1faf383b711ffcc24838fa078207d9a0eef8d46f735c8c78ca91c2fb3703
    3 0 cbd0feb54ad6feb642a133ad36b4b8999417c7345424b13a1eadd5e489cf1c50 0
[
  {
    txid: 'cbd0feb54ad6feb642a133ad36b4b8999417c7345424b13a1eadd5e489cf1c50',
    idx: 0,
    amount: '73356253',
    spent_in_txid: null
  }
]

*/
