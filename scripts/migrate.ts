import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../lib/db/pool';

async function main() {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir = path.resolve('database/migrations');
  for (const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()) {
    const present = await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name]);
    if (present.rowCount) continue;
    await pool.query(await readFile(path.join(dir,name),'utf8'));
    await pool.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
    console.log(`Applied ${name}`);
  }
  await pool.query("SELECT cron.schedule('memoryscape-daily-decay','17 2 * * *', $job$SELECT apply_memory_decay(now());$job$)");
  await pool.query("SELECT cron.schedule('memoryscape-hourly-review-refresh','37 * * * *', $job$SELECT refresh_fading_memories();$job$)");
  console.log('pg_cron jobs registered');
}
main().catch(error=>{console.error('Migration failed:',error);process.exitCode=1;}).finally(()=>pool.end());
