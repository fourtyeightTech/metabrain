import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { pool } from '../src/lib/server/db';
const db = pool();
try {
  const directory = new URL('../db/', import.meta.url);
  const migrations = (await readdir(directory)).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (!migrations.length) throw new Error('No database migrations found');
  for (const migration of migrations) {
    await db.query(await readFile(new URL(migration, directory), 'utf8'));
    console.log(`Database migration ${migration.slice(0, 3)} applied.`);
  }
} finally { await db.end(); }
