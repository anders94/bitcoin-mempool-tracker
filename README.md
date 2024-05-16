bitcoin-mempool-tracker
=======================

Records timing of entry / exit / block inclusion and value / fee information for
transactions as they go through the mempool and potential block inclusion lifecycle.
Data is stored in a PostgreSQL database for later querying.

This project is in support of an MIT project analyzing the Bitcoin fee market.

Prerequisites
-------------
* PostgreSQL
* Node.js
* RPC and ZeroMQ access to a full Bitcoin node

Setup
-----
Install dependancies:
```sh
npm i
```
Set the environment variables described in `config/index.js`.

Usage
-----
```
node .
```

Runs the mempool watcher which connects to the ZeroMQ port (see http://bitcoincoredocs.com/zmq.html)
and records mempool entry / exit for transactions as well as recording blocks.
