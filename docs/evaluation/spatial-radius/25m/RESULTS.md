# Fresh PostgreSQL buffer-pool trials

Captured 2026-10-26T16:06:34.336Z across 5 sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The report includes median, sample standard deviation, and a nominal two-sided 95% Student t interval for the mean.

## Environment

- Machine: archlinux
- PostgreSQL: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- PostGIS: POSTGIS="3.6.4 94d984b" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" (compiled against GEOS 3.13.1) PROJ="9.8.1 NETWORK_ENABLED=OFF URL_ENDPOINT=https://cdn.proj.org USER_WRITABLE_DIRECTORY=/var/lib/postgresql/.local/share/proj DATABASE_PATH=/usr/share/proj/proj.db" (compiled against PROJ 9.6.0) LIBXML="2.9.14" LIBJSON="0.18" LIBPROTOBUF="1.5.1" WAGYU="0.5.0 (Internal)" TOPOLOGY
- Memories: 50000
- Trials: 5
- Cache strategy: postgres_restart_only
- Parameters: 150 m route radius, recursion threshold 0.01, depths 1–3

## Query measurements

| Query | Execution median (ms) | Mean (95% t interval, ms) | Sample SD (ms) | Shared hits median | Shared reads median |
|---|---:|---:|---:|---:|---:|
| spatial_index_candidate | 123.458 | 125.316 [111.938, 138.694] | 10.776 | 3152 | 169 |
| spatial_sequential_control | 132.101 | 131.108 [118.911, 143.305] | 9.825 | 3194 | 213 |
| associative_depth_1 | 0.470 | 0.476 [0.415, 0.536] | 0.049 | 36 | 6 |
| associative_depth_2 | 0.444 | 0.471 [0.304, 0.637] | 0.134 | 66 | 4 |
| associative_depth_3 | 0.592 | 0.557 [0.406, 0.707] | 0.121 | 124 | 5 |
| fading_view | 18.439 | 19.006 [15.081, 22.931] | 3.161 | 3 | 960 |
| fading_direct | 541.626 | 541.226 [504.079, 578.372] | 29.921 | 34809 | 0 |
| timeline | 0.194 | 0.226 [0.118, 0.335] | 0.087 | 102 | 0 |

## Materialized view

- Initial creation: 933.945 ms median; mean 943.267 ms; 95% t interval [901.170, 985.363] ms; sample SD 33.909 ms.
- Refresh: 1003.471 ms median; mean 1030.332 ms; 95% t interval [941.447, 1119.217] ms; sample SD 71.597 ms.

## Operating-system page-cache handling

Disabled. PostgreSQL shared buffers were reset by restarting the isolated server; operating-system cache was uncontrolled.

Intervals are conditional on this host and experiment. They assume independent, approximately normal restart samples and do not account for sequential ordering, host load, or hardware variation. The raw trial plans and cache-eviction request results are in [fresh-buffer-pools.json](fresh-buffer-pools.json).
