# Fresh PostgreSQL buffer-pool trials

Captured 2026-10-26T16:07:49.468Z across 5 sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The report includes median, sample standard deviation, and a nominal two-sided 95% Student t interval for the mean.

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
| spatial_index_candidate | 173.103 | 184.176 [142.788, 225.564] | 33.338 | 3204 | 16 |
| spatial_sequential_control | 135.901 | 139.509 [120.895, 158.123] | 14.993 | 3194 | 213 |
| associative_depth_1 | 0.495 | 0.556 [0.292, 0.820] | 0.213 | 36 | 6 |
| associative_depth_2 | 0.496 | 0.488 [0.300, 0.677] | 0.152 | 66 | 4 |
| associative_depth_3 | 0.693 | 0.721 [0.538, 0.903] | 0.147 | 124 | 5 |
| fading_view | 17.801 | 19.277 [13.881, 24.674] | 4.347 | 3 | 960 |
| fading_direct | 547.513 | 626.257 [395.407, 857.108] | 185.950 | 34809 | 0 |
| timeline | 0.209 | 0.208 [0.184, 0.232] | 0.019 | 102 | 0 |

## Materialized view

- Initial creation: 1029.152 ms median; mean 1048.919 ms; 95% t interval [963.521, 1134.317] ms; sample SD 68.788 ms.
- Refresh: 1060.724 ms median; mean 1166.409 ms; 95% t interval [855.031, 1477.787] ms; sample SD 250.815 ms.

## Operating-system page-cache handling

Disabled. PostgreSQL shared buffers were reset by restarting the isolated server; operating-system cache was uncontrolled.

Intervals are conditional on this host and experiment. They assume independent, approximately normal restart samples and do not account for sequential ordering, host load, or hardware variation. The raw trial plans and cache-eviction request results are in [fresh-buffer-pools.json](fresh-buffer-pools.json).
