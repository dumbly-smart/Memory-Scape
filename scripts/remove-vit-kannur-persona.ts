import { pool } from '../lib/db/pool';

const datasetKey = 'vit-kannur-student-v1';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT dataset_key FROM synthetic_datasets WHERE dataset_key=$1 FOR UPDATE', [datasetKey]);
    const removed = await client.query(
      `DELETE FROM memories m
       USING synthetic_dataset_memories dm
       WHERE dm.dataset_key=$1 AND dm.memory_id=m.id`,
      [datasetKey],
    );
    await client.query('DELETE FROM synthetic_datasets WHERE dataset_key=$1', [datasetKey]);
    await client.query('SELECT refresh_fading_memories()');
    await client.query('COMMIT');
    console.log(`Removed ${removed.rowCount ?? 0} memories owned by ${datasetKey}. Shared contexts and all other memories were preserved.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Persona dataset removal failed:', error);
  process.exitCode = 1;
});
