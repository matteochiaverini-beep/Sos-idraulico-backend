import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS richieste (
      id              BIGSERIAL PRIMARY KEY,
      tipo_problema   TEXT NOT NULL,
      urgenza         SMALLINT NOT NULL CHECK (urgenza BETWEEN 1 AND 3),
      descrizione     TEXT,
      media_urls      TEXT[] NOT NULL DEFAULT '{}',
      piano           TEXT,
      accesso         TEXT[] NOT NULL DEFAULT '{}',
      nome            TEXT NOT NULL,
      telefono        TEXT NOT NULL,
      email           TEXT,
      indirizzo       TEXT NOT NULL,
      stato           TEXT NOT NULL DEFAULT 'in_attesa'
                      CHECK (stato IN ('in_attesa','assegnata','in_corso','risolta')),
      creato_il       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE richieste ADD COLUMN IF NOT EXISTS email TEXT;
    CREATE INDEX IF NOT EXISTS idx_richieste_stato     ON richieste (stato);
    CREATE INDEX IF NOT EXISTS idx_richieste_creato_il ON richieste (creato_il DESC);
  `);
}
