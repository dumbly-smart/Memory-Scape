import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

const schema = z.object({ seedId: z.guid(), depth: z.number().int().min(1).max(3).default(2), threshold: z.number().min(0).max(1).default(0.01), limit: z.number().int().min(1).max(100).default(60) });
type Traversal = { memory_id: string; title: string; activation: number; hop_depth: number; path_ids: string[]; path_edge_ids: string[]; edge_types: string[]; edge_weights: number[]; edge_valences: number[]; strength: number };

export async function POST(request: NextRequest) {
  try {
    const value = schema.parse(await request.json());
    const result = await pool.query<Traversal>(
      `WITH RECURSIVE edge_pool AS (
         SELECT e.*,row_number() OVER(PARTITION BY e.src ORDER BY e.weight DESC,abs(e.valence) DESC,e.dst,e.edge_type) AS source_rank
         FROM memory_edges e
         JOIN memories src ON src.id=e.src AND NOT src.is_sensitive AND src.archived_at IS NULL
         JOIN memories dst ON dst.id=e.dst AND NOT dst.is_sensitive AND dst.archived_at IS NULL
       ), walk(node_id,activation,depth,path_ids,path_edge_ids,edge_types,edge_weights,edge_valences) AS (
         SELECT m.id,1.0::double precision,0,ARRAY[m.id]::uuid[],ARRAY[]::uuid[],ARRAY[]::text[],ARRAY[]::double precision[],ARRAY[]::double precision[]
         FROM memories m WHERE m.id=$1 AND NOT m.is_sensitive AND m.archived_at IS NULL
         UNION ALL
         SELECT dst.id,w.activation*e.weight*(p.valence_base+p.valence_salience*abs(e.valence))*dst.strength,w.depth+1,
           w.path_ids||dst.id,w.path_edge_ids||e.id,w.edge_types||e.edge_type,w.edge_weights||e.weight,w.edge_valences||e.valence
         FROM walk w JOIN edge_pool e ON e.src=w.node_id AND e.source_rank<=12
         JOIN memories dst ON dst.id=e.dst CROSS JOIN algorithm_parameters p
         WHERE p.singleton AND w.depth<$2 AND NOT dst.id=ANY(w.path_ids)
           AND w.activation*e.weight*(p.valence_base+p.valence_salience*abs(e.valence))*dst.strength >= $3
       ), ranked AS (
         SELECT w.*,row_number() OVER(PARTITION BY node_id ORDER BY activation DESC,depth,path_ids::text) AS choice_rank
         FROM walk w WHERE depth>0
       )
       SELECT m.id AS memory_id,m.title,r.activation,r.depth AS hop_depth,r.path_ids,r.path_edge_ids,r.edge_types,r.edge_weights,r.edge_valences,m.strength
       FROM ranked r JOIN memories m ON m.id=r.node_id WHERE r.choice_rank=1
       ORDER BY r.activation DESC,r.depth,m.id LIMIT $4`,
      [value.seedId,value.depth,value.threshold,value.limit],
    );
    if (!result.rows.length) {
      const seed = await pool.query(`SELECT id,title,occurred_at,strength FROM memories WHERE id=$1 AND NOT is_sensitive AND archived_at IS NULL`, [value.seedId]);
      if (!seed.rowCount) return NextResponse.json({ error: 'Seed memory not found or not available for recall' }, { status: 404 });
      return NextResponse.json({ data: { seed: seed.rows[0], nodes: [], edges: [], results: [], limits: { depth: value.depth, nodes: value.limit, perNodeEdges: 12 } } });
    }
    const seed = await pool.query(`SELECT id,title,occurred_at,strength FROM memories WHERE id=$1 AND NOT is_sensitive AND archived_at IS NULL`, [value.seedId]);
    if (!seed.rowCount) return NextResponse.json({ error: 'Seed memory not found or not available for recall' }, { status: 404 });
    const edgeIds = [...new Set(result.rows.flatMap(row => row.path_edge_ids))];
    const edges = edgeIds.length ? (await pool.query('SELECT id,src,dst,edge_type,weight,valence FROM memory_edges WHERE id=ANY($1::uuid[]) ORDER BY id',[edgeIds])).rows : [];
    return NextResponse.json({ data: { seed: seed.rows[0], nodes: result.rows, edges, results: result.rows, limits: { depth: value.depth, nodes: value.limit, perNodeEdges: 12 } } });
  } catch (error) { return jsonError(error); }
}
