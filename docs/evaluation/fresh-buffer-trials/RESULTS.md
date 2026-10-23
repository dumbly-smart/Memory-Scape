# Fresh PostgreSQL buffer-pool trials

Captured 2026-10-22T20:37:44.459Z across 5 sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The report includes median, sample standard deviation, and a nominal two-sided 95% Student t interval for the mean.

## Environment

- Machine: archlinux
- PostgreSQL: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- PostGIS: POSTGIS="3.6.4 94d984b" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" (compiled against GEOS 3.13.1) PROJ="9.8.1 NETWORK_ENABLED=OFF URL_ENDPOINT=https://cdn.proj.org USER_WRITABLE_DIRECTORY=/var/lib/postgresql/.local/share/proj DATABASE_PATH=/usr/share/proj/proj.db" (compiled against PROJ 9.6.0) LIBXML="2.9.14" LIBJSON="0.18" LIBPROTOBUF="1.5.1" WAGYU="0.5.0 (Internal)" TOPOLOGY
- Memories: 1200
- Trials: 5
- Cache strategy: relation_file_posix_fadvise_dontneed_attempt
- Parameters: 150 m route radius, recursion threshold 0.01, depths 1–3

## Query measurements

| Query | Execution median (ms) | Mean (95% t interval, ms) | Sample SD (ms) | Shared hits median | Shared reads median |
|---|---:|---:|---:|---:|---:|
| spatial_index_candidate | 6.345 | 6.145 [4.356, 7.933] | 1.441 | 269 | 24 |
| spatial_sequential_control | 1.454 | 1.753 [1.125, 2.382] | 0.506 | 53 | 0 |
| associative_depth_1 | 0.699 | 0.739 [0.552, 0.925] | 0.150 | 77 | 5 |
| associative_depth_2 | 0.584 | 0.556 [0.419, 0.694] | 0.111 | 93 | 2 |
| associative_depth_3 | 0.588 | 0.655 [0.484, 0.825] | 0.137 | 130 | 1 |
| fading_view | 0.977 | 0.922 [0.479, 1.366] | 0.357 | 3 | 32 |
| fading_direct | 1.299 | 1.174 [0.786, 1.562] | 0.313 | 54 | 0 |
| timeline | 0.073 | 0.071 [0.046, 0.095] | 0.020 | 102 | 0 |

## Materialized view

- Initial creation: 21.845 ms median; mean 21.519 ms; 95% t interval [17.157, 25.881] ms; sample SD 3.514 ms.
- Refresh: 44.007 ms median; mean 41.337 ms; 95% t interval [36.033, 46.641] ms; sample SD 4.273 ms.

## Operating-system page-cache handling

| Trial | Relation files targeted | Bytes targeted |
|---:|---:|---:|
| 1 | 1975 | 65664611 |
| 2 | 1975 | 65664611 |
| 3 | 1975 | 65689187 |
| 4 | 1975 | 65697379 |
| 5 | 1975 | 65705571 |

The helper checkpoints the disposable database and issues Linux POSIX_FADV_DONTNEED requests for regular files under PostgreSQL base/ and global/ directories. This is an advisory eviction request. The kernel may retain pages, PostgreSQL startup may warm pages, and no global cache flush is performed; interpret this as a cache-eviction attempt, not a cold-disk measurement.

Intervals are conditional on this host and experiment. They assume independent, approximately normal restart samples and do not account for sequential ordering, host load, or hardware variation. The raw trial plans and cache-eviction request results are in [fresh-buffer-pools.json](fresh-buffer-pools.json).
