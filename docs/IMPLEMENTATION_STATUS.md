# MemoryScape implementation status

Updated 2026-10-22 after database login throttling, baseline HTTP security headers, responsive layout fixes, local Docker, SQL, TypeScript, unit, and browser verification. “Tested” refers to the explicit commands below; it does not imply production security or research validity.

## Infrastructure and database

- **Implemented and tested** — PostgreSQL 16.15, PostGIS 3.6.4, and pg_cron 1.6 run in Compose. Host ports bind to localhost and PostgreSQL data persists in a named volume.
- **Implemented and tested** — Startup waits for database health and runs safe, repeatable migrations. Health reports live PostgreSQL/PostGIS versions.
- **Implemented and tested** — Normalized memories, contexts, associations, directed weighted edges, reinforcement history, constraints, triggers, B-tree/GiST indexes, functions, and metadata.
- **Implemented and tested** — Daily decay and hourly materialized-view refresh jobs are registered in pg_cron; SQL checks exercise decay and view routines.
- **Implemented and tested** — Seed refuses any nonempty database. The primary local DB contains its original 1,200 synthetic memories; an isolated disposable database generated and benchmarked 10,000 memories and was removed after preserving result artifacts.
- **Implemented and tested** — SQL contract assertions cover deterministic decay, repeated-time idempotence, reinforcement, context-link idempotence, spatial distance/order/invalid input, activation, pruning, cycles, and configured coefficients.
- **Implemented and tested** — Eight concurrent sessions serialize reinforcement with row locks and preserve every update and history event (script configurable from 1–32 sessions).

## Application and API

