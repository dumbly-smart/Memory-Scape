# MemoryScape

**A spatiotemporal personal knowledge graph with biologically inspired recall.** MemoryScape is a local-first BCSE497J Project I prototype by Akil (25BCE2777) and Syon Vijae Thyvalappil (25BCE2598). It explores route-based spatial recall, temporal forgetting/reinforcement, and associative spreading activation using visible PostgreSQL and PostGIS algorithms. Machine learning, embeddings, and external AI services are not used.

## Features

- Normalized PostgreSQL memory, context, directed edge, and reinforcement-history tables.
- PostGIS geography route corridor queries with meter distance and route order.
- Spatiotemporal route recall intersects a PostGIS corridor with a half-open event-time window.
- Exponential decay, reinforcement, and atomic context-link reinforcement routines.
- Recursive SQL activation with user-selected depth up to 32 hops, cycle prevention, pruning, and best-path explanations.
- Hourly fading-memory materialized view refreshed by pg_cron.
- Everyday workflows: quick capture and bookmarklet, people/project workspaces, follow-ups, decision notes, weekly review, and searchable attachments with local PDF/image text extraction and OCR.
- Independent importance, sensitive-data, and archive controls; place reminders use user-triggered nearby recall.
- Preview-first portable JSON backup/restore with attachment digest checks and transactional, no-overwrite imports.
- Force-directed associative graph exploration bounded to at most 60 displayed nodes, 12 candidate outgoing edges per node, and 32 hops.
- Alternate associative paths expose per-hop activation scores and relationship evidence.
- Synthetic-ground-truth research lab measures ablations, parameter sweeps, radius sensitivity, and resilience to missing/noisy locations or removed graph edges.
- Browser-local map tile configuration supports a local XYZ tile server for offline-compatible maps.
- Next.js interface for memory CRUD, search, map route recall, timeline, graph exploration, review, and database settings.
- Deterministic 1,200-row fictional campus seed dataset; refuses nonempty databases.
- Add-only fictional VIT Vellore–Kannur student persona dataset, separately registered and removable without affecting other memories.

## Stack and architecture

PostgreSQL 16, PostGIS, pg_cron, Node.js 22+, TypeScript, `pg`, Next.js 16, React 19, Tailwind CSS 4, Leaflet/OpenStreetMap, Cytoscape.js, Vitest 5, Playwright, and axe-core. See [system architecture](docs/architecture/SYSTEM_ARCHITECTURE.md), [schema](docs/database/SCHEMA.md), and the migration at `database/migrations/001_initial.sql`.

The frontend sends validated values to API routes. SQL routines perform the main query work. The default OpenStreetMap tile source needs internet; configure a local XYZ tile server under **Settings → Map tile source** for offline-compatible map imagery. Memory storage and recall processing remain in PostgreSQL.

## Quick start (Docker)

