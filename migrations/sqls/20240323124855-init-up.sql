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
  created            TIMESTAMP       NOT NULL
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
  bytes              INT
) WITH (OIDS=FALSE);

-- --------------------------------------------------------
-- -- Table: txos
-- --------------------------------------------------------

CREATE TABLE txos (
  txid               TEXT            NOT NULL,
  idx                INT             NOT NULL,
  amount             BIGINT          NOT NULL,
  spent_in_txid      TEXT            REFERENCES txs(txid),
  CONSTRAINT pk_txos_txid_idx PRIMARY KEY (txid, idx)
) WITH (OIDS=FALSE);
