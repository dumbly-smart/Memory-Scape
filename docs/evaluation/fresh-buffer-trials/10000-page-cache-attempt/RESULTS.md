# Fresh PostgreSQL buffer-pool trials

Captured 2026-10-26T10:26:31.709Z across 5 sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The report includes median, sample standard deviation, and a nominal two-sided 95% Student t interval for the mean.

## Environment

- Machine: archlinux-10k-cache-attempt
- PostgreSQL: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- PostGIS: POSTGIS="3.6.4 94d984b" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" (compiled against GEOS 3.13.1) PROJ="9.8.1 NETWORK_ENABLED=OFF URL_ENDPOINT=https://cdn.proj.org USER_WRITABLE_DIRECTORY=/var/lib/postgresql/.local/share/proj DATABASE_PATH=/usr/share/proj/proj.db" (compiled against PROJ 9.6.0) LIBXML="2.9.14" LIBJSON="0.18" LIBPROTOBUF="1.5.1" WAGYU="0.5.0 (Internal)" TOPOLOGY
- Memories: 10000
- Trials: 5
- Cache strategy: relation_file_posix_fadvise_dontneed_attempt
- Parameters: 150 m route radius, recursion threshold 0.01, depths 1–3

## Query measurements

| Query | Execution median (ms) | Mean (95% t interval, ms) | Sample SD (ms) | Shared hits median | Shared reads median |
|---|---:|---:|---:|---:|---:|
| spatial_index_candidate | 66.690 | 68.279 [49.630, 86.928] | 15.022 | 670 | 79 |
| spatial_sequential_control | 25.311 | 28.370 [18.503, 38.238] | 7.948 | 455 | 0 |
| associative_depth_1 | 0.518 | 0.634 [0.287, 0.982] | 0.280 | 31 | 4 |
| associative_depth_2 | 0.485 | 0.527 [0.284, 0.770] | 0.196 | 53 | 3 |
| associative_depth_3 | 0.932 | 0.918 [0.411, 1.425] | 0.409 | 119 | 6 |
| fading_view | 4.060 | 4.048 [3.081, 5.016] | 0.779 | 3 | 192 |
| fading_direct | 197.005 | 203.648 [187.268, 220.029] | 13.195 | 456 | 0 |
| timeline | 0.147 | 0.156 [0.126, 0.186] | 0.024 | 102 | 0 |

## Materialized view

- Initial creation: 490.554 ms median; mean 464.070 ms; 95% t interval [373.393, 554.748] ms; sample SD 73.041 ms.
- Refresh: 448.395 ms median; mean 458.852 ms; 95% t interval [408.027, 509.678] ms; sample SD 40.940 ms.

## Operating-system page-cache handling

| Trial | Relation files targeted | Bytes targeted |
|---:|---:|---:|
| 1 | 2039 | 90748515 |
| 2 | 2039 | 90773091 |
| 3 | 2039 | 90773091 |
| 4 | 2039 | 90781283 |
| 5 | 2039 | 90797667 |

The helper checkpoints the disposable database and issues Linux POSIX_FADV_DONTNEED requests for regular files under PostgreSQL base/ and global/ directories. This is an advisory eviction request. The kernel may retain pages, PostgreSQL startup may warm pages, and no global cache flush is performed; interpret this as a cache-eviction attempt, not a cold-disk measurement.

Intervals are conditional on this host and experiment. They assume independent, approximately normal restart samples and do not account for sequential ordering, host load, or hardware variation. The raw trial plans and cache-eviction request results are in [fresh-buffer-pools.json](fresh-buffer-pools.json).
