# MemoryScape

**A spatiotemporal personal knowledge graph with biologically inspired recall.** MemoryScape is a local-first BCSE497J Project I prototype by Akil (25BCE2777) and Syon Vijae Thyvalappil (25BCE2598). It explores route-based spatial recall, temporal forgetting/reinforcement, and associative spreading activation using visible PostgreSQL and PostGIS algorithms. Machine learning, embeddings, and external AI services are not used.

## Features

- Normalized PostgreSQL memory, context, directed edge, and reinforcement-history tables.
- PostGIS geography route corridor queries with meter distance and route order.
- Exponential decay, reinforcement, and atomic context-link reinforcement routines.
- Recursive SQL activation with maximum three hops, cycle prevention, pruning, and best-path explanations.
- Hourly fading-memory materialized view refreshed by pg_cron.
- Everyday workflows: quick capture and bookmarklet, people/project workspaces, follow-ups, decision notes, weekly review, and memory attachments with indexed text search.
- Independent importance, sensitive-data, and archive controls; place reminders use user-triggered nearby recall.
- Preview-first portable JSON backup/restore with attachment digest checks and transactional, no-overwrite imports.
- Seed-centered graph exploration bounded to at most 60 displayed nodes, 12 candidate outgoing edges per node, and three hops.
- Browser-local map tile configuration supports a local XYZ tile server for offline-compatible maps.
- Next.js interface for memory CRUD, search, map route recall, timeline, graph exploration, review, and database settings.
- Deterministic 1,200-row fictional campus seed dataset; refuses nonempty databases.

## Stack and architecture

PostgreSQL 16, PostGIS, pg_cron, Node.js 22+, TypeScript, `pg`, Next.js 16, React 19, Tailwind CSS 4, Leaflet/OpenStreetMap, Cytoscape.js, Vitest 5, Playwright, and axe-core. See [system architecture](docs/architecture/SYSTEM_ARCHITECTURE.md), [schema](docs/database/SCHEMA.md), and the migration at `database/migrations/001_initial.sql`.

The frontend sends validated values to API routes. SQL routines perform the main query work. The default OpenStreetMap tile source needs internet; configure a local XYZ tile server under **Settings → Map tile source** for offline-compatible map imagery. Memory storage and recall processing remain in PostgreSQL.

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

## Everyday workflows

- **Capture:** `/capture` accepts a quick note and optional page source. The page also generates a bookmarklet that captures the current URL, title, and selected text into a reviewable draft.
- **People and projects:** open a Person or Project context from a memory tag to see its recent history, resume point, follow-ups, and decisions.
- **Follow-ups and decisions:** link an action or decision to a memory/context and track its due or revisit date.
- **Weekly review:** `/review/weekly` prioritizes recent, pinned, fading memories and due follow-ups. Keep, snooze, archive, or dismiss each item. Sensitive and archived memories do not enter the queue.
- **Attachments:** add up to 10 MiB per file to a memory. Plain UTF-8 text, Markdown, CSV, JSON, and XML have indexed text search; binary files remain downloadable but have no OCR/PDF extraction.
- **Backup:** open **Settings → Backup & restore**, download the versioned JSON file, and select a file to preview before restoring. Restore rejects existing IDs/context labels and rolls back the whole import on error. Bundles are limited to 15 MiB overall and 10 MiB combined attachment bytes. Backups contain sensitive memory text and file contents; store them privately.
- **Privacy and importance:** pin importance separately from strength; mark a memory sensitive or archive it from its detail view. Sensitive memories remain in the library but are excluded from nearby and review recall.
- **Place recall:** `/nearby` asks for location only after an explicit user action. It sends coordinates to the local app, which queries PostGIS in meters.

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
npm run study:validate
DATABASE_URL=postgres://memoryscape:memoryscape_local@127.0.0.1:5432/memoryscape npm run study:verify-db
npm audit --audit-level=low
```

The SQL contract test uses a rollback transaction and exercises actual database routines. The concurrency script checks row-lock serialization using eight simultaneous PostgreSQL sessions by default (`CONCURRENCY_COUNT` supports 1–32). Playwright tests exercise CRUD and the map, timeline, graph, review, settings, and API workflows against PostgreSQL. The matrix command runs Chromium and Firefox; `test:e2e:all-browsers` additionally runs WebKit on hosts with Playwright's WebKit system dependencies. The accessibility test scans all seven primary pages for WCAG 2.1 A/AA violations. `test:e2e:auth` expects an already-running server configured with the documented password and secret; use `E2E_AUTH_PASSWORD` for the test password. `npm run db:seed -- --large` creates 10,000 rows only in an empty database. For evaluation, use a separate disposable PostgreSQL database; the regular runner records five sequential repetitions by default. `db:benchmark:fresh-buffers` creates and removes a separate disposable PostgreSQL instance, restarting it between one-run trials; PostgreSQL shared buffers reset, while operating-system cache does not. Both runners save actual plans and measurements. Human study preparation/scoring commands use fictional scenarios; complete institutional ethics approval and consent before recruiting or collecting any data. See the [study runbook](docs/evaluation/study/STUDY_RUNBOOK.md), [methodology](docs/evaluation/METHODOLOGY.md), [results](docs/evaluation/RESULTS.md), and [implementation status](docs/IMPLEMENTATION_STATUS.md).

## Troubleshooting

- **Web starts but API says database unavailable:** inspect `docker compose ps` and `docker compose logs db web`; check `DATABASE_URL` and the healthcheck.
- **Seed refuses:** it never overwrites data. Use a fresh development database/volume only if you intentionally want to discard that development database.
- **No map imagery:** OSM tiles need internet access. Stored coordinates and spatial queries still work locally.
- **Local map tiles:** set an XYZ URL template with `{z}`, `{x}`, and `{y}` under Settings. It is saved only in the browser that changed it; browser settings are not part of database backups.
- **pg_cron extension error:** the database must start with `shared_preload_libraries=pg_cron` and `cron.database_name=memoryscape`; rebuild/start Compose and rerun migrations.
- **Docker build fails on package mirrors:** the PostGIS image's OS package repositories may be stale; check the selected database image and apt repository availability.
- **`npm ci` times out during Docker image build:** if the Docker bridge cannot reach npm but the host can, run `docker build --network=host -f docker/web.Dockerfile -t memory-scape-web .`, then `docker compose up -d --no-build web`.

## Research contributions and limits

The prototype makes the three recall algorithms inspectable in SQL and provides deterministic correctness fixtures. Valence and review-priority coefficients are engineering choices, not empirically validated cognitive constants. See [spatial recall](docs/algorithms/SPATIAL_RECALL.md), [temporal model](docs/algorithms/TEMPORAL_DECAY.md), [spreading activation](docs/algorithms/SPREADING_ACTIVATION.md), [evaluation methodology](docs/evaluation/METHODOLOGY.md), and the [demo guide](docs/DEMO_GUIDE.md). The recorded benchmark output is a reproducible repeated observation, not a general performance claim.
