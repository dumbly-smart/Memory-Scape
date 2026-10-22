# Database concepts demonstrated

All items below point to the executable schema in `database/migrations/001_initial.sql`.

| Concept | Use in MemoryScape | Verification |
|---|---|---|
| 1. Relational normalization | Separate memories, contexts, edge events, and association rows | Inspect ERD and `memory_contexts` composite key |
| 2. Primary/foreign keys | Stable IDs and cascading associations | `\d memories`, `\d memory_edges` |
| 3. Check constraints | Bounded strengths, weights, valences, labels | Attempt out-of-range inserts |
| 4. Spatial data types | `geography(Point,4326)` stores Earth coordinates | `SELECT ST_SRID(location::geometry)` |
| 5. GiST indexes | Index geography corridor search | `\di memories_location_gix` |
| 6. Geographic predicates | `ST_DWithin` evaluates radius in meters | `SELECT * FROM spatial_memory_walk(...)` |
| 7. Recursive CTE | SQL graph spreading activation | `SELECT * FROM associative_recall(seed,3,.01,1)` |
| 8. Cycle detection | UUID array prevents node repetition in one path | Add a reverse edge; returned paths remain simple |
| 9. Stored routines | Decay, reinforcement, context link, spatial/graph recall | `\df apply_memory_decay` |
| 10. Transactions / ACID | Context insert and reinforcement event are atomic | Use `link_memory_context` within a transaction |
| 11. Trigger | `updated_at` advances on memory updates | Update a memory and inspect timestamp |
| 12. Scheduled jobs | pg_cron registers daily decay and hourly refresh | Query `cron.job` and `cron.job_run_details` |
| 13. Materialized view | Periodic fading queue snapshot | Query and refresh `fading_memories_mv` |
| 14. Query optimization | Spatial, temporal, text, and graph indexes | `EXPLAIN` representative functions/queries |
| 15. EXPLAIN ANALYZE | Evaluation runner records JSON plan and buffers | `npm run db:benchmark` |
| 16. Concurrency safety | `FOR UPDATE` serializes reinforcement per memory | Concurrent calls serialize and retain both history rows |

The test assertions in `tests/database/algorithms.sql` exercise executable formulas and spatial results when run using `psql -f tests/database/algorithms.sql`.
