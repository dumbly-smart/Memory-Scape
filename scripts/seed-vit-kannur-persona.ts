import { createHash } from 'node:crypto';
import { pool } from '../lib/db/pool';
import { buildVitKannurPersona, type PersonaMemory } from './vit-kannur-persona';

function deterministicId(key: string): string {
  // PostgreSQL UUID accepts the standard hyphenated form; MD5 is used only to
  // create stable fixture IDs, never for authentication or security.
  const hex = createHash('md5').update(key).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function memoryId(datasetKey: string, key: string): string {
  return deterministicId(`memoryscape:${datasetKey}:${key}`);
}

function toMemoryRow(memory: PersonaMemory, datasetKey: string, longitude: number, latitude: number) {
  return {
    id: memoryId(datasetKey, memory.key),
    key: memory.key,
    title: memory.title,
    content: memory.content,
    occurredAt: memory.occurredAt,
    locationKey: memory.locationKey,
    longitude,
    latitude,
    strength: memory.strength,
    decayRate: memory.decayRate,
  };
}

async function main() {
  const dataset = buildVitKannurPersona();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO synthetic_datasets(dataset_key,dataset_version,label,description,metadata)
       VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(dataset_key) DO NOTHING`,
      [dataset.key, dataset.version, dataset.name, dataset.description, JSON.stringify({
        privacy: 'fully fictional; no real student or personal data',
        dateRange: ['2024-07-04', '2026-10-23'],
        locationPrecision: 'approximate city/campus anchors with no residential address',
        memoryCount: dataset.memories.length,
        contextCount: dataset.contexts.length,
        edgeCount: dataset.edges.length,
      })],
    );
    const installed = await client.query<{ dataset_version: number; installed_memories: number }>(
      `SELECT d.dataset_version,
              (SELECT count(*)::int FROM synthetic_dataset_memories dm WHERE dm.dataset_key=d.dataset_key) AS installed_memories
       FROM synthetic_datasets d WHERE d.dataset_key=$1 FOR UPDATE`,
      [dataset.key],
    );
    if (!installed.rowCount) throw new Error('Dataset registry was not created. Apply database migrations first.');
    if (installed.rows[0].dataset_version !== dataset.version) {
      throw new Error(`Dataset ${dataset.key} version ${installed.rows[0].dataset_version} is installed; this seed provides version ${dataset.version}.`);
    }
    if (installed.rows[0].installed_memories > 0) {
      await client.query('COMMIT');
      console.log(`Dataset ${dataset.key} is already installed (${installed.rows[0].installed_memories} memories); no changes made.`);
      return;
    }

    await client.query(
      `INSERT INTO contexts(type,label)
       SELECT x.type,x.label FROM jsonb_to_recordset($1::jsonb) AS x(type text,label text)
       ON CONFLICT(type,label) DO NOTHING`,
      [JSON.stringify(dataset.contexts.map(({ type, label }) => ({ type, label })))],
    );

    const contextIds = await client.query<{ key: string; id: string }>(
      `SELECT requested.key,c.id
       FROM jsonb_to_recordset($1::jsonb) AS requested(key text,type text,label text)
       JOIN contexts c ON c.type=requested.type AND c.label=requested.label`,
      [JSON.stringify(dataset.contexts)],
    );
    const contextIdByKey = new Map(contextIds.rows.map(({ key, id }) => [key, id]));
    if (contextIdByKey.size !== dataset.contexts.length) throw new Error('One or more persona contexts could not be resolved.');

    const rows = dataset.memories.map((memory) => {
      const location = dataset.locations[memory.locationKey];
      if (!location) throw new Error(`Missing location ${memory.locationKey} for ${memory.key}.`);
      return toMemoryRow(memory, dataset.key, location.longitude, location.latitude);
    });
    await client.query(
      `INSERT INTO memories(id,title,content,occurred_at,location,location_label,strength,decay_rate,last_strength_at)
       SELECT x.id,x.title,x.content,x.occurred_at,
              ST_SetSRID(ST_MakePoint(x.longitude,x.latitude),4326)::geography,
              x.location_label,x.strength,x.decay_rate,now()
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id uuid,title text,content text,occurred_at timestamptz,
         longitude double precision,latitude double precision,strength double precision,decay_rate double precision,
         location_label text
       )`,
      [JSON.stringify(rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        occurred_at: row.occurredAt,
        longitude: row.longitude,
        latitude: row.latitude,
        strength: row.strength,
        decay_rate: row.decayRate,
        location_label: dataset.locations[row.locationKey].label,
      })))],
    );

    await client.query(
      `INSERT INTO synthetic_dataset_memories(dataset_key,memory_id)
       SELECT $1,x.id FROM jsonb_to_recordset($2::jsonb) AS x(id uuid)`,
      [dataset.key, JSON.stringify(rows.map(({ id }) => ({ id })))],
    );

    const memoryContextRows = dataset.memories.flatMap((memory) => memory.contexts.map((contextKey) => ({
      memoryId: memoryId(dataset.key, memory.key),
      contextId: contextIdByKey.get(contextKey),
    })));
    if (memoryContextRows.some((row) => !row.contextId)) throw new Error('A memory references an unknown persona context.');
    await client.query(
      `INSERT INTO memory_contexts(memory_id,context_id)
       SELECT x.memory_id,x.context_id FROM jsonb_to_recordset($1::jsonb) AS x(memory_id uuid,context_id uuid)
       ON CONFLICT DO NOTHING`,
      [JSON.stringify(memoryContextRows.map(({ memoryId, contextId }) => ({ memory_id: memoryId, context_id: contextId })))],
    );

    const edgeRows = dataset.edges.map((edge) => ({
      src: memoryId(dataset.key, edge.source),
      dst: memoryId(dataset.key, edge.target),
      edge_type: edge.type,
      weight: edge.weight,
      valence: edge.valence,
    }));
    await client.query(
      `INSERT INTO memory_edges(src,dst,edge_type,weight,valence)
       SELECT x.src,x.dst,x.edge_type,x.weight,x.valence
       FROM jsonb_to_recordset($1::jsonb) AS x(src uuid,dst uuid,edge_type text,weight double precision,valence double precision)
       ON CONFLICT(src,dst,edge_type) DO NOTHING`,
      [JSON.stringify(edgeRows)],
    );

    await client.query('ANALYZE memories');
    await client.query('ANALYZE memory_edges');
    await client.query('ANALYZE memory_contexts');
    await client.query('SELECT refresh_fading_memories()');
    await client.query('COMMIT');
    console.log(`Installed ${dataset.memories.length} fictional VIT–Kannur memories, ${dataset.contexts.length} contexts and ${dataset.edges.length} directed associations.`);
    console.log(`Dataset key: ${dataset.key}; event range: 2024-07 to 2026-10; existing memories were preserved.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Persona dataset seed failed:', error);
  process.exitCode = 1;
});
