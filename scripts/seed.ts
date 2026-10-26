import { pool } from '../lib/db/pool';
import { seedMemoryCount } from './fresh-buffer-config';

async function main() {
  const count = seedMemoryCount(process.argv.slice(2));
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const existing=await client.query('SELECT count(*)::int n FROM memories');
    if(existing.rows[0].n>0) throw new Error(`Refusing to seed: database already contains ${existing.rows[0].n} memories. Use a clean development database.`);
    await client.query(`
      INSERT INTO contexts(type,label) VALUES
       ('Place','Campus Library'),('Place','Engineering Block'),('Place','Student Cafe'),('Place','Residence'),
       ('Topic','PostgreSQL'),('Topic','Spatial Databases'),('Topic','Algorithms'),('Activity','Study'),('Activity','Team Project'),('Person','Research Group')
      ON CONFLICT(type,label) DO NOTHING;
      INSERT INTO memories(id,title,content,occurred_at,location,location_label,strength,decay_rate,last_strength_at)
      SELECT
        md5('memoryscape-'||g)::uuid,
        (ARRAY['Reviewed database indexing','Worked on a graph assignment','Discussed spatial queries','Met project group','Read recursive SQL notes','Prepared course presentation','Walked between classes','Debugged a transaction','Studied in the library','Planned a research experiment'])[((g-1)%10)+1] || ' · session ' || g,
        'Synthetic demonstration memory '||g||'. No personal data is used. Generated with deterministic spatial clusters around a fictional university campus in Bengaluru.',
        TIMESTAMPTZ '2025-01-01 12:00:00+00' - ((g*37)%2400)*interval '1 hour',
        ST_SetSRID(ST_MakePoint(77.568 + (((g*7919)%1000)/100000.0) + ((g%4)*0.0012),13.021 + (((g*3571)%1000)/100000.0) + (((g/4)%4)*0.0011)),4326)::geography,
        (ARRAY['Campus Library','Engineering Block','Student Cafe','Residence'])[(g%4)+1],
        ((g*37)%100)/100.0,
        0.002 + ((g*13)%60)/10000.0,
        TIMESTAMPTZ '2025-01-01 12:00:00+00' - ((g*31)%700)*interval '1 day'
      FROM generate_series(1,${count}) g;
      INSERT INTO memory_contexts(memory_id,context_id)
      SELECT m.id,c.id FROM memories m JOIN contexts c ON
        (c.type='Topic' AND mod(abs(hashtext(m.id::text)),2)=0) OR
        (c.type='Place' AND c.label=m.location_label) OR
        (c.type='Activity' AND c.label=CASE WHEN mod(abs(hashtext(m.id::text)),4)=0 THEN 'Team Project' ELSE 'Study' END) OR
        (c.type='Person' AND mod(abs(hashtext(m.id::text)),7)=0)
      ON CONFLICT DO NOTHING;
      INSERT INTO memory_edges(src,dst,edge_type,weight,valence)
      SELECT src,dst,'Related topic',0.35+((ordinal*17)%65)/100.0,(((ordinal*11)%201)-100)/100.0
      FROM (SELECT id AS src,lead(id) OVER(ORDER BY occurred_at,id) AS dst,row_number() OVER(ORDER BY id) AS ordinal FROM memories) chain
      WHERE dst IS NOT NULL ON CONFLICT DO NOTHING;
      INSERT INTO memory_edges(src,dst,edge_type,weight,valence)
      SELECT md5('memoryscape-'||(g*20+1))::uuid,md5('memoryscape-'||(g*20+2))::uuid,'Cycle demo',0.6,-0.4 FROM generate_series(0,(${count}/20)-1) g
      UNION ALL SELECT md5('memoryscape-'||(g*20+2))::uuid,md5('memoryscape-'||(g*20+3))::uuid,'Cycle demo',0.6,0.2 FROM generate_series(0,(${count}/20)-1) g
      UNION ALL SELECT md5('memoryscape-'||(g*20+3))::uuid,md5('memoryscape-'||(g*20+1))::uuid,'Cycle demo',0.6,-0.8 FROM generate_series(0,(${count}/20)-1) g
      ON CONFLICT DO NOTHING;
      INSERT INTO memory_edges(src,dst,edge_type,weight,valence)
      SELECT a.id,b.id,CASE WHEN a.location_label=b.location_label THEN 'Same location' ELSE 'Associated with' END,
        0.2+(mod(abs(hashtext(a.id::text)),70))/100.0,(mod(abs(hashtext(b.id::text)),201))/100.0-1
      FROM (SELECT id,location_label,row_number() OVER(ORDER BY id) AS n FROM memories) a
      CROSS JOIN generate_series(1,6) AS hop(delta)
      JOIN (SELECT id,location_label,row_number() OVER(ORDER BY id) AS n FROM memories) b ON b.n=a.n+hop.delta
      WHERE a.location_label=b.location_label ON CONFLICT DO NOTHING;
      ANALYZE memories; ANALYZE memory_edges; ANALYZE memory_contexts;
    `);
    await client.query('REFRESH MATERIALIZED VIEW fading_memories_mv');
    await client.query("UPDATE system_metadata SET value=now()::text WHERE key='fading_view_refreshed_at'");
    await client.query('COMMIT');
    console.log(`Inserted ${count.toLocaleString()} deterministic synthetic memories and related graph/context data.`);
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); await pool.end(); }
}
main().catch(e=>{console.error('Seed failed:',e);process.exitCode=1;});
