# MemoryScape implementation status

Updated 2026-10-23 after cache-eviction trial support, cross-host artifact comparison, and a draft human-study protocol. “Tested” refers to the explicit commands below; it does not imply production security or research validity.

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
- **Implemented and tested** — axe-core WCAG 2.1 A/AA scans pass on all seven primary pages at desktop and 390px mobile width in Chromium and Firefox.
- **Implemented and tested** — Responsive browser checks identified and fixed horizontal overflow in the memory and fading-review tables and long database-version metadata in Settings. Tables remain horizontally scrollable inside labeled regions on narrow screens.
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
- **Implemented and tested** — `npm run db:benchmark:fresh-buffers` provisions a temporary database container, seeds it, restarts PostgreSQL between one-run trials, preserves per-trial plans, reports Student t 95% confidence intervals for means, then removes the isolated container and volume. The default restarts the PostgreSQL shared buffer pool only.
- **Implemented and tested** — `FRESH_BUFFER_EVICT_PAGE_CACHE=1 npm run db:benchmark:fresh-buffers` checkpoints the disposable database and issues `POSIX_FADV_DONTNEED` requests for database relation files. The five 1,200-memory trial report records request counts and targeted bytes. The kernel may retain pages; this does not constitute a verified cold-cache or cold-disk run.
- **Implemented and tested** — `npm run db:benchmark:compare -- <artifact-a.json> <artifact-b.json>` compares artifacts with matching dataset size, cache strategy, route radius, pruning threshold, and plan set, and writes Markdown and JSON with host metadata. It was exercised with temporary artifacts only.
- **Implemented and documented** — `docs/evaluation/HUMAN_STUDY_PROTOCOL.md` defines an ethics-first synthetic-scenario protocol and data dictionary. It does not represent completed human-subject evaluation.
- **Incomplete** — Verified global operating-system/disk-cache cold starts, runs on other physical machines, and participant-based cognitive validity are not established. Confidence intervals assume independent, approximately normal observations and describe this one-host experiment only.

## Known limitations

- The local single-user auth is optional. Login throttling is workspace-wide, so it does not replace per-source rate limiting at a reverse proxy for public deployments. Deployments beyond a trusted local machine also need reviewed secret management, TLS, operational hardening, and appropriate authorization.
- OpenStreetMap tiles require internet. Geodata storage and query computation remain local.
- Chromium and Firefox browser coverage has passed when run with the documented database environment. WebKit is configured and its browser files downloaded, but Safari/WebKit cannot launch on this Arch Linux host because ICU 74, flite, libjxl, and libbacktrace runtime libraries are missing; WebKit browser behavior remains unverified. The suite is substantial for a prototype, not exhaustive for every acceptance scenario.
- Five sequential repetitions in the regular benchmark share evolving cache state. The optional fresh-buffer runner clears PostgreSQL shared buffers between trials but not the operating-system file cache. Results are machine and workload specific.
- Fresh-buffer confidence intervals are nominal Student t intervals over five sequential restarts. They do not account for host load, trial ordering, file cache, or between-machine variability.
- Activation and review coefficients are configurable engineering parameters; they have not been established as biological constants.

## Verification performed

