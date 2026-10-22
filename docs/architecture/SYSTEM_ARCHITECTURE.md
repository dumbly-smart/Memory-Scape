# System architecture

Next.js TypeScript interfaces call parameterized route handlers. The handlers validate request shape and use `node-postgres`; SQL routines own spatial filtering, route ordering, decay, reinforcement, graph traversal, and fading review. No ORM, embedding service, paid API, or graph database is used.

```mermaid
flowchart TD
  UI[Next.js / React] --> API[Validated API routes]
  API --> PG[(PostgreSQL 16)]
  PG --> GIS[PostGIS geography + GiST]
  PG --> DECAY[Decay / reinforcement routines]
  PG --> RCTE[Recursive associative SQL]
  PG --> MV[Fading-memory materialized view]
  CRON[pg_cron] --> DECAY
  CRON --> MV
  UI --> MAP[Leaflet + OpenStreetMap tiles]
  UI --> GRAPH[Cytoscape.js]
```

Docker Compose binds app and database ports to loopback and persists PostgreSQL data in a named volume. OSM tile retrieval needs internet access; memory data and algorithms stay local. There is no authentication: deployment beyond a trusted local machine requires authentication, authorization, TLS, and network/database access controls.
