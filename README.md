# MemoryScape

**A spatiotemporal personal knowledge graph with biologically inspired recall.** MemoryScape is a local-first BCSE497J Project I prototype by Akil (25BCE2777) and Syon Vijae Thyvalappil (25BCE2598). It explores route-based spatial recall, temporal forgetting/reinforcement, and associative spreading activation using visible PostgreSQL and PostGIS algorithms. Machine learning, embeddings, and external AI services are not used.

## Features

- Normalized PostgreSQL memory, context, directed edge, and reinforcement-history tables.
- PostGIS geography route corridor queries with meter distance and route order.
- Exponential decay, reinforcement, and atomic context-link reinforcement routines.
- Recursive SQL activation with maximum three hops, cycle prevention, pruning, and best-path explanations.
- Hourly fading-memory materialized view refreshed by pg_cron.
- Next.js interface for memory CRUD endpoints, library capture/search, map route recall, timeline, graph exploration, review, and database settings.
- Deterministic 1,200-row fictional campus seed dataset; refuses nonempty databases.

## Stack and architecture

PostgreSQL 16, PostGIS, pg_cron, Node.js 22+, TypeScript, `pg`, Next.js 16, React 19, Tailwind CSS 4, Leaflet/OpenStreetMap, Cytoscape.js, Vitest 5, Playwright, and axe-core. See [system architecture](docs/architecture/SYSTEM_ARCHITECTURE.md), [schema](docs/database/SCHEMA.md), and the migration at `database/migrations/001_initial.sql`.

The frontend sends validated values to API routes. SQL routines perform the main query work. OSM map tile downloads require internet; memory storage and recall processing remain in the local database.

## Quick start (Docker)

1. Copy `.env.example` to `.env` and change the local password if desired.
2. Start services: `docker compose up --build`.
3. Wait for Next.js to finish its first-start migration, then open [http://localhost:3000](http://localhost:3000).
4. In a second terminal, load synthetic data: `docker compose exec web npm run db:seed`.

Compose binds ports to `127.0.0.1`, persists PostgreSQL in `memoryscape_data`, waits for database health, and runs repeatable migrations on web startup. Seeding is separate and intentionally refuses to touch a nonempty memory database. `docker compose down` keeps data; `docker compose down -v` deletes the database volume.

## Local development

Install Node.js 22 or newer and Docker. Start the database with `docker compose up -d db`, then install dependencies and run:

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Set `DATABASE_URL` from `.env.example`. Manual refresh endpoint controls are enabled in local Compose by `ALLOW_MANUAL_MAINTENANCE=true`; disable them for environments where only scheduled maintenance should run. Optional single-user password authentication is available. To enable it, set `MEMORYSCAPE_PASSWORD` (at least 12 characters) and `MEMORYSCAPE_SESSION_SECRET` (at least 32 characters) in `.env`, then recreate the web container. Generate the session secret with `openssl rand -hex 32`. With both values empty, local mode is open; setting only one value or an invalid value fails closed. Keep open mode bound to localhost. Before deployment beyond a trusted local machine, use managed secret storage and review TLS, rate limits, authorization, and database network access controls.

## Database operations

```sh
npm run db:migrate
npm run db:seed
docker compose exec db psql -U memoryscape -d memoryscape -c "SELECT extname,extversion FROM pg_extension WHERE extname IN ('postgis','pg_cron');"
docker compose exec db psql -U memoryscape -d memoryscape -c "SELECT jobname,schedule,command FROM cron.job;"
docker compose exec db psql -U memoryscape -d memoryscape -c "SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;"
docker compose exec db psql -U memoryscape -d memoryscape -c "SELECT apply_memory_decay(now());"
```

## Tests and evaluation

```sh
npm test
DATABASE_URL=postgres://memoryscape:memoryscape_local@127.0.0.1:5432/memoryscape CONCURRENCY_COUNT=8 bash tests/database/concurrency.sh
npm run test:e2e
npm run test:e2e:matrix
npm run test:e2e:auth
docker compose exec -T db psql -U memoryscape -d memoryscape -v ON_ERROR_STOP=1 -f /dev/stdin < tests/database/algorithms.sql
npm run db:benchmark
npm run db:benchmark:fresh-buffers
npm audit --audit-level=low
```

The SQL contract test uses a rollback transaction and exercises actual database routines. The concurrency script checks row-lock serialization using eight simultaneous PostgreSQL sessions by default (`CONCURRENCY_COUNT` supports 1–32). Playwright tests exercise CRUD and the map, timeline, graph, review, settings, and API workflows against PostgreSQL. The matrix command runs Chromium and Firefox; `test:e2e:all-browsers` additionally runs WebKit on hosts with Playwright's WebKit system dependencies. The accessibility test scans all seven primary pages for WCAG 2.1 A/AA violations. `test:e2e:auth` expects an already-running server configured with the documented password and secret; use `E2E_AUTH_PASSWORD` for the test password. `npm run db:seed -- --large` creates 10,000 rows only in an empty database. For evaluation, use a separate disposable PostgreSQL database; the regular runner records five sequential repetitions by default. `db:benchmark:fresh-buffers` creates and removes a separate disposable PostgreSQL instance, restarting it between one-run trials; PostgreSQL shared buffers reset, while operating-system cache does not. Both runners save actual plans and measurements. See [methodology](docs/evaluation/METHODOLOGY.md), [results](docs/evaluation/RESULTS.md), and [implementation status](docs/IMPLEMENTATION_STATUS.md).

## Troubleshooting

- **Web starts but API says database unavailable:** inspect `docker compose ps` and `docker compose logs db web`; check `DATABASE_URL` and the healthcheck.
- **Seed refuses:** it never overwrites data. Use a fresh development database/volume only if you intentionally want to discard that development database.
- **No map imagery:** OSM tiles need internet access. Stored coordinates and spatial queries still work locally.
- **pg_cron extension error:** the database must start with `shared_preload_libraries=pg_cron` and `cron.database_name=memoryscape`; rebuild/start Compose and rerun migrations.
- **Docker build fails on package mirrors:** the PostGIS image's OS package repositories may be stale; check the selected database image and apt repository availability.

## Research contributions and limits

The prototype makes the three recall algorithms inspectable in SQL and provides deterministic correctness fixtures. Valence and review-priority coefficients are engineering choices, not empirically validated cognitive constants. See [spatial recall](docs/algorithms/SPATIAL_RECALL.md), [temporal model](docs/algorithms/TEMPORAL_DECAY.md), [spreading activation](docs/algorithms/SPREADING_ACTIVATION.md), [evaluation methodology](docs/evaluation/METHODOLOGY.md), and the [demo guide](docs/DEMO_GUIDE.md). The recorded benchmark output is a reproducible repeated observation, not a general performance claim.