1. Copy `.env.example` to `.env` and change the local password if desired.
2. Start services: `docker compose up --build`.
3. Wait for Next.js to finish its first-start migration, then open [http://localhost:3000](http://localhost:3000).
4. In a second terminal, load synthetic data: `docker compose exec web npm run db:seed`.

Compose binds ports to `127.0.0.1`, persists PostgreSQL in `memoryscape_data`, waits for database health, and runs repeatable migrations on web startup. The base 1,200-row seed is separate and refuses to touch a nonempty memory database; the separately registered persona seed is additive. `docker compose down` keeps data; `docker compose down -v` deletes the database volume.

For a more realistic student-life walkthrough, add the fictional VIT Vellore student whose family home is in Kannur with `docker compose exec web npm run db:seed:persona`. This dataset can be added alongside existing memories, is safe to rerun, and is isolated by the **Synthetic persona: Nikhil P. (fictional)** context. It includes semester routines, study/project memories, family and friend relationships, holiday journeys and vacations. See [the persona dataset guide](docs/SYNTHETIC_PERSONA_DATASET.md) for its privacy notes and scoped removal command.

## Local development

Install Node.js 22 or newer and Docker. Local development also needs Poppler (`pdfinfo`, `pdftotext`, `pdftoppm`) and Tesseract with English language data on `PATH` for PDF extraction and OCR. On Debian/Ubuntu, install them with `sudo apt-get install poppler-utils tesseract-ocr tesseract-ocr-eng`. The Docker web image installs these tools automatically. Start the database with `docker compose up -d db`, then install dependencies and run:

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run db:seed:persona
npm run dev
```

Set `DATABASE_URL` from `.env.example`. Manual refresh endpoint controls are enabled in local Compose by `ALLOW_MANUAL_MAINTENANCE=true`; disable them for environments where only scheduled maintenance should run. Optional single-user password authentication is available. To enable it, set `MEMORYSCAPE_PASSWORD` (at least 12 characters) and `MEMORYSCAPE_SESSION_SECRET` (at least 32 characters) in `.env`, then recreate the web container. Generate the session secret with `openssl rand -hex 32`. With both values empty, local mode is open; setting only one value or an invalid value fails closed. Keep open mode bound to localhost. Before deployment beyond a trusted local machine, use managed secret storage and review TLS, rate limits, authorization, and database network access controls.

Text-layer PDFs are indexed with Poppler for at most 100 pages. Scanned PDFs fall back to local English OCR on at most the first 10 pages, each rendered at no more than 1,600 pixels per side. PNG and JPEG attachments are OCR-indexed when they are at most 12 megapixels. Extraction is bounded by subprocess timeouts and the normal 10 MiB upload limit. If the tools are missing, a file format is unsupported, or no readable text is found, the original file is still attached and the UI reports that no text was indexed.

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
- **Backup:** Open Settings → Backup & restore and create an encrypted file with a passphrase and one-time recovery key, or explicitly choose unencrypted JSON. Save the recovery key separately. Select a backup to preview before restoring. Restore rejects existing IDs/context labels and rolls back the whole import on error. Bundles are limited to 15 MiB overall and 10 MiB combined attachment bytes.
- **Privacy and importance:** pin importance separately from strength; mark a memory sensitive or archive it from its detail view. Sensitive memories remain in the library but are excluded from nearby and review recall.
- **Place recall:** `/nearby` asks for location only after an explicit user action. It sends coordinates to the local app, which queries PostGIS in meters.
- **Spatiotemporal research recall:** `/research/spatiotemporal` draws a route, chooses an event-time interval and corridor radius, and retrieves SQL-ordered episodes satisfying both constraints.
- **Alternate graph explanations:** on `/graph`, inspect up to five simple SQL paths to each retrieved memory, including each hop's activation, weight, relationship, and valence.

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
npm run study:power
DATABASE_URL=postgres://memoryscape:memoryscape_local@127.0.0.1:5432/memoryscape npm run study:verify-db
DATABASE_URL=postgres://memoryscape:memoryscape_local@127.0.0.1:5432/memoryscape npm run test:research-db
DATABASE_URL=postgres://memoryscape:memoryscape_local@127.0.0.1:5432/memoryscape npm run research:evaluate -- --seed=497
npm audit --audit-level=low
```

The SQL contract tests run in rollback transactions and exercise actual database routines. `test:research-db` covers route/time intersection, interval boundaries, path scores, alternate paths, and cycle/depth limits. `research:evaluate` uses a deterministic labeled fixture inside a transaction and verifies persistent row counts are unchanged after rollback; set `RESEARCH_REPETITIONS=1..20`, `--seed=<uint32>`, or `--out=<directory>` to control the run. Its synthetic calibration output is not human or biological validation. The concurrency script checks row-lock serialization using eight simultaneous PostgreSQL sessions by default (`CONCURRENCY_COUNT` supports 1–32). Playwright tests exercise CRUD and map, timeline, graph, review, settings, research recall, and API workflows against PostgreSQL. The matrix command runs Chromium and Firefox; `test:e2e:all-browsers` additionally runs WebKit on hosts with Playwright's WebKit system dependencies. The accessibility test scans all eight primary pages for WCAG 2.1 A/AA violations. `test:e2e:auth` expects an already-running server configured with the documented password and secret; use `E2E_AUTH_PASSWORD` for the test password. `npm run db:seed -- --large` creates 10,000 rows only in an empty database. For evaluation, use a separate disposable PostgreSQL database; the regular runner records five sequential repetitions by default. `db:benchmark:fresh-buffers` creates and removes a separate disposable PostgreSQL instance, restarting it between one-run trials; PostgreSQL shared buffers reset, while operating-system cache does not. Both runners save actual plans and measurements. `npm run study:power` performs exact conditional McNemar sensitivity calculations from assumed paired discordance rates; it is a planning aid, not an approved sample-size justification. Human study preparation/scoring commands use fictional scenarios; complete institutional ethics approval and consent before recruiting or collecting any data. See the [study runbook](docs/evaluation/study/STUDY_RUNBOOK.md), [methodology](docs/evaluation/METHODOLOGY.md), [results](docs/evaluation/RESULTS.md), [synthetic research evaluation](docs/evaluation/research/RESULTS.md), and [implementation status](docs/IMPLEMENTATION_STATUS.md).

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

### Daily-use portability

- /capture encrypts queued drafts in IndexedDB using AES-256-GCM and a passphrase-derived key. The passphrase stays in page memory only and is never sent to the server; enter it again after reopening the page to unlock and sync. Older plaintext queue records are encrypted when next unlocked. If the passphrase is lost, queued drafts cannot be recovered; the page provides an explicit confirmed discard action.
- /daily summarizes overdue/next-day follow-ups, decisions to revisit, and the fading-memory snapshot. In-page alerts are checked while the page is open. Optional background Web Push is sent by the local Node service and displayed by the service worker; browser push services must be reachable, but MemoryScape requires no paid API. Sensitive/archived linked memories are excluded.
- **Settings → Import** previews Markdown/text files, Netscape bookmark HTML, and iCalendar events before writing. Imports are capped at 15 MiB and 1,000 expanded entries; duplicate content is skipped. Bounded recurrence rules expand in full (up to 1,000 entries); open-ended rules expand within one year before and after import time. Floating iCalendar times use UTC.
- **Settings → Backup & restore** encrypts exports locally using PBKDF2-SHA-256 and AES-256-GCM. New files can be unlocked with the passphrase or a separately generated recovery key; save the recovery key when shown because it cannot be reconstructed later. The plain JSON export remains available and contains readable private data. Keys never reach the server.
- Context pages can add alternate names and merge contexts of the same type. Merges move memory links, follow-ups, decisions, and aliases transactionally, deduplicate repeated memory links, and do not reinforce memories.
- The memory library can save named filter combinations to PostgreSQL and restore or delete them later.
