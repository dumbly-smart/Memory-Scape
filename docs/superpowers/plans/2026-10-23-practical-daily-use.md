# Practical Daily Use Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make MemoryScape convenient for daily personal use through offline capture, actionable reminders, portable imports, encrypted backups, context cleanup, and saved searches.

**Architecture:** Keep PostgreSQL as the persistence and query authority. Add small client modules for browser-only storage/crypto/notifications, validated Next.js route handlers for database work, and extend the existing capture, settings, context, and library screens.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, PostgreSQL/PostGIS, node-postgres, Zod, IndexedDB, Web Crypto, Web Notifications, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-practical-daily-use-design.md`

## Global Constraints

- Do not introduce ML, embeddings, paid services, external sync, or a separate mobile application.
- Offline queue payloads must be authenticated ciphertext in IndexedDB; the local passphrase is never persisted or sent to the server.
- All imports preview first, skip/report duplicates, and apply in one transaction.
- Encrypted backups use PBKDF2-SHA-256 and AES-256-GCM; passphrases remain client-side.
- Context merges only combine matching types and preserve all dependent records without reinforcement.
- Keep existing data; use additive migrations 010 and 011.
- Commit and push each independently verified feature slice.

## Review Focus

- Offline retries must not create duplicate memories: test repeated sync with one client key.
- Imported HTML/ICS/Markdown can be malformed or oversized: test validation, useful errors, and no partial writes.
- Context merge can encounter duplicate links and duplicate aliases: test conflict-safe consolidation and FK preservation.
- Backup ciphertext may be corrupt or use a wrong passphrase: test authentication failure and no plaintext/import side effect.
- Browser notification APIs may be unavailable or denied: test opt-in gating and graceful fallback.

---

### Task 1: Additive storage contracts

**Files:** `database/migrations/010_daily_use.sql`; `app/api/capture/route.ts`; `tests/database/...`; `tests/ui/...`.

- [x] Test duplicate `captureKey` returns the original memory, alias normalization is unique, and saved searches require valid JSON/filter shape.
- [x] Run tests to verify they fail before implementation.
- [x] Add nullable unique memory capture key, context aliases, and named saved-search tables/indexes; add idempotent capture insert behavior.
- [x] Run migration and focused integration tests, then commit/push.

### Task 2: Installable offline capture

**Files:** `app/manifest.ts`; `public/service-worker.js`; `lib/offline-capture.ts`; `components/OfflineCaptureStatus.tsx`; `app/capture/page.tsx`; `tests/capture/...`; Playwright capture tests.

- [x] Test IndexedDB enqueue/list/remove/sync semantics with real IndexedDB implementation where available and browser coverage for offline/online retry.
- [x] Add PWA manifest/service-worker registration and cache the capture shell/static chunks.
- [x] Store drafts in an IndexedDB outbox with stable UUID keys; sync on reconnect, retain failed items, and show queue state.
- [x] Run focused unit/browser checks, then commit/push.

### Task 3: Daily brief and opt-in notifications

**Files:** app/api/daily/route.ts; app/daily/page.tsx; components/Shell.tsx; tests/ui/daily-brief.spec.ts.

- [x] Test brief inclusion/exclusion for overdue and due-soon follow-ups, revisit decisions, and sensitive/archived memories.
- [x] Implement a parameterized DB query with a bounded date window; add an actionable `/daily` page.
- [x] Add opt-in in-page notifications and a separate Web Push subscription flow for background reminders.
- [x] Verify permission-denied/unsupported handling and commit/push.

### Task 4: Markdown, bookmark, and iCalendar import

**Files:** lib/text-import.ts; app/api/import/text/route.ts; app/settings/import/page.tsx; parser, API, and browser tests.

- [x] Test Markdown frontmatter, Netscape bookmarks, ICS unfolded lines/date formats, malformed input, limits, duplicate detection, and rollback.
- [x] Implement parsers for bounded UTF-8 `.md`/`.txt`, Netscape `.html`, and `.ics` files; produce validated records.
- [x] Implement preview/apply route; duplicate detection is database-side and all writes are transactional.
- [x] Add file-selection preview and explicit apply UI; verify each format end-to-end and commit/push.

### Task 5: Encrypted backup

**Files:** `lib/backup-crypto.ts`; `app/settings/backup/page.tsx`; Vitest crypto tests; Playwright backup tests.

- [x] Test encrypt/decrypt round trip, random salt/IV, wrong passphrase, tamper detection, and malformed envelopes.
- [x] Implement versioned Web Crypto envelope using PBKDF2-SHA-256 (310,000 iterations) and AES-256-GCM.
- [x] Make encrypted export and encrypted restore primary UI flows; keep plain JSON clearly labeled as unencrypted and preserve older JSON imports.
- [x] Verify browser round trip and run existing backup integration tests, then commit/push.

### Task 6: Context aliases and transactional merge

**Files:** database/migrations/011_context_aliases.sql; app/api/contexts/[id]/aliases/route.ts; alias delete route; app/api/contexts/merge/route.ts; app/contexts/[id]/page.tsx; Vitest/API/UI tests.

- [x] Test alias normalization/collision, invalid same-context or cross-type merge, duplicate memory links, and reference migration for follow-ups/decisions.
- [x] Implement alias CRUD and a same-type merge transaction with row locks, deduplicated links, moved dependent references, and alias consolidation.
- [x] Add merge preview/confirm and alias controls to context details.
- [x] Run database/browser tests and commit/push.

### Task 7: Saved searches

**Files:** `app/api/saved-searches/route.ts`; `app/api/saved-searches/[id]/route.ts`; `components/MemoryLibrary.tsx`; `tests/ui/saved-searches.spec.ts`.

- [x] Test save/apply/delete, maximum-name/filter validation, and workspace persistence against PostgreSQL.
- [x] Implement CRUD with explicit filter allowlist; store the current library filters and restore them on selection.
- [x] Verify the browser flow and commit/push.

### Task 8: Integrated verification and docs

**Files:** `README.md`; `docs/DEMO_GUIDE.md`; `docs/IMPLEMENTATION_STATUS.md`.

- [x] Run unit tests, database contracts, all Chromium tests, TypeScript, production build, migration, and Docker health checks.
- [x] Restore/clean only test-created fixtures and verify the existing 1,200-memory seed remains intact.
- [x] Document exact offline privacy, browser notification limits, supported import formats, encryption, merge semantics, and saved-search behavior.
- [x] Commit/push final docs and confirm clean branch.

### Task 9: Close the remaining daily-use limitations

**Files:** `lib/offline-capture.ts`; `app/capture/page.tsx`; `lib/text-import.ts`; `lib/backup-crypto.ts`; `app/settings/backup/page.tsx`; `app/daily/page.tsx`; `lib/push/service.ts`; push API routes; migration 012; service worker and integration tests.

- [x] Expand bounded iCalendar recurrence rules, exclusions, and dates; cap finite expansion and bound unending rules to a one-year window on either side of import time.
- [x] Encrypt queued notes, migrate older plaintext queue entries when unlocked, verify wrong-key retention, and provide explicit confirmed discard when the key is lost.
- [x] Add stored VAPID configuration, opt-in/revocable subscriptions, minute scheduler, sensitive-memory filtering, idempotent delivery, and service-worker notification/click handling.
- [x] Wrap a random backup content key with both the passphrase and a separately displayed recovery key; continue restoring prior v1 files with their passphrase.
- [x] Add unit, database integration, browser, build, and deployment verification; update README, schema, demo guide, implementation status, and this plan.
