# Research Evaluation Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add synthetic-ground-truth ablation, calibration and robustness evaluation plus spatiotemporal recall and alternate activation path explanations.

**Architecture:** PostgreSQL owns combined spatial/time filtering and recursive path scoring. A TypeScript harness creates labeled fixtures inside a rollback-only transaction, calls database functions, and writes observed metrics. Thin validated APIs expose the new queries; existing pages visualize results.

**Tech Stack:** PostgreSQL/PostGIS, SQL migrations, Next.js route handlers, TypeScript, Vitest, PostgreSQL integration tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-research-evaluation-design.md`

## Global Constraints

- No ML, embeddings, or vector database.
- Never mutate persisted user memories during research evaluation.
- Maximum associative depth is three; path results and experiment fixture sizes are bounded.
- Use parameterized SQL and runtime validation.
- All reported benchmark values must come from execution, with synthetic-only limitations stated.

## Review Focus

- Rollback on thrown query or report-write error: integration test compares memory/edge/context counts before and after.
- Half-open event interval boundaries and missing coordinates: SQL integration tests include exact start/end and NULL locations.
- Cyclic and converging graph paths: integration tests assert no repeated node and stable score/order.
- Corruption reproducibility: same seed yields identical labels and recall metrics; a different seed changes perturbations.
- Invalid route, time range, depth, threshold, or path count: API/SQL contract tests assert rejection.

---

### Task 1: Database research primitives

**Files:**
- Create: `database/migrations/013_research_recall.sql`
- Modify: `scripts/migrate.ts` only if migration discovery requires it.
- Test: `tests/database/research-recall.test.ts`
- Test: `tests/database/research-recall.sql`

**Interfaces:** `spatiotemporal_memory_walk(jsonb,float8,timestamptz,timestamptz)`; `associative_recall_paths(uuid,uuid,int,float8,int)`.

- [x] Write failing DB integration contracts for interval intersection, ordered route results, alternate path formula/order, cycle prevention, max-depth/path limits, and malformed inputs.
- [x] Run the tests and confirm the missing functions are the failure.
- [x] Implement migration functions using geography distance, `ST_LineLocatePoint`, half-open time range, recursive path arrays, threshold pruning, and deterministic limits.
- [x] Run SQL contracts and DB integration tests.

### Task 2: Validated APIs and research controls

**Files:**
- Create: `app/api/spatiotemporal/walk/route.ts`
- Create: `app/api/associative/paths/route.ts`
- Modify: `app/spatial/page.tsx`, `app/graph/page.tsx`
- Test: `tests/api/research-recall.test.ts`, `tests/ui/research-recall.spec.ts`

- [x] Add failing API/browser tests for date constrained walk and alternate-path selection.
- [x] Implement Zod-validated API calls to the migration functions.
- [x] Add date-window controls and ordered results to the spatial page.
- [x] Add a selected-target alternate-path list and score explanation to graph recall.
- [x] Run focused API and browser tests.

### Task 3: Metric and fixture contracts

**Files:**
- Create: `lib/research/metrics.ts`
- Create: `lib/research/fixture.ts`
- Test: `tests/research/metrics.test.ts`, `tests/database/research-fixture.test.ts`

- [x] Write tests for precision/recall/F1/MRR with empty results, ties, and exact known labels.
- [x] Write deterministic fixture contract for directed paths, spatial clusters, time windows, and explicit expected targets.
- [x] Implement pure metric calculation and fixed-seed fixture descriptions.
- [x] Run focused unit and database fixture tests.

### Task 4: Ablation, calibration, and robustness runner

**Files:**
- Create: `scripts/evaluate-research.ts`
- Create: `lib/research/experiment.ts`
- Modify: `package.json`
- Create: `tests/database/research-evaluation.test.ts`

- [x] Add failing integration tests that assert all scenarios are present and database counts survive rollback.
- [x] Implement baseline and edge-weight/strength/valence/depth ablations; apply 1/7/30 day exponential decay through `apply_memory_decay`; run salience/pruning sweeps, location noise/missingness, and edge-removal experiments against production SQL.
- [x] Persist JSON and Markdown results only after transaction rollback; include version, fixture seed, parameters, timings, metrics, and synthetic-only caveat.
- [x] Add `npm run research:evaluate` with a rollback-only transaction against the configured database.
- [x] Run the command and preserve actual generated artifacts.

### Task 5: Documentation and verification

**Files:**
- Modify: `docs/evaluation/METHODOLOGY.md`, `docs/evaluation/RESULTS.md`, `docs/IMPLEMENTATION_STATUS.md`, `README.md`, `docs/algorithms/SPATIAL_RECALL.md`, `docs/algorithms/SPREADING_ACTIVATION.md`

- [x] Document experiment design, equations, fixture labeling, runtime behavior, and limitations.
- [x] Run unit tests, SQL/database integration tests, typecheck, production build, focused UI tests, and full browser suite where available.
- [x] Record only freshly measured outcomes; mark external/human validation separately.
- [x] Review `git diff --check` and commit in small logical changes.
