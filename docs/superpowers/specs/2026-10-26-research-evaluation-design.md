# MemoryScape Research Evaluation Extensions

## Intent

Add research-grade evaluation and retrieval capabilities to the PostgreSQL-native recall engines. The work should let a reviewer reproduce algorithm ablations, parameter sweeps, and controlled robustness tests on known synthetic ground truth, while also adding spatiotemporal retrieval and richer associative path explanations.

## Goals

- Measure precision, recall, F1, reciprocal rank, candidate count, and query time for deterministic labeled synthetic tasks.
- Compare associative recall with edge-weight, target-strength, valence, temporal-decay, and depth factors ablated; sweep configured activation/pruning parameters.
- Test recall under reproducible location noise/missingness and edge removal.
- Add a database function and API for route corridor retrieval constrained by an event-time interval.
- Return multiple valid activation paths for a target, ranked by activation with deterministic tie-breaking, and make them inspectable from the graph UI.
- Save machine-readable measurements and a readable report with environment and explicit synthetic-only limitations.

## Non-goals

- No ML, embedding, vector database, or claim that synthetic calibration estimates human cognition.
- No mutations to the persistent seed dataset during evaluation.
- No replacement of existing recall semantics or existing benchmark artifacts.
- No human-study results or fabricated performance claims.

## Constraints

- PostgreSQL performs spatial filtering, recursive traversal, path scoring, and ranking.
- Experiment fixtures are inserted and mutated inside a transaction that is always rolled back.
- User data is never used as ground truth; labels are explicit fixture IDs.
- Route distance is measured in PostGIS geography meters; event-time filtering uses half-open UTC intervals.
- Bound recursion to three hops and bound alternate paths returned per target.
- Keep current API input validation, parameterized SQL, and TypeScript conventions.

## Approaches

1. **Recommended: transactional synthetic experiment runner plus database-native query variants.** Use deterministic fixture construction in a rollback-only transaction, call production SQL functions, and record actual result quality and timings. This avoids persistent data changes and evaluates the database algorithms directly.
2. Add a separate in-memory TypeScript simulator for all experiments. Rejected because it could drift from the SQL implementation and would not validate database behavior.
3. Run experiments by modifying the existing seeded dataset. Rejected because it risks contaminating user data and has no unambiguous ground-truth labels.

## Proposed implementation

Add a migration with (a) `spatiotemporal_memory_walk(route,radius,start,end)` and (b) `associative_recall_paths(seed,target,depth,threshold,path_limit)` returning scored valid paths. Add validated APIs and controls/results for spatiotemporal recall and graph path comparison. Add a `research:evaluate` runner that builds its own labeled fixture transactionally; runs edge-weight, target-strength, valence, one-hop, and SQL temporal-decay ablations; sweeps salience/threshold calibration; and runs spatial/graph corruption scenarios. Persist JSON/Markdown outputs with measured metrics and latency. Provide unit/SQL integration tests for metric calculations, exact fixture outcomes, path scores/order/cycles, interval boundaries, rollback, and robustness reproducibility.

## Acceptance

- Spatiotemporal results equal the intersection of spatial corridor and `[start,end)` event-time constraints, ordered along the route by SQL.
- Alternate SQL paths agree with the activation formula and are cycle-free, threshold-pruned, depth-bounded, and deterministically sorted.
- The evaluation command reports measured metrics from fixture IDs and real query timings, and leaves database table counts unchanged after success or failure.
- Ablation, calibration, and robustness comparisons are generated from the same fixture and include configuration and environment metadata.
- Existing unit, SQL integration, and browser tests still pass.

## Limitations to report

Results calibrate against synthetic labels only. They do not demonstrate cognitive validity, biological parameter values, or performance on other machines. Query-time measurements are local database observations and should not be interpreted as independent cold-cache trials.
