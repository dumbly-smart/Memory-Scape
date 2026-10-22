# Demonstration guide

1. Start with `docker compose up --build`; load 1,200 synthetic memories using `docker compose exec web npm run db:seed`.
2. Capture a memory in **Memory library**. Coordinates are optional; the event timestamp and strength are visible separately from `last_strength_at` in the detail API.
3. Open **Spatial memory walk**, click two or more route points around the campus map, choose a meter radius, then run the search. Result order and distances come from PostGIS.
4. On **Timeline**, apply decay and compare event time with the strength update time. Reinforcement writes a history record through the SQL routine.
5. In **Associative graph**, select a seed, choose depth 1–3 and a pruning threshold, and inspect each strongest path and its relationship weights/valences.
6. Open **Memory review**, inspect the materialized snapshot timestamp, reinforce a memory, and refresh the snapshot.
7. Run `docker compose exec web npm run db:benchmark` to capture query plans and actual execution timings in `docs/evaluation/`.

Manual maintenance endpoints are enabled by default only for this local Compose prototype (`ALLOW_MANUAL_MAINTENANCE=true`). Set false to disable refresh controls. Do not expose the application without authentication and access controls.
