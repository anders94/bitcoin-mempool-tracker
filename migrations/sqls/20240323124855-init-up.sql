-- --------------------------------------------------------
-- -- Table: blocks
--
-- Can have multiple blocks at the same height which would
-- suggest a reorg.
-- --------------------------------------------------------

CREATE TABLE blocks (
  id                 UUID            NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  height             INT             NOT NULL,
  hash               TEXT            NOT NULL,
  previoushash       TEXT            NOT NULL,
  created            TIMESTAMP       NOT NULL DEFAULT now()
) WITH (OIDS=FALSE);

-- --------------------------------------------------------
-- -- Table: txs
-- --------------------------------------------------------

CREATE TABLE txs (
  txid               TEXT            NOT NULL UNIQUE,
  mempool_entry      TIMESTAMP,
  mempool_exit       TIMESTAMP,
  block_id           UUID            REFERENCES blocks(id),
  value_in           BIGINT,
  value_out          BIGINT,
  txsize             INT,
  txvsize            INT,
  txweight           INT,
  raw                TEXT
) WITH (OIDS=FALSE);

-- --------------------------------------------------------
-- -- Table: txis - transaction inputs
-- --------------------------------------------------------

CREATE TABLE txis (
  txid               TEXT            NOT NULL,
  idx                INT             NOT NULL,
  spent_in_txid      TEXT            NOT NULL REFERENCES txs(txid)
) WITH (OIDS=FALSE);

-- --------------------------------------------------------
-- -- Table: txos - transaction outputs
-- --------------------------------------------------------

CREATE TABLE txos (
  txid               TEXT            NOT NULL REFERENCES txs(txid),
  idx                INT             NOT NULL,
  amount             BIGINT          NOT NULL
) WITH (OIDS=FALSE);

