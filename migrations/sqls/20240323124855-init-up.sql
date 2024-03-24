-- --------------------------------------------------------
-- -- Table: txs
-- --------------------------------------------------------
CREATE TABLE txs (
  txid               TEXT            NOT NULL UNIQUE,
  mempool_entry      TIMESTAMP,
  mempool_exit       TIMESTAMP,
  block_entry        TIMESTAMP,
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
