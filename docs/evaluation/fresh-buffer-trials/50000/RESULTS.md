# Fresh PostgreSQL buffer-pool trials

Captured 2026-10-26T15:09:17.743Z across 5 sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The report includes median, sample standard deviation, and a nominal two-sided 95% Student t interval for the mean.

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
| spatial_index_candidate | 58.784 | 62.316 [52.197, 72.435] | 8.151 | 3152 | 354 |
| spatial_sequential_control | 49.212 | 48.508 [46.693, 50.322] | 1.462 | 3194 | 213 |
| associative_depth_1 | 0.190 | 0.189 [0.173, 0.205] | 0.013 | 36 | 6 |
| associative_depth_2 | 0.166 | 0.163 [0.138, 0.187] | 0.020 | 66 | 4 |
| associative_depth_3 | 0.198 | 0.196 [0.188, 0.204] | 0.007 | 124 | 5 |
| fading_view | 7.493 | 7.036 [5.577, 8.495] | 1.175 | 3 | 960 |
| fading_direct | 205.908 | 215.702 [189.745, 241.660] | 20.909 | 34809 | 0 |
| timeline | 0.091 | 0.097 [0.084, 0.110] | 0.010 | 102 | 0 |

## Materialized view

- Initial creation: 376.805 ms median; mean 374.846 ms; 95% t interval [351.328, 398.365] ms; sample SD 18.944 ms.
- Refresh: 415.968 ms median; mean 423.713 ms; 95% t interval [382.074, 465.352] ms; sample SD 33.540 ms.

## Operating-system page-cache handling

Disabled. PostgreSQL shared buffers were reset by restarting the isolated server; operating-system cache was uncontrolled.

Intervals are conditional on this host and experiment. They assume independent, approximately normal restart samples and do not account for sequential ordering, host load, or hardware variation. The raw trial plans and cache-eviction request results are in [fresh-buffer-pools.json](fresh-buffer-pools.json).
