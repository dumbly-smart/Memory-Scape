import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

export async function GET() {
  try {
    const [followUps, decisions, fading, freshness] = await Promise.all([
      pool.query(
        `SELECT f.id,f.title,f.description,f.due_at,f.memory_id,m.title AS memory_title,
                f.context_id,c.label AS context_label
         FROM follow_ups f
         LEFT JOIN memories m ON m.id=f.memory_id
         LEFT JOIN contexts c ON c.id=f.context_id
         WHERE f.status='open' AND f.due_at IS NOT NULL AND f.due_at < now()+interval '1 day'
         ORDER BY f.due_at ASC,f.id LIMIT 50`,
      ),
      pool.query(
        `SELECT d.id,d.choice,d.rationale,d.revisit_at,d.memory_id,m.title AS memory_title,
                d.context_id,c.label AS context_label
         FROM decisions d
         LEFT JOIN memories m ON m.id=d.memory_id
         LEFT JOIN contexts c ON c.id=d.context_id
         WHERE d.revisit_at IS NOT NULL AND d.revisit_at < now()+interval '1 day'
         ORDER BY d.revisit_at ASC,d.id LIMIT 50`,
      ),
      pool.query(
        `SELECT memory_id,title,strength,last_strength_at,occurred_at,relevant_contexts,review_priority
         FROM fading_memories_mv ORDER BY review_priority DESC,memory_id LIMIT 12`,
      ),
      pool.query(`SELECT value AS refreshed_at FROM system_metadata WHERE key='fading_view_refreshed_at'`),
    ]);
    return NextResponse.json({ data: {
      dueFollowUps: followUps.rows,
      decisionsToRevisit: decisions.rows,
      fadingMemories: fading.rows,
      fadingRefreshedAt: freshness.rows[0]?.refreshed_at ?? null,
    }, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Daily brief query failed:', error instanceof Error ? error.message : 'unknown error');
    return jsonError(error);
  }
}
