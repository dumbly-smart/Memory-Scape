import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../lib/db/pool';

async function main() {
  const sql = await readFile(path.resolve('tests/database/research-recall.sql'), 'utf8');
  await pool.query(sql);
  console.log('Research recall SQL contracts passed and rolled back their fixtures.');
}

main().catch(error => {
  console.error('Research recall SQL contracts failed:', error);
  process.exitCode = 1;
}).finally(() => pool.end());
