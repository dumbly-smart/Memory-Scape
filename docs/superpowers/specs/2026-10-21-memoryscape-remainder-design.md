# MemoryScape remaining completion design

## Goal and constraints

Complete the explicitly outstanding items in `docs/IMPLEMENTATION_STATUS.md` while preserving the PostgreSQL-first architecture and localhost-only Compose deployment. No ML/vector services are introduced. Changes must migrate existing data without recreating or deleting the named PostgreSQL volume.

## Design

1. Store the valence and review-ranking coefficients in a singleton PostgreSQL settings row. Recursive recall and the fading-memory view read these parameters in SQL. A validated API and settings form update them transactionally; default values preserve existing ranking behavior.
2. Add optional single-user password authentication for deployments that set `MEMORYSCAPE_PASSWORD` and `MEMORYSCAPE_SESSION_SECRET`. With neither configured, local development remains open. When configured, login issues an HttpOnly, SameSite session cookie; middleware protects pages and APIs except health/login/static assets. No default credentials are shipped.
3. Extend evaluation to record initial materialized-view creation in a disposable benchmark schema, plus refresh and query timing. Preserve per-dataset artifacts. Run the existing deterministic 10,000-row seed in an isolated disposable database and report its actual measurements separately from the 1,200-row baseline.
4. Add browser assertions for the user-facing spatial, graph, timeline, review, settings, and login flows. Continue to use real PostgreSQL-backed endpoints and deterministic fixtures; clean up test-created rows.
5. Update setup, security, evaluation, and status documentation to match executed behavior and disclose uncovered risks.

## Safety and data handling

The existing local database volume is preserved. The 10,000-row evaluation uses a uniquely named temporary database that is created for the run and dropped only after its identity and benchmark completion are verified. If any generated database name already exists, the run aborts rather than dropping it.
