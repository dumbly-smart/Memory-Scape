# Everyday Memory Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make MemoryScape useful for everyday capture, follow-through, and resurfacing while preserving its local-first, database-native design.

**Architecture:** Additive PostgreSQL migration and parameterized Next.js Route Handlers; React pages consume those APIs. PostgreSQL owns data integrity, nearby-place filtering, bounded graph expansion, and review eligibility. Browser capture uses a bookmarklet URL into the app, and attachments live in PostgreSQL for portable export.

**Tech Stack:** Next.js 16 App Router, strict TypeScript, React, PostgreSQL/PostGIS, node-postgres, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-everyday-memory-workflows-design.md`

## Global Constraints

- Preserve user data with additive migrations.
- Keep memory processing local and do not add ML, embeddings, or paid APIs.
- Parameterize SQL and validate all request bodies.
- Browser location is read only after a user action.
- Sensitive and archived memories are excluded from unsolicited review.
- Import is dry-run by default, transactional on apply, and never silently overwrites.
- Each slice follows test-first, verifies the failure, then verifies the passing behavior.
- Keep commits small and scoped; do not claim unexecuted tests passed.

## Review Focus

- Malformed or oversized import payloads must fail before writing any row.
- Attachment name/content-type spoofing and oversized uploads must not become executable content or exhaust storage.
- Geolocation denial must leave capture and place lookup usable without coordinates.
- Sensitive memories must stay absent from review, weekly summary, and place suggestions unless explicitly opened.
- Concurrent follow-up completion/review actions must not duplicate or resurrect work.

---

### Task 1: Capture inbox and memory importance/privacy controls

**Files:** `database/migrations/004_everyday_workflows.sql`, memory API routes, `app/capture/page.tsx`, `components/Shell.tsx`, focused unit/API/UI tests.

**Interfaces:**
- Consumes: current memory CRUD and `contexts` APIs.
- Produces: `POST /api/capture` accepting title/content/occurredAt/optional coordinates/sourceUrl/sourceTitle; `PATCH /api/memories/:id` accepting `isPinned`, `isSensitive`, `archivedAt`; capture page with content-first save.

- [ ] Test save with omitted title and optional date/location; assert title derives from first non-empty line and defaults to current time.
- [ ] Run the focused test and observe the missing behavior.
- [ ] Add nullable/defaulted migration fields and validated capture API/UI.
- [ ] Run focused API/UI tests and the production build.
- [ ] Commit `feat(capture): add quick capture inbox and privacy flags`.

### Task 2: People and project context pages with resume-work

**Files:** `app/contexts/[id]/page.tsx`, context detail API, navigation, context tests.

**Interfaces:**
- Consumes: Task 1 memory flags and existing context associations.
- Produces: `GET /api/contexts/:id` returning context, linked memories, recent memory, related open follow-ups/decisions when available, and counts.

- [ ] Test context details and reject an unknown context ID.
- [ ] Run the focused test red.
- [ ] Implement bounded context summary query and person/project page.
- [ ] Verify context page, mobile layout, and build.
- [ ] Commit `feat(contexts): add people and project workspaces`.

### Task 3: Follow-ups and resume-work actions

**Files:** migration, `/api/follow-ups` routes, context and memory detail components, follow-up tests.

**Interfaces:**
- Produces: create/list/update follow-ups with `open | done | dismissed`, optional due date, required title, and optional memory/context link.

- [ ] Test creation, due-date validation, completion, idempotent repeated completion, and orphan rejection.
- [ ] Run focused tests red.
- [ ] Implement normalized table, transactional APIs, and UI controls.
- [ ] Verify SQL/API/UI behavior and build.
- [ ] Commit `feat(follow-ups): track actions from memories`.

### Task 4: Decision records

**Files:** migration, `/api/decisions` routes, decision UI, tests.

**Interfaces:**
- Produces: records for choice, rationale, alternatives, decided/revisit dates, and optional memory/context links.

- [ ] Test required choice/rationale, link integrity, and date ordering.
- [ ] Run focused tests red.
- [ ] Implement API and create/list/edit/detail workflows.
- [ ] Verify and commit `feat(decisions): record choices and revisit dates`.

### Task 5: User-triggered place reminders and nearby recall

**Files:** migration, PostGIS query/function, `/api/places/nearby` and reminder routes, map/nearby page, tests.

**Interfaces:**
- Produces: saved point/radius reminder; user-triggered nearby lookup returning eligible memories/reminders ordered by meter distance.

- [ ] Test radius validation, meter boundary, sensitive/archived exclusion, and no-coordinate behavior.
- [ ] Run database/API test red.
- [ ] Implement PostGIS indexed query and UI with explicit geolocation action.
- [ ] Verify SQL and browser flow.
- [ ] Commit `feat(spatial): add user-triggered place reminders`.

### Task 6: Browser bookmarklet capture

**Files:** capture query handling, bookmarklet component, tests/docs.

**Interfaces:**
- Produces: bookmarklet link that opens `/capture?url=...&title=...&text=...`; capture form validates and previews parameters before save.

- [ ] Test URL sanitization, hostile schemes, and selected-text length caps.
- [ ] Run focused test red.
- [ ] Implement bookmarklet and capture prefill.
- [ ] Verify generated link and browser capture flow.
- [ ] Commit `feat(capture): add browser bookmarklet`.

### Task 7: Attachments and searchable sources

**Files:** migration, attachment API routes, memory detail UI, tests.

**Interfaces:**
- Produces: upload/list/download/delete attachment routes; maximum 10 MiB per file; content hash, original display name, media type, and extracted plain-text description where provided.

- [ ] Test size boundary, invalid memory, hash stability, and safe download headers.
- [ ] Run focused tests red.
- [ ] Implement bytea storage with parameterized SQL and bounded upload parsing.
- [ ] Verify upload/download/delete against PostgreSQL and build.
- [ ] Commit `feat(attachments): store and retrieve memory files`.

### Task 8: Weekly review with explicit review actions

**Files:** migration, `/api/review/weekly`, review UI, tests.

**Interfaces:**
- Produces: weekly group of overdue follow-ups, recent memories, pinned memories, and fading memories; actions `keep | snooze | archive | dismiss` persist per item.

- [ ] Test sensitive/archive filters, snooze expiry, and action idempotency.
- [ ] Run tests red.
- [ ] Implement database-backed query and UI actions.
- [ ] Verify and commit `feat(review): add weekly review workflow`.

### Task 9: Versioned export and safe import/restore

**Files:** export/import API routes, validation module, UI, round-trip tests/docs.

**Interfaces:**
- Produces: versioned JSON export for memories, contexts, joins, edges, reinforcement history, follow-ups, decisions, attachments, reminders, and review actions; import dry-run and explicit transactional apply.

- [ ] Test round-trip, malformed documents, duplicate IDs, foreign-key failures, and rollback.
- [ ] Run tests red against isolated DB fixtures.
- [ ] Implement dry-run reporting and atomic import with collision-safe behavior.
- [ ] Verify round-trip and commit `feat(data): add portable export and restore`.

### Task 10: Seed-centered graph exploration and configurable map tiles

**Files:** bounded graph API/query, graph page, settings API/page, map component, tests/docs.

**Interfaces:**
- Produces: bounded seed-centered subgraph API (depth 1–3, hard node/edge cap) and validated local tile URL setting.

- [ ] Test node/edge cap, depth boundaries, cyclic paths, and tile URL schemes.
- [ ] Run focused tests red.
- [ ] Implement SQL subgraph loading and map tile configuration.
- [ ] Verify graph and map pages at desktop/mobile widths.
- [ ] Commit `feat(exploration): scale graph and configure local map tiles`.

### Task 11: Documentation and final validation

**Files:** `README.md`, `docs/IMPLEMENTATION_STATUS.md`, workflow documentation, SQL/API docs, Playwright coverage.

- [ ] Update demo workflow and limits for all added features.
- [ ] Run unit, database integration, browser, TypeScript, and production-build checks that are available.
- [ ] Record exact passed/blocked commands; do not overstate implementation or research validity.
- [ ] Commit `docs: document everyday memory workflows`.

## Coverage review

All ten requested daily-use feature ideas are represented: capture, place reminders, people pages, follow-ups, browser capture, project workspaces, decision records, weekly review, attachments/search, and export/backup portability. Privacy controls, bounded graph scaling, and local tile configuration are included as cross-cutting tasks. External backup retention and an actual offline tile server remain deployment configuration; this plan supplies portable data and a configurable tile source.
