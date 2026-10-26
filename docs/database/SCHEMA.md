# Database schema

The repeatable initial schema is implemented in [`001_initial.sql`](../../database/migrations/001_initial.sql).

| Relation | Purpose | Key integrity rules |
|---|---|---|
| `memories` | Episodes with event time, optional WGS84 location, current strength and decay state | UUID PK; nonempty 1–240 character title; strength [0,1]; decay ≥ 0 |
| `contexts` | Reusable typed labels | Unique `(type,label)`; category allowlist |
| `memory_contexts` | Normalized many-to-many link | Composite PK; both FKs cascade on delete |
| `memory_edges` | Directed associative edges | FKs cascade; unique `(src,dst,edge_type)`; no self edge; bounded weight/valence |
| `memory_reinforcements` | Auditable strength changes | FK cascade; before/after [0,1] |
| `fading_memories_mv` | Snapshot of weak memories and context labels | Refreshed hourly; unique memory ID index enables concurrent refresh |
| `system_metadata` | Materialized-view snapshot timestamp | Key/value PK |

Important indexes: GiST over geography for `ST_DWithin`; B-tree on event time, strength, graph source/destination, reinforcement history; GIN over English text search; context link indexes for both traversal directions.

Memory event time (`occurred_at`) is separate from strength state time (`last_strength_at`). Strength operations update the latter but preserve the former.

## Daily-use persistence additions

Migration 010 adds nullable `memories.capture_key` with a partial unique index for retry-safe offline capture, `context_aliases` for normalized alternate names, and `saved_searches` for named JSON filter sets. Migration 011 makes normalized aliases globally unique and updates `link_memory_context` to resolve aliases of the requested context type. Migration 012 stores generated Web Push VAPID configuration, browser subscription endpoints/keys, and per-subscription delivery receipts. Migration 013 adds `spatiotemporal_memory_walk` and `associative_recall_paths`, database routines for combined corridor/time filtering and ranked simple-path scoring. Context merging transfers memory links, follow-ups, decisions, and aliases transactionally; the source context is removed after transfer.
