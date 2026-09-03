import pg from 'pg';

let pool;

function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not configured');
  pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  return pool;
}

let initPromise;
export async function ensureSchema() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const p = getPool();
    await p.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS trips_updated_at_idx ON trips (updated_at DESC);
    `);
  })();
  return initPromise;
}

export function getDb() {
  return getPool();
}
