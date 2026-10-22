# Fresh PostgreSQL buffer-pool trials

Captured 2026-10-22T20:21:31.206Z across 5 sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The report includes median, sample standard deviation, and a nominal two-sided 95% Student t interval for the mean.

## Environment

- PostgreSQL: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- PostGIS: POSTGIS="3.6.4 94d984b" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" (compiled against GEOS 3.13.1) PROJ="9.8.1 NETWORK_ENABLED=OFF URL_ENDPOINT=https://cdn.proj.org USER_WRITABLE_DIRECTORY=/var/lib/postgresql/.local/share/proj DATABASE_PATH=/usr/share/proj/proj.db" (compiled against PROJ 9.6.0) LIBXML="2.9.14" LIBJSON="0.18" LIBPROTOBUF="1.5.1" WAGYU="0.5.0 (Internal)" TOPOLOGY
- Memories: 1200
- Trials: 5
- Parameters: 150 m route radius, recursion threshold 0.01, depths 1–3

## Query measurements

| Query | Execution median (ms) | Mean (95% t interval, ms) | Sample SD (ms) | Shared hits median | Shared reads median |
|---|---:|---:|---:|---:|---:|
| spatial_index_candidate | 3.120 | 7.084 [-3.743, 17.910] | 8.721 | 269 | 24 |
| spatial_sequential_control | 1.260 | 1.623 [0.639, 2.608] | 0.793 | 53 | 0 |
| associative_depth_1 | 0.437 | 0.488 [0.317, 0.659] | 0.137 | 77 | 5 |
| associative_depth_2 | 0.354 | 0.383 [0.290, 0.476] | 0.075 | 93 | 2 |
| associative_depth_3 | 0.369 | 0.399 [0.308, 0.490] | 0.073 | 130 | 1 |
| fading_view | 0.353 | 0.363 [0.336, 0.390] | 0.022 | 3 | 32 |
| fading_direct | 0.708 | 0.831 [0.468, 1.195] | 0.293 | 54 | 0 |
| timeline | 0.037 | 0.049 [0.026, 0.071] | 0.018 | 102 | 0 |

## Materialized view

- Initial creation: 17.152 ms median; mean 17.690 ms; 95% t interval [16.190, 19.189] ms; sample SD 1.208 ms.
- Refresh: 35.875 ms median; mean 35.596 ms; 95% t interval [33.809, 37.384] ms; sample SD 1.440 ms.

Intervals are conditional on this host and experiment. They assume independent, approximately normal restart samples and do not account for sequential ordering, host load, operating-system file cache, or hardware variation. PostgreSQL shared buffers start empty for every trial, but the operating-system file cache remains warm or uncontrolled; these are not cold-disk measurements. Raw plans and individual measurements are in [fresh-buffer-pools.json](fresh-buffer-pools.json).
