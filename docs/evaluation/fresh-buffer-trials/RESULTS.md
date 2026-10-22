# Fresh PostgreSQL buffer-pool trials

Captured 2026-10-22T12:09:56.329Z across 5 sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The timing summary reports median and sample standard deviation across those restarts.

## Environment

- PostgreSQL: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- PostGIS: POSTGIS="3.6.4 94d984b" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" (compiled against GEOS 3.13.1) PROJ="9.8.1 NETWORK_ENABLED=OFF URL_ENDPOINT=https://cdn.proj.org USER_WRITABLE_DIRECTORY=/var/lib/postgresql/.local/share/proj DATABASE_PATH=/usr/share/proj/proj.db" (compiled against PROJ 9.6.0) LIBXML="2.9.14" LIBJSON="0.18" LIBPROTOBUF="1.5.1" WAGYU="0.5.0 (Internal)" TOPOLOGY
- Memories: 1200
- Trials: 5
- Parameters: 150 m route radius, recursion threshold 0.01, depths 1–3

## Query measurements

| Query | Execution median (ms) | Sample SD (ms) | Shared hits median | Shared reads median |
|---|---:|---:|---:|---:|
| spatial_index_candidate | 3.200 | 0.769 | 269 | 24 |
| spatial_sequential_control | 1.261 | 0.400 | 53 | 0 |
| associative_depth_1 | 0.438 | 0.039 | 77 | 5 |
| associative_depth_2 | 0.375 | 0.016 | 93 | 2 |
| associative_depth_3 | 0.368 | 0.012 | 130 | 1 |
| fading_view | 0.360 | 0.041 | 3 | 32 |
| fading_direct | 0.711 | 0.033 | 54 | 0 |
| timeline | 0.035 | 0.002 | 102 | 0 |

## Materialized view

- Initial creation: 17.215 ms median; 2.212 ms sample SD.
- Refresh: 34.099 ms median; 8.675 ms sample SD.

The script restarts only a disposable, separately named database container and removes that container and its temporary volume at completion. PostgreSQL shared buffers start empty at each trial. The operating-system file cache remains uncontrolled, so these are not cold-disk measurements. All trials use one host and run sequentially. Raw plans and individual measurements are in [fresh-buffer-pools.json](fresh-buffer-pools.json).
