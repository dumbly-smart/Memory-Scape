# Evaluation results

Captured 2026-10-21T16:07:42.411Z over 5 sequential runs. Values are median ± sample standard deviation; timing units are milliseconds.

## Environment

- PostgreSQL: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- PostGIS: POSTGIS="3.6.4 94d984b" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" (compiled against GEOS 3.13.1) PROJ="9.8.1 NETWORK_ENABLED=OFF URL_ENDPOINT=https://cdn.proj.org USER_WRITABLE_DIRECTORY=/var/lib/postgresql/.local/share/proj DATABASE_PATH=/usr/share/proj/proj.db" (compiled against PROJ 9.6.0) LIBXML="2.9.14" LIBJSON="0.18" LIBPROTOBUF="1.5.1" WAGYU="0.5.0 (Internal)" TOPOLOGY
- Memories: 1200; edges: 7832
- Host: linux x64, 24 CPUs; Node v26.12.0
- Parameters: 150 m route radius; recursive pruning threshold 0.01; 5 repetitions per query.

## Query plans

| Query | Planning ms (median ± SD) | Execution ms (median ± SD) | Execution mean ms | Actual rows median |
|---|---:|---:|---:|---:|
| spatial_index_candidate | 0.520 ± 0.810 ms | 1.942 ± 4.604 ms | 4.062 | 346 |
| spatial_sequential_control | 0.464 ± 0.385 ms | 2.169 ± 1.156 ms | 2.706 | 346 |
| associative_depth_1 | 0.927 ± 1.380 ms | 0.879 ± 1.062 ms | 1.400 | 10 |
| associative_depth_2 | 0.901 ± 0.461 ms | 1.291 ± 0.698 ms | 1.624 | 28 |
| associative_depth_3 | 0.863 ± 0.288 ms | 2.106 ± 1.683 ms | 3.018 | 45 |
| fading_view | 0.113 ± 0.061 ms | 0.470 ± 0.075 ms | 0.456 | 100 |
| fading_direct | 0.096 ± 0.023 ms | 1.292 ± 0.123 ms | 1.310 | 100 |
| timeline | 0.089 ± 0.014 ms | 0.072 ± 0.007 ms | 0.072 | 100 |

## Materialized view

- Initial creation: 30.011 ± 0.796 ms (temporary generated schema dropped transactionally).
- Refresh: 37.445 ± 19.992 ms.

Each repetition runs sequentially in one database session, so these are repeated observations with changing cache state, not independent cold-start samples. The spatial comparison disables index and bitmap scans at the session level without dropping production indexes. Full plans and per-run values are in [latest-1200.json](latest-1200.json). Results depend on dataset selectivity, planner choices, cache state, host load, and hardware.
