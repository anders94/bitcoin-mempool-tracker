module.exports = {
    rpc: {
	protocol: process.env.RPCPROTOCOL || 'http',
	host: process.env.RPCHOST || 'localhost',
	port: process.env.RPCPORT || 8332,
	user: process.env.RPCUSER || 'user',
	pass: process.env.RPCPASS || 'supersecretpassword'
    }

}
