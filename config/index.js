module.exports = {
    rpc: {
	protocol: process.env.RPCPROTOCOL || 'http',
	host: process.env.RPCHOST || 'localhost',
	port: process.env.RPCPORT || 8332,
	user: process.env.RPCUSER || 'user',
	pass: process.env.RPCPASS || 'supersecretpassword'

    },
    postgres: {
        host: process.env.PGHOST || 'localhost',
        database: process.env.PGDATABASE || 'bitcoin_dev',
        user: process.env.PGUSER || 'bitcoin',
        port: process.env.PGPORT || 5432,
        password: process.env.PGPASSWORD || 'supersecretpassword',
        ssl: false,
        debug: false

    },
    zmq: {
	url: process.env.ZMQURL || 'tcp://127.0.0.1:28332'

    }

}
