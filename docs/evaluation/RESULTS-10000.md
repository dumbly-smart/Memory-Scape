# Evaluation results

Captured 2026-10-21T16:08:54.526Z over 5 sequential runs. Values are median ± sample standard deviation; timing units are milliseconds.

## Environment

- PostgreSQL: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- PostGIS: POSTGIS="3.6.4 94d984b" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" (compiled against GEOS 3.13.1) PROJ="9.8.1 NETWORK_ENABLED=OFF URL_ENDPOINT=https://cdn.proj.org USER_WRITABLE_DIRECTORY=/var/lib/postgresql/.local/share/proj DATABASE_PATH=/usr/share/proj/proj.db" (compiled against PROJ 9.6.0) LIBXML="2.9.14" LIBJSON="0.18" LIBPROTOBUF="1.5.1" WAGYU="0.5.0 (Internal)" TOPOLOGY
- Memories: 10000; edges: 26615
- Host: linux x64, 24 CPUs; Node v26.12.0
- Parameters: 150 m route radius; recursive pruning threshold 0.01; 5 repetitions per query.

## Query plans

| Query | Planning ms (median ± SD) | Execution ms (median ± SD) | Execution mean ms | Actual rows median |
|---|---:|---:|---:|---:|
| spatial_index_candidate | 3.656 ± 0.723 ms | 20.006 ± 11.229 ms | 25.597 | 2875 |
| spatial_sequential_control | 3.315 ± 0.414 ms | 21.933 ± 1.758 ms | 22.496 | 2875 |
| associative_depth_1 | 1.336 ± 0.275 ms | 0.212 ± 0.061 ms | 0.210 | 2 |
| associative_depth_2 | 0.952 ± 0.136 ms | 0.223 ± 0.076 ms | 0.249 | 6 |
| associative_depth_3 | 1.044 ± 0.167 ms | 0.318 ± 0.061 ms | 0.348 | 12 |
| fading_view | 0.120 ± 0.031 ms | 1.988 ± 0.413 ms | 2.066 | 100 |
| fading_direct | 0.120 ± 0.024 ms | 129.392 ± 23.445 ms | 139.561 | 100 |
| timeline | 0.093 ± 0.006 ms | 0.107 ± 0.029 ms | 0.120 | 100 |

## Materialized view

- Initial creation: 372.272 ± 17.093 ms (temporary generated schema dropped transactionally).
- Refresh: 363.177 ± 2.801 ms.

Each repetition runs sequentially in one database session, so these are repeated observations with changing cache state, not independent cold-start samples. The spatial comparison disables index and bitmap scans at the session level without dropping production indexes. Full plans and per-run values are in [latest-10000.json](latest-10000.json). Results depend on dataset selectivity, planner choices, cache state, host load, and hardware.
