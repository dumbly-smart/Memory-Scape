# Everyday Memory Workflows — Design

## Intent

Extend MemoryScape from a research demonstration into a local-first tool people can use for real personal work. Make capture fast, give memories useful follow-through, and resurface them when a person, project, place, or review moment makes them relevant.

## Goals

- Capture a memory with minimal required input, current time by default, and optional location.
- Organize memories through existing Person and Project contexts, with focused context pages and a resume-work view.
- Attach follow-ups, decision records, and files to memories or contexts.
- Offer a user-triggered place lookup and a weekly review with explicit user choices.
- Capture selected browser text through a bookmarklet into the local app.
- Support readable export and validated, non-overwriting import with attachment integrity checks.
- Separate importance and privacy from recall strength using pin and sensitive/review-exclusion controls.
- Scale graph exploration around a selected seed and permit local tile-server configuration.

## Non-goals

- Background location tracking or automatic surveillance.
- Cloud sync, shared workspaces, or required third-party services.
- Semantic embeddings, LLM retrieval, or a separate graph database.
- Claims that pinning, review priority, or recall strength are validated cognitive measures.
- A published browser-store extension; the bookmarklet is the first browser capture surface.

## Constraints

- Keep PostgreSQL as the source of truth; SQL owns proximity, review selection, and graph traversal.
- Preserve existing memories and apply only additive migrations.
- Use parameterized SQL and runtime validation in Next.js Route Handlers.
- Keep the app local-first and avoid requiring paid APIs.
- Do not surface sensitive memories in review or place suggestions unless the user explicitly opens them.
- Imports must default to dry-run and reject ID collisions unless the user chooses an explicit merge mode.
- Location is read only after a user action and browser permission.

## Approaches

1. **Separate applications per feature.** Rejected because it fragments capture and makes people repeat context.
2. **Add all workflows to the current app with one additive data layer.** Selected: current `memories`, `contexts`, and Postgres APIs already provide the common spine; a small number of tables and focused routes keep workflows connected and reviewable.
3. **Move user data to external services for attachments, reminders, and browser capture.** Rejected because the project is local-first and should work without paid APIs or remote processing.

## Product behavior

- Quick capture accepts content/title, defaults occurrence time to now, and leaves place/context optional. Empty title is derived from the first non-empty content line on save.
- A context page shows linked memories, open follow-ups, decisions, and a resume-work summary. Person and Project are the first focused context types.
- Follow-ups have open, done, and dismissed states, optional due date, and a source memory/context. Weekly review groups overdue follow-ups, recent memories, pinned items, and eligible fading memories; sensitive and archived memories are excluded. Users can keep, snooze, archive, or dismiss review items.
- Decision records store the choice, rationale, alternatives, date, revisit date, and optional links to memories and contexts.
- Place recall is initiated by the user. PostgreSQL returns nearby memories and reminders in distance order. Browser geolocation is not polled in the background.
- The bookmarklet passes page URL, title, and selected text to a local capture page; the user reviews and saves the draft.
- Attachments are size-limited, stored as PostgreSQL `bytea`, identified by SHA-256, and downloaded only through an authenticated app route when auth is enabled.
- Export is versioned JSON. Import validates the complete payload, reports counts/conflicts in dry-run, and commits atomically only when valid. Existing rows are never silently overwritten.
- Pinning is an importance signal. Sensitive/exclude-from-review is a separate privacy control. Neither changes temporal strength or associative activation.
- Graph exploration loads a bounded SQL subgraph centered on a selected seed, with explicit expansion limits. The map tile URL is configurable, including a local tile-server URL; an empty value disables tiles while preserving map-derived interaction only when configured.

## Data and implementation decisions

- Add `is_pinned`, `is_sensitive`, and `archived_at` to memories.
- Add normalized `follow_ups`, `decisions`, `memory_attachments`, `place_reminders`, and `review_actions` tables with foreign keys and indexes.
- Keep contexts as the canonical people/project records; avoid duplicate people or project tables.
- Use a capped local-first upload size and SQL bytea storage so export/backup remains self-contained.
- Use database procedures/transactions for operations that update multiple related records.
- Keep the existing anonymous-local mode and optional password gate; every new API route follows the existing auth middleware behavior.

## Success checks

- A user can save an untitled thought in a few fields without assigning a place or context.
- A person/project page can restore the most recent working context and show its open follow-ups.
- A user action can find relevant memories at their current location without background location access.
- Weekly review respects sensitive, pinned, archived, and explicit user review actions.
- Export/import round-trips all supported entities and attachment hashes; invalid or conflicting imports leave the database unchanged.
- Graph requests remain bounded and return paths/edges from SQL.
- Local tile URLs are configurable without rebuilding the app.

## Rollout

Implement in small, independently verified commits. First deliver the additive schema and capture/privacy foundation, then each connected workflow, then export/recovery, scaling and map configuration. Update `docs/IMPLEMENTATION_STATUS.md` after each verified slice. Features that require external infrastructure (a local tile server, OS-level backup retention, or a browser bookmarklet installation action) must be clearly documented.
