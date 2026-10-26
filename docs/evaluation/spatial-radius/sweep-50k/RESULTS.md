# Fresh PostgreSQL buffer-pool trials

Captured 2026-10-26T16:10:35.438Z across 5 sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The report includes median, sample standard deviation, and a nominal two-sided 95% Student t interval for the mean.

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
| spatial_index_candidate_25m | 129.883 | 134.481 [116.834, 152.128] | 14.214 | 3152 | 176 |
| spatial_sequential_control_25m | 143.722 | 135.648 [113.564, 157.732] | 17.789 | 3194 | 213 |
| spatial_sequential_control_150m | 138.655 | 133.481 [108.726, 158.237] | 19.941 | 3407 | 0 |
| spatial_index_candidate_150m | 134.925 | 129.375 [106.152, 152.598] | 18.706 | 3097 | 175 |
| spatial_index_candidate_1000m | 159.016 | 155.404 [140.191, 170.617] | 12.254 | 2989 | 0 |
| spatial_sequential_control_1000m | 144.809 | 145.227 [128.755, 161.699] | 13.268 | 3407 | 0 |
| associative_depth_1 | 0.534 | 0.555 [0.435, 0.674] | 0.096 | 36 | 6 |
| associative_depth_2 | 0.454 | 0.506 [0.257, 0.756] | 0.201 | 66 | 4 |
| associative_depth_3 | 0.485 | 0.526 [0.427, 0.625] | 0.079 | 124 | 5 |
| fading_view | 18.653 | 18.074 [14.370, 21.778] | 2.984 | 3 | 960 |
| fading_direct | 576.408 | 571.215 [536.158, 606.271] | 28.238 | 34809 | 0 |
| timeline | 0.194 | 0.186 [0.150, 0.223] | 0.029 | 102 | 0 |

## Materialized view

- Initial creation: 1108.130 ms median; mean 1072.885 ms; 95% t interval [944.280, 1201.490] ms; sample SD 103.592 ms.
- Refresh: 1102.819 ms median; mean 1136.492 ms; 95% t interval [1030.343, 1242.640] ms; sample SD 85.503 ms.

## Operating-system page-cache handling

Disabled. PostgreSQL shared buffers were reset by restarting the isolated server; operating-system cache was uncontrolled.

Intervals are conditional on this host and experiment. They assume independent, approximately normal restart samples and do not account for sequential ordering, host load, or hardware variation. The raw trial plans and cache-eviction request results are in [fresh-buffer-pools.json](fresh-buffer-pools.json).
