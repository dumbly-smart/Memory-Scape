# Temporal decay and reinforcement

Strength decays exponentially by elapsed UTC seconds converted to days: `S(t) = greatest(0, least(1, S0 × exp(−lambda × max(0, elapsed_seconds / 86400))))`.

`apply_memory_decay(at,id?)` is a set-based update. It updates only where `at > last_strength_at`, so the same logical timestamp is idempotent. The current value and timestamp change in one SQL statement. Reinforcement locks its memory row, first computes unapplied decay at the chosen timestamp, then applies `S′ = min(1, S + alpha × (1 − S))`, updates strength state, and records the before/after event in the same database transaction. `link_memory_context` reinforces only when a new association was inserted.

pg_cron schedules decay daily at 02:17 UTC and materialized-view refresh hourly at minute 37. The seed script explicitly refuses a nonempty memory database.
