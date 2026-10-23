# Practical Daily Use Design

## Intent

Extend MemoryScape from a useful local web app into a dependable daily personal memory tool. Improve capture when mobile/offline, make follow-ups easier to notice, accept common portable data, protect backup files, and keep contexts/search tidy as the archive grows.

## Goals

- Installable PWA with a cached capture shell and idempotent offline capture queue.
- Opt-in daily brief and browser notifications for due follow-ups/revisit items while the app is open.
- Preview-first imports from Markdown files, Netscape-format browser bookmark HTML, and iCalendar `.ics` events.
- Passphrase-encrypted backup export/import using Web Crypto in the browser; retain explicit plain JSON compatibility.
- Context aliases and a same-type transactional merge that preserves links, follow-ups, decisions, and aliases.
- Named saved memory searches that restore the existing database filters.

## Non-goals

- No semantic embeddings, ML, external cloud synchronization, or paid APIs.
- No claim of background notifications after the browser is closed. Initial notification checks run while an installed/open app session is active; the daily brief remains available on demand.
- No import of recurring ICS rule expansions, arbitrary note-app proprietary formats, PDF OCR, or arbitrary ZIP archives.
- No automatic deletion or merge of possible duplicates. Imports preview duplicates and require explicit confirmation.

## Constraints

- PostgreSQL remains the source of truth. API validation and parameterized SQL own persistence and deduplication.
- Offline drafts live in browser IndexedDB until synced. The UI must tell users this local queue is not encrypted by this feature; sensitive drafts should be entered after the device is back online.
- Offline sync uses a stable client UUID so retrying cannot create a second memory.
- Imports are capped at 15 MiB, preview before applying, and write transactionally.
- Backup encryption uses PBKDF2-SHA-256 and AES-256-GCM, with a random salt and IV, performed client-side. Passwords are never sent to the server.
- Context merge is limited to contexts of the same type, moves every dependent reference atomically, and does not reinforce memories.
- Saved searches are local workspace data and store only validated existing filter fields.

## Approaches

1. **Add a remote synchronization service and push worker.** This enables cross-device sync and closed-app notifications, but adds hosting, credentials, and operational dependencies that conflict with local-first use.
2. **Extend the existing PWA and PostgreSQL app.** Use IndexedDB for an offline capture outbox, browser notifications while the app is open, database-backed import/contexts/search, and browser-side backup encryption. This uses the existing stack and keeps data processing local. **Selected.**
3. **Build a separate native mobile app.** This improves OS integration but duplicates the UI and is too large for a focused extension of this project.

## Experience and behavior

- `/capture` remains the fast path. Offline submissions enter a visible pending queue, receive a UUID idempotency key, and sync when connectivity returns. A success is acknowledged only after the server confirms persistence.
- `/daily` gives a concise actionable brief from due follow-ups, decisions ready to revisit, and review candidates. Notification permission is requested only after an explicit opt-in, and the settings screen states notifications require an open app session.
- `/settings/import` previews parsed records and duplicate counts. A second explicit action imports non-duplicates. Markdown frontmatter supports title/date/tags; bookmark HTML preserves URL/title/date; ICS creates event memories from DTSTART/SUMMARY/UID.
- `/settings/backup` makes encrypted backup the primary action. The passphrase is used only in browser code. Restore decrypts locally before the existing server preview/import flow. Plain JSON stays available with an explicit unencrypted label.
- Context details can add/remove aliases and merge into another context of the same type. The merge preview reports memories/follow-ups/decisions that will move.
- The memory library can save, select, and delete named searches based on its current filters.

## Data and interfaces

- Add a nullable unique `capture_key` UUID on memories for retry-safe capture.
- Add `context_aliases(context_id, alias, normalized_alias, created_at)` with case-folded uniqueness.
- Add `saved_searches(id, name, filters jsonb, created_at, updated_at)` with validated filter payloads.
- Add validated endpoints for daily brief, import preview/apply, alias CRUD, context merge, and saved search CRUD.

## Risks and decisions

- IndexedDB drafts are readable by someone with access to the browser profile; disclose this and do not represent them as encrypted.
- AES-GCM backup restoration must reject malformed envelopes, unsupported iteration parameters, wrong passphrases, and modified ciphertext with one safe error.
- Import parsers accept only bounded UTF-8 text and explicitly supported formats. Malformed files fail with useful line/record errors, and no partial records are committed.
- Saved filter validation remains allowlisted; no user-supplied SQL or arbitrary filter keys.
