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
* RPC access to a full Bitcoin node

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

Starts the mempool watcher - this gathers all the transaction IDs in the mempool creating
a row per record. As new transaction IDs are added to the mempool, their id and the time
at which they were sensed is recorded. As transactions are removed from the mempool
(either because they are too old or they get included in a block) their mompool exit
time are recorded. As blocks are added to the chain, their time is also added to the
database. Keep in mind more than one block at the same height me be added to the
database in the event of a reorg.

```
node populate
```

Starts the populate script - this rounds out the information in the database by looking
up all transactions that don't have value information and adds that and output data. This
is useful to get a complete picture of the fee market at the moment a transaction is
added to the mempool. Additionally, transactions that become included in blocks are
eligable for respend so respend speed can also be tracked.
