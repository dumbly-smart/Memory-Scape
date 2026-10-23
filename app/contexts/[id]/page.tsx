'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FollowUpsWidget } from '@/components/FollowUpsWidget';
import { DecisionWidget } from '@/components/DecisionWidget';

type ContextData = {
  id: string;
  type: string;
  label: string;
  memory_count: number;
  resume_memory: { id: string; title: string; content: string; occurred_at: string } | null;
  memories: { id: string; title: string; content: string; occurred_at: string; strength: number; location_label: string | null; is_pinned: boolean }[];
};

export default function ContextPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState('');
  const [context, setContext] = useState<ContextData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { params.then(value => setId(value.id)); }, [params]);
  useEffect(() => {
    if (!id) return;
    let active = true;
    fetch(`/api/contexts/${id}`).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Could not load this context');
      if (active) setContext(body.data as ContextData);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load this context'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="empty" role="status">Loading context…</div>;
  if (error || !context) return <div className="error" role="alert">{error || 'Context not found'}</div>;
  const pageLabel = context.type === 'Person' ? 'Person workspace' : context.type === 'Project' ? 'Project workspace' : `${context.type} context`;
  return <>
    <div className="page-head"><div><div className="eyebrow">{pageLabel.toUpperCase()}</div><h1>{context.label}</h1><p>{context.memory_count} linked memories · Resume a conversation or project from its latest context.</p></div><Link className="button" href="/capture">＋ Capture memory</Link></div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-title"><h2>Resume work</h2><span className="muted">Resume from your most recent memory</span></div>
        {context.resume_memory ? <article className="quick"><b>{context.resume_memory.title}</b><span>{new Date(context.resume_memory.occurred_at).toLocaleString()}</span><p>{context.resume_memory.content || 'No additional notes.'}</p></article> : <div className="empty">Nothing is linked here yet. Capture a memory and add this context.</div>}
      </section>
      <section className="panel"><div className="panel-title"><h2>Quick actions</h2></div>
        <div className="quick-grid"><Link className="quick" href={`/capture?context=${context.id}`}><b>Capture a memory</b><span>Save a new note for {context.label}</span></Link><Link className="quick" href={`/memories?context=${context.id}`}><b>Browse linked memories</b><span>Open the full memory library</span></Link></div>
      </section>
    </div>
    <div style={{ marginTop: 16 }}><FollowUpsWidget contextId={context.id} /></div>
    <div style={{ marginTop: 16 }}><DecisionWidget contextId={context.id} /></div>
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-title"><h2>Recent memories</h2><span className="muted">Showing up to 100</span></div>
      {context.memories.length ? context.memories.map(memory => <article className="memory-row" key={memory.id}><span className="memory-pin">{memory.is_pinned ? '★' : '◷'}</span><div className="memory-row-main"><b>{memory.title}</b><span>{new Date(memory.occurred_at).toLocaleString()} · {memory.location_label ?? 'No place'}</span><p>{memory.content}</p></div><span className="muted">{Math.round(memory.strength * 100)}%</span></article>) : <div className="empty">No memories linked to this context.</div>}
    </section>
  </>;
}
