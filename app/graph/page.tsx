'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';

type Memory = { id: string; title: string; occurred_at: string; strength: number };
type Edge = { id: string; src: string; dst: string; edge_type: string; weight: number; valence: number };
type Result = { memory_id: string; title: string; activation: number; hop_depth: number; path_ids: string[]; path_edge_ids: string[]; edge_types: string[]; edge_weights: number[]; edge_valences: number[]; strength: number };
type GraphData = { seed: Memory; nodes: Result[]; edges: Edge[]; limits: { depth: number; nodes: number; perNodeEdges: number } };

export default function GraphPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [seedId, setSeedId] = useState('');
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [depth, setDepth] = useState(2);
  const [threshold, setThreshold] = useState(0.01);
  const [formula, setFormula] = useState({ base: 0.75, salience: 0.25 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const controls = useRef({ depth, threshold });
  controls.current = { depth, threshold };

  useEffect(() => {
    Promise.all([fetch('/api/memories?limit=100'), fetch('/api/settings/algorithms')]).then(async ([memoryResponse, settingsResponse]) => {
      const memoryResult = await memoryResponse.json();
      const settings = await settingsResponse.json();
      if (!memoryResponse.ok || !settingsResponse.ok) throw new Error('Could not load memories or algorithm settings');
      setMemories(memoryResult.data as Memory[]);
      setFormula({ base: settings.data.valenceBase, salience: settings.data.valenceSalience });
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load graph inputs'));
  }, []);

  const recall = useCallback(async (id: string, hops = controls.current.depth, prune = controls.current.threshold) => {
    if (!id) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/associative/subgraph', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seedId: id, depth: hops, threshold: prune, limit: 60 }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? 'Database graph recall failed');
      setSeedId(id); setGraph(value.data as GraphData);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Database graph recall failed'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    if (!host.current || !graph) return;
    const elements: ElementDefinition[] = [
      { data: { id: graph.seed.id, label: graph.seed.title, role: 'seed' } },
      ...graph.nodes.map(node => ({ data: { id: node.memory_id, label: node.title, role: 'recalled' } })),
      ...graph.edges.map(edge => ({ data: { id: edge.id, source: edge.src, target: edge.dst, label: edge.edge_type, weight: edge.weight, valence: edge.valence } })),
    ];
    cy.current?.destroy();
    cy.current = cytoscape({ container: host.current, elements, minZoom: 0.2, maxZoom: 3,
      style: [
        { selector: 'node', style: { 'background-color': '#629071', label: 'data(label)', 'font-size': '9px', color: '#34453b', 'text-wrap': 'wrap', 'text-max-width': '100px', width: 22, height: 22 } },
        { selector: 'node[role = "seed"]', style: { 'background-color': '#c27d40', width: 34, height: 34, 'font-size': '11px' } },
        { selector: 'edge', style: { width: 'mapData(weight,0,1,1,5)', 'line-color': '#b9c9bd', 'target-arrow-color': '#8eaa96', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', 'font-size': '7px', color: '#66746b', 'text-background-color': '#fff', 'text-background-opacity': 0.85 } },
        { selector: ':selected', style: { 'border-width': 3, 'border-color': '#d69b5f' } },
      ], layout: { name: 'cose', animate: true, animationDuration: 350 },
    });
    for (const node of graph.nodes) for (let index = 0; index < node.path_edge_ids.length; index++) cy.current.getElementById(node.path_edge_ids[index]).addClass('activation-path');
    cy.current.style().selector('edge.activation-path').style({ 'line-color': '#c27d40', 'target-arrow-color': '#c27d40', width: 4 }).update();
    cy.current.on('tap', 'node', event => { const id = event.target.id(); if (id !== graph.seed.id) void recall(id); });
    return () => cy.current?.destroy();
  }, [graph, recall]);

  async function changeDepth(next: number) { setDepth(next); if (seedId) await recall(seedId, next, threshold); }
  async function changeThreshold(next: number) { setThreshold(next); if (seedId) await recall(seedId, depth, next); }

  return <>
    <div className="page-head"><div><div className="eyebrow">POSTGRESQL WITH RECURSIVE · BOUNDED SPREADING ACTIVATION</div><h1>Associative graph</h1><p>Choose a seed; PostgreSQL returns a bounded, explainable neighborhood. Select a node to recenter exploration.</p></div></div>
    <div className="toolbar" style={{ flexWrap: 'wrap' }}>
      <select aria-label="Seed memory" value={seedId} onChange={event => { const id = event.target.value; setSeedId(id); setGraph(null); }}><option value="">Choose a recent memory…</option>{memories.map(memory => <option key={memory.id} value={memory.id}>{memory.title}</option>)}</select>
      <label className="muted">Hops <select aria-label="Hops" value={depth} onChange={event => void changeDepth(Number(event.target.value))}>{[1,2,3].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="muted">Prune below <input aria-label="Activation pruning threshold" className="input" style={{ width: 85, minWidth: 0 }} type="number" min="0" max="1" step=".01" value={threshold} onChange={event => void changeThreshold(Number(event.target.value))} /></label>
      <button className="button" disabled={!seedId || busy} onClick={() => void recall(seedId)}>{busy ? 'Calculating…' : 'Spread activation'}</button>
    </div>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="dashboard-grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(260px,.8fr)' }}>
      <div className="graph-canvas" aria-label="Seed centered associative subgraph"><div ref={host} />{!graph && <div className="empty">Choose a memory and explore its neighborhood.</div>}</div>
      <section className="panel"><div className="panel-title"><h2>Activation ranking</h2><span className="muted">{graph?.nodes.length ?? 0} recalled · max 60</span></div>
        {graph?.nodes.map(result => <button className="result-card" key={result.memory_id} onClick={() => void recall(result.memory_id)} style={{ display: 'block', textAlign: 'left', width: '100%', cursor: 'pointer' }}>
          <b>{result.title}</b><span>{result.hop_depth} hops · activation {result.activation.toFixed(4)} · strength {result.strength.toFixed(2)}</span>
          <div className="algorithm-note">Path: {result.edge_types.join(' → ')}<br />Weights {result.edge_weights.map(value => value.toFixed(2)).join(' × ')} · valence {result.edge_valences.map(value => value.toFixed(1)).join(', ')}</div>
        </button>)}
        {graph && graph.nodes.length === 0 && <div className="empty">No associated memories passed the pruning threshold.</div>}
        {!graph && !error && <div className="empty">The SQL traversal runs only after selecting a seed.</div>}
      </section>
    </div>
    <div className="algorithm-note">A′ = A × edge weight × ({formula.base.toFixed(2)} + {formula.salience.toFixed(2)} × |valence|) × target strength. SQL caps depth at 3, ranks strongest paths, prunes weak paths, prevents cycles, limits each node to its 12 strongest outgoing edges, and returns at most 60 recalled nodes. Negative valence remains an interpretable recall cue.</div>
  </>;
}
