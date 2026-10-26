# Fresh PostgreSQL buffer-pool trials

Captured 2026-10-26T10:25:33.880Z across 5 sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The report includes median, sample standard deviation, and a nominal two-sided 95% Student t interval for the mean.

## Environment

- Machine: archlinux-10k
- PostgreSQL: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- PostGIS: POSTGIS="3.6.4 94d984b" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" (compiled against GEOS 3.13.1) PROJ="9.8.1 NETWORK_ENABLED=OFF URL_ENDPOINT=https://cdn.proj.org USER_WRITABLE_DIRECTORY=/var/lib/postgresql/.local/share/proj DATABASE_PATH=/usr/share/proj/proj.db" (compiled against PROJ 9.6.0) LIBXML="2.9.14" LIBJSON="0.18" LIBPROTOBUF="1.5.1" WAGYU="0.5.0 (Internal)" TOPOLOGY
- Memories: 10000
- Trials: 5
- Cache strategy: postgres_restart_only
- Parameters: 150 m route radius, recursion threshold 0.01, depths 1–3

## Query measurements

| Query | Execution median (ms) | Mean (95% t interval, ms) | Sample SD (ms) | Shared hits median | Shared reads median |
|---|---:|---:|---:|---:|---:|
| spatial_index_candidate | 57.510 | 61.167 [45.190, 77.144] | 12.869 | 670 | 80 |
| spatial_sequential_control | 25.203 | 29.486 [16.914, 42.058] | 10.127 | 455 | 0 |
| associative_depth_1 | 0.405 | 0.437 [0.283, 0.591] | 0.124 | 31 | 4 |
| associative_depth_2 | 0.303 | 0.346 [0.231, 0.461] | 0.093 | 53 | 3 |
| associative_depth_3 | 0.445 | 0.478 [0.306, 0.650] | 0.139 | 119 | 6 |
| fading_view | 3.531 | 3.614 [2.216, 5.012] | 1.126 | 3 | 192 |
| fading_direct | 198.339 | 212.574 [163.567, 261.580] | 39.475 | 456 | 0 |
| timeline | 0.132 | 0.145 [0.090, 0.200] | 0.044 | 102 | 0 |

## Materialized view

- Initial creation: 459.090 ms median; mean 509.952 ms; 95% t interval [368.063, 651.841] ms; sample SD 114.292 ms.
- Refresh: 483.634 ms median; mean 509.024 ms; 95% t interval [406.711, 611.336] ms; sample SD 82.413 ms.

## Operating-system page-cache handling

Disabled. PostgreSQL shared buffers were reset by restarting the isolated server; operating-system cache was uncontrolled.

Intervals are conditional on this host and experiment. They assume independent, approximately normal restart samples and do not account for sequential ordering, host load, or hardware variation. The raw trial plans and cache-eviction request results are in [fresh-buffer-pools.json](fresh-buffer-pools.json).
