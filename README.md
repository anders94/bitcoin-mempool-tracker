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

Detail
------
Transactions are recorded in the `txs` table. Inputs to transactions are recorded in the `txis` table
while outputs are recorded in the `txos` table. A transaction output can become a transaction input
which would represent a respend and in this case will be recorded in both tables. The `txis` table
has a `spent_in_txid` column which records the transaction id of the spending transaction but does
not contain the `amount` column that the `txos` table has.

There are two possible ways a transaction is added to the `txs` table, when a new transaction is pushed
to the application via ZeroMQ and when a new transaction is noticed after being pulled via an RPC call.
Pushed transactions populate the `mempool_entry` and `mempool_exit` columns whereas pulled transactions
populate the `mempool_seen_at` and `mempool_unseen_at` columns. The `mempool_entry` and `mempool_exit`
columns will always be more accurate than `mempool_seen_at` and `mempool_unseen_at`.

When the application starts, most of the transactions will come from pulling the contents of the mempool
via RPC call. Mempool entry time is not known for these transactions so the `mempool_entry` column will
be empty. As the system runs, transaction entry and exit should be pushed to the system first so these
transactions will have the more accurate `mempool_entry` and `mempool_exit` columns populated.
