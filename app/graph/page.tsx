'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import { ActivationPathComparison } from '@/components/ActivationPathComparison';

type Memory = { id: string; title: string; occurred_at: string; strength: number };
type Edge = { id: string; src: string; dst: string; edge_type: string; weight: number; valence: number };
type Result = {
  memory_id: string;
  title: string;
  activation: number;
  hop_depth: number;
  path_ids: string[];
  path_edge_ids: string[];
  edge_types: string[];
  edge_weights: number[];
  edge_valences: number[];
  strength: number;
};
type GraphData = { seed: Memory; nodes: Result[]; edges: Edge[]; limits: { depth: number; nodes: number; perNodeEdges: number } };

function readableScore(value: number): string {
  return `${Math.max(0, Math.min(1, value)) * 100}%`;
}

export default function GraphPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [seedId, setSeedId] = useState('');
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedEdgeId, setSelectedEdgeId] = useState('');
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
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/associative/subgraph', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seedId: id, depth: hops, threshold: prune, limit: 60 }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? 'Database graph recall failed');
      setSeedId(id);
      setSelectedNodeId(id);
      setSelectedEdgeId('');
      setGraph(value.data as GraphData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Database graph recall failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const inspectNode = useCallback((id: string) => {
    setSelectedNodeId(id);
    setSelectedEdgeId('');
    const network = cy.current;
    const node = network?.getElementById(id);
    if (!network || !node || node.empty()) return;
    network.elements().unselect().removeClass('focus-neighbor');
    node.select();
    node.closedNeighborhood().addClass('focus-neighbor');
    network.animate({ center: { eles: node }, zoom: Math.max(network.zoom(), 0.92) }, { duration: 420, easing: 'ease-out-cubic' });
  }, []);

  useEffect(() => {
    if (!host.current || !graph) return;

    const visibleResults = graph.nodes.filter(node => node.memory_id !== graph.seed.id);
    const elements: ElementDefinition[] = [
      { data: { id: graph.seed.id, label: graph.seed.title, role: 'seed', depth: 0, activation: 1, strength: graph.seed.strength }, position: { x: 0, y: 0 } },
      ...visibleResults.map(node => {
        const layer = visibleResults.filter(candidate => candidate.hop_depth === node.hop_depth);
        const layerIndex = layer.findIndex(candidate => candidate.memory_id === node.memory_id);
        const angle = -Math.PI / 2 + (layerIndex / Math.max(1, layer.length)) * Math.PI * 2;
        const radius = 136 * node.hop_depth;
        return { data: {
          id: node.memory_id,
          label: node.title,
          role: 'recalled',
          depth: node.hop_depth,
          activation: node.activation,
          strength: node.strength,
        }, position: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius } };
      }),
      ...graph.edges.map(edge => ({ data: {
        id: edge.id,
        source: edge.src,
        target: edge.dst,
        label: edge.edge_type,
        weight: edge.weight,
        valence: edge.valence,
        polarity: edge.valence >= 0.35 ? 'positive' : edge.valence <= -0.35 ? 'negative' : 'neutral',
      } })),
    ];

    cy.current?.destroy();
    const network = cytoscape({
      container: host.current,
      elements,
      minZoom: 0.3,
      maxZoom: 2.5,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#70c3a8',
            'border-color': '#a5e3cf',
            'border-width': 1.4,
            'width': 'mapData(activation,0,1,18,42)',
            'height': 'mapData(activation,0,1,18,42)',
            'label': 'data(label)',
            'font-family': 'Inter, ui-sans-serif, system-ui, sans-serif',
            'font-size': 10,
            'font-weight': 600,
            'color': '#f0f6f1',
            'text-outline-color': '#10221f',
            'text-outline-width': 2,
            'text-wrap': 'wrap',
            'text-max-width': '132px',
            'text-halign': 'center',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'text-opacity': 0,
            'opacity': 0.94,
            'overlay-opacity': 0,
            'transition-property': 'background-color, border-color, border-width, width, height, opacity, text-opacity',
            'transition-duration': 180,
          },
        },
        { selector: 'node[depth = 1]', style: { 'background-color': '#61c3a0', 'border-color': '#a1e7cf' } },
        { selector: 'node[depth = 2]', style: { 'background-color': '#79a9e4', 'border-color': '#bdd5f2' } },
        { selector: 'node[depth >= 3]', style: { 'background-color': '#ae96df', 'border-color': '#d2c3f0' } },
        {
          selector: 'node[role = "seed"]',
          style: {
            'background-color': '#e4aa67',
            'border-color': '#ffe0ae',
            'border-width': 2.5,
            'width': 48,
            'height': 48,
            'font-size': 11,
            'text-opacity': 1,
            'z-index': 50,
          },
        },
        { selector: 'node:selected', style: { 'border-color': '#ffffff', 'border-width': 3, 'text-opacity': 0, 'z-index': 100, 'opacity': 1 } },
        { selector: 'node.is-hovered', style: { 'border-color': '#ffffff', 'border-width': 3, 'text-opacity': 1, 'z-index': 100, 'opacity': 1 } },
        { selector: 'node.focus-neighbor', style: { 'text-opacity': 0, 'opacity': 1 } },
        {
          selector: 'edge',
          style: {
            'width': 'mapData(weight,0,1,1,3.8)',
            'line-color': '#6e8880',
            'target-arrow-color': '#819b91',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.82,
            'curve-style': 'bezier',
            'opacity': 0.38,
            'label': 'data(label)',
            'font-family': 'Inter, ui-sans-serif, system-ui, sans-serif',
            'font-size': 8,
            'font-weight': 600,
            'color': '#ecf3ee',
            'text-outline-color': '#10221f',
            'text-outline-width': 2,
            'text-rotation': 'autorotate',
            'text-opacity': 0,
            'overlay-opacity': 0,
          },
        },
        { selector: 'edge[polarity = "positive"]', style: { 'line-color': '#57c7a2', 'target-arrow-color': '#57c7a2' } },
        { selector: 'edge[polarity = "negative"]', style: { 'line-color': '#dd8c84', 'target-arrow-color': '#dd8c84', 'line-style': 'dashed' } },
        { selector: 'edge.activation-path', style: { 'line-color': '#f0b56e', 'target-arrow-color': '#f0b56e', 'width': 3.4, 'opacity': 0.95, 'text-opacity': 0, 'z-index': 20 } },
        { selector: 'edge.focus-neighbor', style: { 'opacity': 0.9, 'text-opacity': 0 } },
        { selector: 'edge.is-hovered', style: { 'line-color': '#ffffff', 'target-arrow-color': '#ffffff', 'width': 4, 'opacity': 1, 'text-opacity': 1, 'z-index': 90 } },
        { selector: 'edge:selected', style: { 'line-color': '#ffffff', 'target-arrow-color': '#ffffff', 'width': 4, 'opacity': 1, 'text-opacity': 1, 'z-index': 80 } },
      ],
      layout: {
        name: 'cose',
        fit: true,
        padding: 82,
        randomize: false,
        nodeRepulsion: node => node.data('role') === 'seed' ? 15000 : 6200 + Number(node.data('activation')) * 6800,
        nodeOverlap: 16,
        idealEdgeLength: edge => edge.data('weight') >= 0.7 ? 118 : 142,
        edgeElasticity: 92,
        nestingFactor: 1.18,
        gravity: 0.16,
        numIter: 900,
        initialTemp: 190,
        coolingFactor: 0.96,
        minTemp: 1,
        animate: true,
        animationDuration: 1050,
        animationEasing: 'ease-out-cubic',
      },
    });
    cy.current = network;

    for (const result of visibleResults) {
      for (const edgeId of result.path_edge_ids) network.getElementById(edgeId).addClass('activation-path');
    }
    const seedNode = network.getElementById(graph.seed.id);
    seedNode.select();
    seedNode.closedNeighborhood().addClass('focus-neighbor');

    network.on('tap', 'node', event => inspectNode(event.target.id()));
    network.on('tap', 'edge', event => {
      network.elements().unselect().removeClass('focus-neighbor');
      event.target.select();
      event.target.addClass('focus-neighbor');
      setSelectedNodeId('');
      setSelectedEdgeId(event.target.id());
    });
    network.on('tap', event => {
      if (event.target === network) {
        network.elements().unselect().removeClass('focus-neighbor');
        setSelectedNodeId('');
        setSelectedEdgeId('');
      }
    });
    network.on('mouseover', 'node', event => event.target.addClass('is-hovered'));
    network.on('mouseout', 'node', event => event.target.removeClass('is-hovered'));
    network.on('mouseover', 'edge', event => event.target.addClass('is-hovered'));
    network.on('mouseout', 'edge', event => event.target.removeClass('is-hovered'));

    const refitOnResize = () => {
      window.requestAnimationFrame(() => {
        if (cy.current !== network) return;
        network.resize();
        network.fit(network.elements(), 72);
      });
    };
    window.addEventListener('resize', refitOnResize);

    return () => {
      window.removeEventListener('resize', refitOnResize);
      network.destroy();
      if (cy.current === network) cy.current = null;
    };
  }, [graph, inspectNode]);

  async function changeDepth(next: number) {
    setDepth(next);
    if (seedId) await recall(seedId, next, threshold);
  }

  async function changeThreshold(next: number) {
    if (!Number.isFinite(next)) return;
    const bounded = Math.max(0, Math.min(1, next));
    setThreshold(bounded);
    if (seedId) await recall(seedId, depth, bounded);
  }

  const selectedResult = graph?.nodes.find(node => node.memory_id === selectedNodeId);
  const selectedNode = graph && selectedNodeId
    ? selectedNodeId === graph.seed.id
      ? { id: graph.seed.id, title: graph.seed.title, strength: graph.seed.strength, activation: 1, hop_depth: 0, edge_types: [], edge_weights: [], edge_valences: [] }
      : selectedResult ? { ...selectedResult, id: selectedResult.memory_id } : null
    : null;
  const selectedEdge = graph?.edges.find(edge => edge.id === selectedEdgeId);

  return <>
    <div className="page-head">
      <div>
        <div className="eyebrow">POSTGRESQL WITH RECURSIVE · BOUNDED SPREADING ACTIVATION</div>
        <h1>Associative graph</h1>
        <p>Follow the strongest memory paths. Choose a node to inspect it, then explore outward from there.</p>
      </div>
    </div>

    <div className="toolbar graph-toolbar">
      <select aria-label="Seed memory" value={seedId} onChange={event => { const id = event.target.value; setSeedId(id); setGraph(null); setSelectedNodeId(''); setSelectedEdgeId(''); }}>
        <option value="">Choose a recent memory…</option>
        {memories.map(memory => <option key={memory.id} value={memory.id}>{memory.title}</option>)}
      </select>
      <label className="muted">Hops <select aria-label="Hops" value={depth} onChange={event => void changeDepth(Number(event.target.value))}>{[1, 2, 3].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="muted">Prune below <input aria-label="Activation pruning threshold" className="input" style={{ width: 85, minWidth: 0 }} type="number" min="0" max="1" step=".01" value={threshold} onChange={event => void changeThreshold(Number(event.target.value))} /></label>
      <button className="button" disabled={!seedId || busy} onClick={() => void recall(seedId)}>{busy ? 'Calculating…' : 'Spread activation'}</button>
    </div>

    {error && <div className="error" role="alert">{error}</div>}

    <div className="graph-workspace">
      <section className="graph-canvas graph-canvas--network" aria-label="Associative memory network">
        <div ref={host} className="graph-cytoscape" />
        {graph && <>
          <div className="graph-stage-heading">
            <span className="graph-stage-kicker">SPREADING ACTIVATION</span>
            <span className="graph-stage-count">{graph.nodes.filter(node => node.memory_id !== graph.seed.id).length} memories · {graph.edges.length} links</span>
          </div>
          <div className="graph-key" aria-label="Network legend">
            <span><i className="graph-key-seed" /> Seed</span>
            <span><i className="graph-key-hop graph-key-hop--one" /> 1 hop</span>
            <span><i className="graph-key-hop graph-key-hop--two" /> 2 hops</span>
            <span><i className="graph-key-hop graph-key-hop--three" /> 3 hops</span>
            <span><i className="graph-key-link" /> Positive link</span>
            <span><i className="graph-key-link graph-key-link--negative" /> Negative link</span>
          </div>
          <div className="graph-stage-tools"><span>Drag to arrange</span><span>Scroll to zoom</span><button className="graph-fit-button" onClick={() => cy.current?.fit(undefined, 90)}>Fit network</button></div>
        </>}
        {busy && <div className="graph-loading" role="status">Following memory pathways<span>···</span></div>}
        {!graph && !busy && <div className="graph-empty-state"><span className="graph-empty-orbit">✳</span><b>Start with a memory</b><span>PostgreSQL will trace its strongest associations up to {depth} hops.</span></div>}
      </section>

      <aside className="graph-inspector">
        <section className="panel graph-detail-panel" aria-label="Selected memory">
          <div className="panel-title"><h2>{selectedEdge ? 'Selected connection' : 'Selected memory'}</h2></div>
          {selectedEdge ? <>
            <h3 className="graph-selected-title">{selectedEdge.edge_type}</h3>
            <p className="graph-detail-copy">{selectedEdge.valence < 0 ? 'Emotionally difficult association' : 'Positive or neutral association'} · {selectedEdge.valence.toFixed(2)} valence</p>
            <div className="graph-detail-stats"><span>Weight <b>{selectedEdge.weight.toFixed(2)}</b></span><span>Direction <b>→</b></span></div>
          </> : selectedNode ? <>
            <span className="graph-current-seed">{selectedNode.id === graph?.seed.id ? `Current seed · ${selectedNode.title}` : `${'hop_depth' in selectedNode ? selectedNode.hop_depth : 0} hops · activation ${'activation' in selectedNode ? selectedNode.activation.toFixed(4) : '1.0000'}`}</span>
            <h3 className="graph-selected-title">{selectedNode.title}</h3>
            <div className="graph-detail-stats">
              <span>Strength <b>{selectedNode.strength.toFixed(2)}</b></span>
              {'activation' in selectedNode && <span>Activation <b>{readableScore(selectedNode.activation)}</b></span>}
            </div>
            {'edge_types' in selectedNode && selectedNode.edge_types.length > 0 && <div className="graph-path-explanation">
              <span className="graph-detail-label">STRONGEST PATH</span>
              <b>{selectedNode.edge_types.join('  →  ')}</b>
              <span>Weights {selectedNode.edge_weights.map(value => value.toFixed(2)).join(' × ')} · valence {selectedNode.edge_valences.map(value => value.toFixed(1)).join(', ')}</span>
            </div>}
            {selectedNode.id !== graph?.seed.id && <button className="button graph-explore-button" onClick={() => void recall(selectedNode.id)} disabled={busy}>Explore from this memory</button>}
          </> : <div className="graph-selection-empty">Select a node or a link to inspect its recall evidence.</div>}
        </section>

        <section className="panel graph-ranking-panel">
          <div className="panel-title"><div><span className="graph-detail-label">DATABASE RANKING</span><h2>Strongest activations</h2></div><span className="graph-rank-count">{graph?.nodes.filter(node => node.memory_id !== graph.seed.id).length ?? 0}</span></div>
          {graph?.nodes.filter(node => node.memory_id !== graph.seed.id).map((result, index) => <article className={`graph-result ${selectedNodeId === result.memory_id ? 'is-current' : ''}`} key={result.memory_id}>
            <button className="graph-result-select" aria-label={`Inspect ${result.title}`} onClick={() => inspectNode(result.memory_id)}>
              <span className="graph-result-rank">{String(index + 1).padStart(2, '0')}</span>
              <span className="graph-result-main"><b>{result.title}</b><span>{result.hop_depth} hops · {result.activation.toFixed(4)} activation</span><i><em style={{ width: readableScore(result.activation) }} /></i></span>
            </button>
            {graph.seed.id !== result.memory_id && <ActivationPathComparison seedId={graph.seed.id} targetId={result.memory_id} depth={depth} threshold={threshold} />}
          </article>)}
          {graph && graph.nodes.filter(node => node.memory_id !== graph.seed.id).length === 0 && <div className="graph-selection-empty">No memories passed this threshold. Lower the pruning value or choose another seed.</div>}
          {!graph && <div className="graph-selection-empty">Your ranked memories will appear here with their strongest SQL-derived paths.</div>}
        </section>
      </aside>
    </div>

    <div className="algorithm-note graph-formula">A′ = A × edge weight × ({formula.base.toFixed(2)} + {formula.salience.toFixed(2)} × |valence|) × target strength. PostgreSQL handles activation, pruning, cycle prevention, path ranking, and the three-hop bound. Both positive and negative valence remain visible as recall cues.</div>
  </>;
}
