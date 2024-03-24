const { Client } = require('pg');
const config = require('../config');

client = new Client({host: config.postgres.host,
		     database: config.postgres.database,
		     user: config.postgres.user,
		     password: config.postgres.password});
client.connect();

module.exports = {
    query: (sql, params) => client.query(sql, params),
    end: () => client.end()
};
