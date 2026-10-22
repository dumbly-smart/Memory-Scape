# Evaluation methodology

`npm run db:benchmark` runs against the configured PostgreSQL database and records PostgreSQL/PostGIS versions, memory/edge counts, host metadata, and benchmark parameters. It performs five sequential repetitions by default (`BENCHMARK_RUNS=1..20`) and captures eight actual `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans per repetition:

- A 150 m PostGIS geography corridor predicate with a normal planner-selected plan.
- The same predicate with index and bitmap scans disabled for a controlled sequential-plan comparison. Production indexes remain present; this is not an index-drop experiment.
- Associative recall at depths 1, 2, and 3 with a 0.01 activation threshold.
- Fading materialized-view retrieval and its equivalent direct query.
- Timeline retrieval over the 30-day interval ending at the dataset's latest event time.

The runner separately times initial fading materialized-view creation by obtaining the live view definition and creating a probe in a process-unique schema inside a transaction. It drops only that generated schema before commit. It also measures a live `REFRESH MATERIALIZED VIEW fading_memories_mv`. No production tables or data are removed by these measurements.

The 1,200-memory run uses the preserved local Compose database. The 10,000-memory run was generated in a separate temporary PostgreSQL/PostGIS/pg_cron container with its own database and no reused volume; the container was removed after its JSON and Markdown outputs were saved. To repeat at 10K, create a fresh isolated database, run migrations, run `npm run db:seed -- --large`, then run `BENCHMARK_LABEL=10000 npm run db:benchmark` with that database's `DATABASE_URL`. The seed command refuses to add data to a nonempty database.

The runner writes the latest report to `RESULTS.md` and `latest.json`; set `BENCHMARK_LABEL=1200` or `10000` to also preserve labeled artifacts. JSON includes every per-run plan and timing plus mean, median, sample standard deviation, minimum, and maximum. Markdown reports medians and sample deviation. The 1,200- and 10,000-memory reports are `RESULTS-1200.md` / `latest-1200.json` and `RESULTS-10000.md` / `latest-10000.json`. Runs are sequential in one session and share evolving cache state; they are not independent cold-start samples. In the captured five-run reports, the candidate plan was a Bitmap Heap Scan and its median execution time was slightly below the controlled sequential scan at both sizes; sample spread and shared cache state mean this does not establish a general index benefit. Cache state, selectivity, planner estimates, hardware, and system load affect both plans.

Correctness is tested separately by `tests/database/algorithms.sql`, which executes database routines in a rollback transaction, and `tests/database/concurrency.sh`, which runs simultaneous PostgreSQL sessions to check reinforcement serialization and history logging. Playwright covers CRUD and the map, timeline, graph, review, settings, and database-backed API workflows in Chromium. The measurements do not establish a correctness rate or biological/cognitive validity.
