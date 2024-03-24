const RpcClient = require('bitcoind-rpc');
const util = require('util');
const config = require('./config');

const delay = 1 * 1000;

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

	}

    }

    // find dropped entries
    const memids = Object.keys(mempool);
    for (let x = 0; x < memids.length; x++) {
	const memid = memids[x];

	if (!txids.find(el => el == memid)) {
	    console.log('dropping', memid);
	    delete mempool[memid];

	}

    }
    console.log();

}

const mempool = {};

(async () => {
    await update;
    await sleep(delay);
    setInterval(update, delay);

})();

