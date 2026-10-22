# MemoryScape Remaining Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and verify the outstanding MemoryScape checklist items while preserving existing local database data.

**Architecture:** Add a backward-compatible migration for parameterized SQL coefficients, a validated API/settings UI, optional signed-cookie authentication, and evaluation/test improvements. Keep retrieval algorithms and ranking formulas in PostgreSQL.

**Tech Stack:** PostgreSQL/PostGIS/pg_cron, Next.js 15, TypeScript, Web Crypto, Vitest, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-21-memoryscape-remainder-design.md`

## Global Constraints

- PostgreSQL remains the source of truth and performs algorithm computation.
- Keep Docker ports bound to `127.0.0.1`.
- Preserve the existing named database volume and its 1,200 synthetic rows.
- No LLM, embeddings, machine-learning service, or paid API is introduced.
- Do not mark a feature tested before running its corresponding check.

## Review Focus

- Database migration reruns must preserve existing rows and re-register jobs safely.
- Invalid coefficient combinations must be rejected without partially updating parameters.
- Auth-disabled localhost operation must remain compatible; configured auth must protect API writes and reads while leaving login and health available.
- Test and benchmark fixtures must be removed without touching synthetic or user data.
- The 10,000-row result must be measured on an isolated dataset and labeled as environment-specific.

---

### Task 1: Configurable database algorithm parameters

**Files:** new migration `database/migrations/002_algorithm_parameters.sql`; modify algorithm parameter API, settings page, database tests, and docs.

**Interfaces:** singleton row stores valence factor base/salience and review strength/age weights/cap; API accepts one complete validated parameter object; PostgreSQL functions/view consume that row.

- [ ] Add SQL integration assertions for defaults, invalid values, parameterized activation, and review priority; observe failure before implementation.
- [ ] Add migration, SQL consumers, and validated GET/PUT API; observe contract pass.
- [ ] Add settings inputs and save/error state; browser test settings edit and verify API-backed values.
- [ ] Rerun migration against the existing database and verify memory count remains unchanged.

### Task 2: Optional local password authentication

**Files:** new auth helper, middleware, login page and auth routes; modify Compose env example, tests, and docs.

**Interfaces:** absent credentials means open localhost mode; configured password and session secret enable signed expiring cookies.

- [ ] Write unit tests for valid, invalid, and expired session signatures; verify missing helper behavior.
- [ ] Implement Web Crypto signing/verification, constant-time password comparison, login/logout routes, and middleware.
- [ ] Add browser coverage for redirect, successful login, protected API access, logout, and disabled mode.
- [ ] Run Next build and full Playwright suite with auth both disabled and configured.

### Task 3: Evaluation completeness and 10K run

**Files:** `scripts/evaluate.ts`, evaluation artifact docs, seed/deployment documentation.

**Interfaces:** benchmark runner reports initial materialized-view creation measured in a disposable schema, refresh, query plans, and cardinalities.

- [ ] Test evaluation artifact naming/metadata and non-destructive view-creation method.
- [ ] Implement temporary-schema view creation timing and per-dataset artifacts.
- [ ] Create a uniquely named isolated 10K database only after checking it does not exist; migrate, seed, evaluate, and verify the seed cardinality.
- [ ] Drop only the database created by this run; verify the primary database still contains its original 1,200 rows.

### Task 4: Browser coverage and documentation

**Files:** `tests/ui/*.spec.ts`, README, demo guide, methodology/results, implementation status.

- [ ] Add real browser flows for route drawing/results, graph depth/path selection, timeline filtering/reinforcement, review refresh, and algorithm parameter saving.
- [ ] Run unit, SQL contract, concurrency, authenticated/unauthenticated Playwright, production build, Compose health, and both benchmark evaluations.
- [ ] Update docs to distinguish verified behavior, measured results, and remaining limitations.
