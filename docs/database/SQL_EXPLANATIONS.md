# SQL routine explanations

- `apply_memory_decay`: one set-based `UPDATE`, advancing the strength timestamp atomically and selecting only rows with elapsed time.
- `reinforce_memory`: locks the memory row, applies pending decay, uses bounded reinforcement, and logs the before/after state in the same transaction.
- `link_memory_context`: inserts a unique typed context/link and invokes reinforcement only for a newly created link.
- `spatial_memory_walk`: converts GeoJSON to valid geography, uses meter-aware `ST_DWithin`, measures `ST_Distance`, and sorts with `ST_LineLocatePoint`.
- `associative_recall`: recursive path array tracks visited UUIDs, activation threshold prunes inside SQL recursion, and window ranking returns the strongest deterministic path.
- `refresh_fading_memories`: refreshes the uniquely indexed materialized view concurrently and updates its freshness metadata.

See the SQL definitions in the migration itself; application code invokes routines with `$n` parameters rather than interpolating input strings.
