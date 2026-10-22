import { Pool } from 'pg';

const globalForPool = globalThis as typeof globalThis & { memoryScapePool?: Pool };
export const pool = globalForPool.memoryScapePool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000 });
if (process.env.NODE_ENV !== 'production') globalForPool.memoryScapePool = pool;
