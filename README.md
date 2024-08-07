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
has a `spent_in_txid` column which records the transaction id of the spending transaction wheras the
`txos` table contains an `amount` column.

The ways a transaction is added to the `txs` table include:
* A new transaction is pushed to the mempool via publication through ZeroMQ
* A new transaction is found in the mempool via dumping the mempool through the RPC
* An existing transaction is referenced by a mempool transaction input

Pushed transactions populate the `mempool_entry` and `mempool_exit` columns whereas pulled transactions
populate the `mempool_seen_at` and `mempool_unseen_at` columns. Transactions with no `mempool_*`
information were not seen in the mempool and were added in the process of filling out inputs. Use
`mempool_seen_at` and `mempool_unseen_at` primarily. If `mempool_entry` or `mempool_exit` is populated,
use that instead because that will be more accurate.

Notes
-----
Dump data to CSV files with:
```
\copy (select * from txs) to 'txs.csv' with csv delimiter ',' header
\copy (select * from txis) to 'txis.csv' with csv delimiter ',' header
\copy (select * from txos) to 'txos.csv' with csv delimiter ',' header
\copy (select * from blocks) to 'blocks2.csv' with csv delimiter ',' header
```
