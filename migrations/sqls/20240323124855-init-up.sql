-- --------------------------------------------------------
-- -- Table: txs
-- --------------------------------------------------------

CREATE TABLE txs (
  txid               TEXT            NOT NULL UNIQUE,
  mempool_date       TIMESTAMP,
  block_date         TIMESTAMP,
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
  amount             INT             NOT NULL,
  spend_date         TIMESTAMP,
  CONSTRAINT pk_txos_txid_idx PRIMARY KEY (txid, idx)
) WITH (OIDS=FALSE);