- `docker compose up --build -d` — passed; PostgreSQL healthy and web started.
- `curl -fsS http://127.0.0.1:3000/api/health` — passed with PostgreSQL 16.15 and PostGIS 3.6.4.
- `npm run build` — passed on Next.js 16.4.2; all application routes compiled.
- `docker compose up --build -d web` — passed with the updated lockfile; `curl http://127.0.0.1:3000/api/health` returned PostgreSQL 16.15 and PostGIS 3.6.4. The existing database still contains 1,200 memories.
- `npx tsc --noEmit` — passed.
- `npm test -- --reporter=dot` — passed, 13 unit tests across 4 files, including Student t interval calculations, on Vitest 5.0.5.
- `npm test` — passed, 18 tests across 6 files after the benchmark comparison and cache helper changes.
- `npx tsc --noEmit` — passed after benchmark report typing correction.
- `npm run build` — passed after benchmark report typing correction; all routes compiled.
- `npm audit --audit-level=low` — passed with zero vulnerabilities.
- `bash tests/database/page-cache-eviction.sh` — passed against an isolated Docker volume, visiting regular files under synthetic PostgreSQL `base/` and `global/` directories.
- `docker compose exec -T db psql -U memoryscape -d memoryscape -f /dev/stdin < tests/database/auth-rate-limit.sql` — passed; deterministic attempt, cooldown, reset, and expiry assertions rolled back.
- `DATABASE_URL=... bash tests/database/concurrency.sh` — passed; eight simultaneous PostgreSQL sessions preserved every reinforcement strength update and history event.
- `docker compose exec -T db psql -U memoryscape -d memoryscape -v ON_ERROR_STOP=1 -f /dev/stdin < tests/database/algorithms.sql` — passed; transaction rolled back.
- `DATABASE_URL=... bash tests/database/concurrency.sh` — passed, 8-session run passed and preserved all 8 reinforcement history events.
- `PLAYWRIGHT_BASE_URL=... DATABASE_URL=... PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... npm run test:e2e:matrix -- --workers=1` — passed; 20 tests (10 in Chromium, 10 in Firefox), including seven-page axe scans, CRUD, API contracts, map, timeline, graph, review, and settings.
- `DATABASE_URL=... PORT=3001 npm run dev` plus `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_PROJECTS=chromium npx playwright test --config=playwright.matrix.config.ts --workers=1` — passed after the responsive corrections; all 26 Chromium UI tests passed against the PostgreSQL-backed app.
- The same serial Playwright command with `PLAYWRIGHT_PROJECTS=firefox` — passed; all 26 Firefox UI tests passed against the PostgreSQL-backed app.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... npm run test:e2e -- --workers=1` — passed; all 10 browser tests against the production Docker container.
- `E2E_AUTH_PASSWORD=... PLAYWRIGHT_BASE_URL=... PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... npm run test:e2e:auth` with a temporary configured password/session secret — passed; protected page/API, rejected credentials, lockout after five failures, valid login, limiter reset, and logout.
- `DATABASE_URL=... PORT=3001 npm run dev` plus `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_PROJECTS=chromium npx playwright test tests/ui/responsive.spec.ts tests/ui/accessibility.spec.ts --config=playwright.matrix.config.ts --workers=1` — passed, 16 checks including axe WCAG 2.1 A/AA scans on all seven pages at desktop and phone width and 14 responsive checks.
- `PLAYWRIGHT_BASE_URL=... PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... npx playwright test tests/ui/security-headers.spec.ts` — passed.
- `npm audit --audit-level=low` — passed with zero reported vulnerabilities after updating Next.js and Vitest.
- `BENCHMARK_RUNS=5 BENCHMARK_LABEL=1200 npm run db:benchmark` — passed; 5 repetitions of 8 plans, view creation, and refresh against 1,200 memories.
- Isolated `npm run db:seed -- --large` and `BENCHMARK_RUNS=5 BENCHMARK_LABEL=10000 npm run db:benchmark` — passed after waiting for the PostgreSQL initialization restart; disposable database was removed and primary DB remains at 1,200 memories.
- `npm run db:benchmark:fresh-buffers` — passed on 2026-10-23; five 1,200-memory trials each followed a database restart. The current measured medians are in `docs/evaluation/fresh-buffer-trials/RESULTS.md`, with sample standard deviations and nominal 95% Student t intervals for the means. The indexed spatial candidate remained slower than the controlled sequential query; no general index benefit is claimed. The temporary database and volume were removed, and the primary database still contains 1,200 memories.
- `FRESH_BUFFER_EVICT_PAGE_CACHE=1 npm run db:benchmark:fresh-buffers` — passed on 2026-10-23; five trials each issued successful advisory eviction requests for about 1,975 relation files (about 65.7 MB) after checkpoint. The artifacts explicitly state this is an eviction attempt, not verified cold cache. The temporary database and volume were removed.
- `bash tests/database/page-cache-eviction.sh` — passed against an isolated Docker volume with two synthetic relation files.
- `npm run db:benchmark:compare -- /tmp/memoryscape-a.json /tmp/memoryscape-b.json` — passed using temporary copies of one artifact with distinct machine labels. This validated the CLI; it is not cross-machine experimental evidence.
- `docker compose up -d --build` and `curl -fsS http://127.0.0.1:3000/api/health` — passed; local web and PostgreSQL services started, and health reported PostgreSQL 16.15/PostGIS 3.6.4.

## Final checkpoint

Core engines, app flows, migrations, optional local authentication with database login throttling, baseline security headers, responsive layouts, 1,200/10,000 dataset generation, sequential and fresh PostgreSQL buffer-pool evaluation, and expanded API contracts are implemented and verified. The open local app is running; the primary database retains its original 1,200 memories.
