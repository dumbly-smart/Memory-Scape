# Associative spreading activation

The `associative_recall` SQL function is a `WITH RECURSIVE` traversal over directed `memory_edges`. The seed starts at configurable activation (default 1). Every hop calculates `A_next = A_current × edge_weight × (0.75 + 0.25 × abs(edge_valence)) × target_memory_strength`.

Both positive and negative salient valence therefore preserve cue strength; signed valence remains in the returned explanation. Paths below the threshold are excluded inside the recursive term. Traversal depth is clamped to 0–3. A UUID path array prevents revisiting a node within a path. If several paths reach one memory, `row_number` deterministically chooses maximum activation, then fewer hops, then lexical UUID path. Returned edge types, weights, valences, and node arrays explain the winning path. Coefficients are engineering choices, not experimentally established constants.

## Alternate path comparison

Migration 013 adds `associative_recall_paths(seed,target,depth,threshold,limit)`. It returns up to 50 simple paths for one target, each ranked by final activation descending, then hop count, UUID path, and edge IDs. `step_activations` includes the initial cue and each post-edge score; the API attaches memory titles for display. The graph view lets users compare up to five alternatives. This helps explain convergence and ranking behavior without moving graph traversal into TypeScript.

## Ablation and synthetic calibration

`npm run research:evaluate -- --seed=497` runs the production SQL against a deterministic eight-memory labeled fixture inside an always-rolled-back transaction. It compares baseline with edge-weight, target-strength, valence-salience, and one-hop ablations; applies one-, seven-, and thirty-day temporal decay through the production `apply_memory_decay` function; varies pruning threshold and route radius; sweeps valence salience and threshold against known relevant IDs; and measures fixed-seed graph-edge removal, location noise, and missing locations. It writes actual precision, recall, F1, reciprocal rank, candidate counts, top activation, and client-observed query latency to `docs/evaluation/research/RESULTS.json` and `.md`.

Calibration chooses the highest synthetic F1, then reciprocal rank, then lower threshold and lower salience. Latency is reported but does not select coefficients. This is a deterministic engineering benchmark over a small fixture, not evidence of biological values or cognitive validity. Run `RESEARCH_REPETITIONS=5 npm run research:evaluate -- --seed=<uint32>` to reproduce; all fixture changes, including temporary algorithm coefficient updates, roll back before files are written.