- **Implemented and tested** — Next.js 16/React/Tailwind app with dashboard, library CRUD, map, timeline, Cytoscape graph, fading review, and method settings. Package audit reports zero known vulnerabilities.
- **Implemented and tested** — API uses runtime validation and parameterized SQL for memory CRUD, contexts, edges, spatial walk, reinforcement, recall, review, health, and settings.
- **Implemented and tested** — Optional single-user password login protects pages and APIs when both password and session secret are configured. Auth browser tests cover redirect/401, rejected password, valid session, and logout. With both variables empty, localhost prototype runs open.
- **Implemented and tested** — Login failures are rate-limited transactionally in PostgreSQL to five attempts per 15-minute workspace window; the sixth attempt returns HTTP 429 and `Retry-After`. A valid login clears the shared limiter. This intentionally protects one local workspace account; it is not per-IP abuse prevention.
- **Implemented and tested** — All application routes return `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and restrictive camera/geolocation/microphone `Permissions-Policy` headers.
- **Implemented and tested** — Browser tests cover CRUD, corridor drawing, route undo/clear and sequential navigation, related-memory detail selection, inclusive timeline date filtering/reinforcement, bounded graph recall, review refresh/reinforcement, settings persistence, and engine API paths against PostgreSQL.
- **Implemented and tested** — API contracts cover malformed payloads, missing records, duplicate context linking without duplicate reinforcement, context unlink, duplicate/self-edge errors and edge removal against PostgreSQL. Database `NOT NULL` and `CHECK` violations now map to HTTP 400 instead of internal-server errors.
- **Implemented and tested** — axe-core WCAG 2.1 A/AA scans pass on all seven primary pages in Chromium and Firefox.
- **Implemented and tested** — Playwright checks all seven primary pages at 390px and 1440px widths; the phone checks caught and fixed timeline metadata and associative graph overflow.
- **Implemented but not exhaustively tested** — Every malformed input combination, accessibility behavior outside the audited desktop pages/browsers, and contention beyond the deterministic 32-session maximum do not have exhaustive tests.

## Algorithms and evaluation

- **Implemented and tested** — PostGIS geography corridor uses meter radius and route ordering; the route UI emits GeoJSON from map clicks.
- **Implemented and tested** — Exponential temporal decay and reinforcement execute as SQL functions with transactionally logged reinforcement history.
- **Implemented and tested** — Recursive SQL activation bounds traversal to 1–3 hops, tracks paths to prevent cycles, prunes weak paths, keeps the strongest path per target, and returns explanation data. Valence coefficients are stored in `algorithm_parameters` and configurable through Settings.
- **Implemented and tested** — Fading review materialized view uses configurable strength/age coefficients; settings validation enforces normalized coefficient sums. View refresh is available by scheduled job and the local maintenance endpoint.
- **Implemented and tested** — `npm run db:benchmark` records real `EXPLAIN (ANALYZE, BUFFERS)` plans, actual materialized-view initial creation in a transactionally removed generated schema, refresh, view/direct retrieval, timeline, spatial planner-controlled scan comparison, and recursive depths 1–3.
- **Implemented and tested** — Reports preserve separate real runs at 1,200 and 10,000 memories in `docs/evaluation/RESULTS-1200.md` and `RESULTS-10000.md` plus JSON plans. At the 10K run, the index candidate was slower than the controlled sequential plan; no index speedup is claimed.
- **Implemented and tested** — Benchmark runner performs five sequential repetitions by default (configurable 1–20) and reports raw plans plus mean, median, sample standard deviation, minimum, and maximum for query, view-creation, and refresh timings. Both labeled datasets were rerun with five repetitions.
- **Implemented but not tested** — Independent cold-cache runs, multiple hardware environments, formal confidence intervals, and cognitive validity are not established by the repeated measurements.

## Known limitations

- The local single-user auth is optional. Login throttling is workspace-wide, so it does not replace per-source rate limiting at a reverse proxy for public deployments. Deployments beyond a trusted local machine also need reviewed secret management, TLS, operational hardening, and appropriate authorization.
- OpenStreetMap tiles require internet. Geodata storage and query computation remain local.
- Chromium and Firefox test matrices pass. WebKit is configured, but this Arch Linux environment lacks Playwright WebKit's required host libraries; the separate browser container image could not be fetched with only 2.1 GB of free disk available, so Safari/WebKit has not been verified here. The suite is substantial for a prototype, not exhaustive for every acceptance scenario.
- Five sequential benchmark repetitions share evolving cache state; they are not independent cold-start trials. Results are machine and workload specific.
- Activation and review coefficients are configurable engineering parameters; they have not been established as biological constants.

## Verification performed

- `docker compose up --build -d` — passed; PostgreSQL healthy and web started.
- `curl -fsS http://127.0.0.1:3000/api/health` — passed with PostgreSQL 16.15 and PostGIS 3.6.4.
- `npm run build` — passed on Next.js 16.4.2; all application routes compiled.
- `docker compose up --build -d web` — passed with the updated lockfile; `curl http://127.0.0.1:3000/api/health` returned PostgreSQL 16.15 and PostGIS 3.6.4. The existing database still contains 1,200 memories.
- `npx tsc --noEmit` — passed.
- `npm test -- --reporter=dot` — passed, 11 unit tests across 4 files, including repeated-measurement statistics, on Vitest 5.0.5.
- `docker compose exec -T db psql -U memoryscape -d memoryscape -f /dev/stdin < tests/database/auth-rate-limit.sql` — passed; deterministic attempt, cooldown, reset, and expiry assertions rolled back.
- `DATABASE_URL=... bash tests/database/concurrency.sh` — passed; eight simultaneous PostgreSQL sessions preserved every reinforcement strength update and history event.
- `docker compose exec -T db psql -U memoryscape -d memoryscape -v ON_ERROR_STOP=1 -f /dev/stdin < tests/database/algorithms.sql` — passed; transaction rolled back.
- `DATABASE_URL=... bash tests/database/concurrency.sh` — passed, 8-session run passed and preserved all 8 reinforcement history events.
- `PLAYWRIGHT_BASE_URL=... DATABASE_URL=... PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... npm run test:e2e:matrix -- --workers=1` — passed; 20 tests (10 in Chromium, 10 in Firefox), including seven-page axe scans, CRUD, API contracts, map, timeline, graph, review, and settings.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... npm run test:e2e -- --workers=1` — passed; all 10 browser tests against the production Docker container.
- `E2E_AUTH_PASSWORD=... PLAYWRIGHT_BASE_URL=... PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... npm run test:e2e:auth` with a temporary configured password/session secret — passed; protected page/API, rejected credentials, lockout after five failures, valid login, limiter reset, and logout.
- `PLAYWRIGHT_BASE_URL=... PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... npx playwright test tests/ui/responsive.spec.ts` — passed, 14 checks for seven pages at phone and desktop widths.
- `PLAYWRIGHT_BASE_URL=... PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... npx playwright test tests/ui/security-headers.spec.ts` — passed.
- `npm audit --audit-level=low` — passed with zero reported vulnerabilities after updating Next.js and Vitest.
- `BENCHMARK_RUNS=5 BENCHMARK_LABEL=1200 npm run db:benchmark` — passed; 5 repetitions of 8 plans, view creation, and refresh against 1,200 memories.
- Isolated `npm run db:seed -- --large` and `BENCHMARK_RUNS=5 BENCHMARK_LABEL=10000 npm run db:benchmark` — passed after waiting for the PostgreSQL initialization restart; disposable database was removed and primary DB remains at 1,200 memories.

## Final checkpoint

Core engines, app flows, migrations, optional local authentication with database login throttling, baseline security headers, responsive layouts, 1,200/10,000 dataset generation, repeated evaluation, and expanded API contracts are implemented and verified. The open local app is running; the primary database retains its original 1,200 memories.
