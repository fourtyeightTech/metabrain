import { Pool, type QueryResultRow } from 'pg';

export interface Sql {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}
const globals = globalThis as unknown as { trayPool?: Pool; trayReadPool?: Pool };
export function pool(readOnly = false): Pool {
  const key = readOnly ? 'trayReadPool' : 'trayPool';
  if (!globals[key]) {
    const connectionString = readOnly ? process.env.DATABASE_READ_URL || process.env.DATABASE_URL : process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not configured');
    globals[key] = new Pool({ connectionString, max: readOnly ? 3 : 5, idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  }
  return globals[key];
}
export async function getState<T>(db: Sql, key: string): Promise<T | null> {
  return (await db.query<{ value: T }>('SELECT value FROM tray_state WHERE key=$1', [key])).rows[0]?.value ?? null;
}
export async function setState(db: Sql, key: string, value: unknown) {
  await db.query('INSERT INTO tray_state(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', [key, JSON.stringify(value)]);
}
export async function transaction<T>(fn: (db: Sql) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
