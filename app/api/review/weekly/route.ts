import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

export async function GET() {
  try {
    const result = await pool.query(
      `WITH memory_items AS (
         SELECT 'memory'::text AS kind,m.id,m.title,m.content AS description,m.occurred_at,NULL::timestamptz AS due_at,
           m.strength,greatest(coalesce(f.review_priority,0),CASE WHEN m.is_pinned THEN 1.0 WHEN m.occurred_at >= now()-interval '7 days' THEN 0.75 ELSE 0 END)::double precision AS review_priority,
           array_remove(ARRAY[CASE WHEN m.is_pinned THEN 'Pinned' END,CASE WHEN m.occurred_at >= now()-interval '7 days' THEN 'Recent' END,CASE WHEN f.memory_id IS NOT NULL THEN 'Fading' END],NULL) AS reasons,
           m.id AS memory_id,NULL::text AS context_label
         FROM memories m LEFT JOIN fading_memories_mv f ON f.memory_id=m.id
         LEFT JOIN review_actions a ON a.memory_id=m.id
         WHERE NOT m.is_sensitive AND m.archived_at IS NULL
           AND (m.is_pinned OR m.occurred_at >= now()-interval '7 days' OR f.memory_id IS NOT NULL)
           AND (a.id IS NULL OR (coalesce(a.snoozed_until,'-infinity'::timestamptz) <= now() AND NOT (a.action IN ('keep','dismiss','archive') AND a.actioned_at >= now()-interval '7 days')))
       ), follow_up_items AS (
         SELECT 'follow_up'::text AS kind,f.id,f.title,f.description,f.created_at AS occurred_at,f.due_at,
           NULL::double precision AS strength,
           CASE WHEN f.due_at < now() THEN 1.0 ELSE 0.8 END::double precision AS review_priority,
           ARRAY[CASE WHEN f.due_at < now() THEN 'Overdue follow-up' ELSE 'Due soon' END]::text[] AS reasons,
           f.memory_id,c.label AS context_label
         FROM follow_ups f LEFT JOIN contexts c ON c.id=f.context_id LEFT JOIN review_actions a ON a.follow_up_id=f.id
         WHERE f.status='open' AND f.due_at IS NOT NULL AND f.due_at < now()+interval '7 days'
           AND (a.id IS NULL OR (coalesce(a.snoozed_until,'-infinity'::timestamptz) <= now() AND NOT (a.action IN ('keep','dismiss','archive') AND a.actioned_at >= now()-interval '7 days')))
       ), ranked AS (
         SELECT items.*,row_number() OVER(PARTITION BY kind ORDER BY review_priority DESC,due_at NULLS LAST,occurred_at DESC,id) AS category_rank
         FROM (SELECT * FROM memory_items UNION ALL SELECT * FROM follow_up_items) items
       )
       SELECT kind,id,title,description,occurred_at,due_at,strength,review_priority,reasons,memory_id,context_label
       FROM ranked WHERE category_rank <= 20 ORDER BY review_priority DESC,due_at NULLS LAST,occurred_at DESC,id`,
    );
    return NextResponse.json({ data: result.rows, generatedAt: new Date().toISOString(), windowDays: 7 });
  } catch (error) {
    console.error('Weekly review query failed:', error instanceof Error ? error.message : 'unknown error');
    return jsonError(error);
  }
}
