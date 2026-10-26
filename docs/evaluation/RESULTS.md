# Evaluation results

## Remaining evidence gaps

The latest synthetic ablation, parameter sweep, corridor radius, and data-corruption measurements are in [research/RESULTS.md](research/RESULTS.md) with machine-readable values in [research/RESULTS.json](research/RESULTS.json). They use a separate rollback-only eight-memory labeled fixture and do not represent human or biological validation.

A matched 10,000-memory, five-restart comparison between the local Linux host and a GitHub-hosted Ubuntu runner is recorded in [cross-machine/RESULTS.md](cross-machine/RESULTS.md) and [cross-machine/RESULTS.json](cross-machine/RESULTS.json). The Ubuntu run came from [workflow run 40311727074](https://github.com/dumbly-smart/Memory-Scape/actions/runs/40311727074). The two environments report different vCPU counts and Node versions; results are descriptive environment comparisons and do not isolate a hardware cause. The GitHub runner is a hosted virtual machine, not dedicated physical hardware.

Fresh PostgreSQL shared-buffer trials include five-restart 10,000-memory runs using restart-only cache handling ([report](fresh-buffer-trials/10000/RESULTS.md), [raw plans](fresh-buffer-trials/10000/fresh-buffer-pools.json)) and an advisory relation-file page-cache eviction attempt ([report](fresh-buffer-trials/10000-page-cache-attempt/RESULTS.md), [raw plans](fresh-buffer-trials/10000-page-cache-attempt/fresh-buffer-pools.json)). At 10K, the spatial index candidate was slower than the controlled sequential plan in both conditions; the fading materialized-view query was faster than the direct query. The eviction requests do not confirm cache eviction and are not cold-disk measurements. The matching GitHub-hosted runner comparison is documented above; it is a separate virtual environment, not dedicated physical-hardware replication. No participants have been recruited or studied; see the [draft human-study protocol](HUMAN_STUDY_PROTOCOL.md), which requires institutional ethics approval before use.

A five-trial 50,000-memory restart-only run extends the local scale evidence; its raw plans and descriptive comparison against the matching 10,000-memory trials are in [`fresh-buffer-trials/50000/`](fresh-buffer-trials/50000/) and [`SCALE_RESULTS.md`](SCALE_RESULTS.md). This scale comparison is same-host, sequential, synthetic, and not randomized; treat it as descriptive only. It does not imply a causal scaling trend or general performance guarantee.

A blocked, five-restart 50K spatial-radius sweep tests 25, 150, and 1,000 m against the same route and dataset in each trial. It records returned rows and planner-selected nodes alongside the index-candidate and controlled sequential plans. See [`SPATIAL_SELECTIVITY.md`](SPATIAL_SELECTIVITY.md) and its [raw plans](spatial-radius/sweep-50k/fresh-buffer-pools.json); confidence intervals overlap, so it does not establish an index speedup.

Captured 2026-10-21T16:08:54.526Z over 5 sequential runs. Values are median ± sample standard deviation; timing units are milliseconds.

## Environment

- PostgreSQL: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- PostGIS: POSTGIS="3.6.4 94d984b" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" (compiled against GEOS 3.13.1) PROJ="9.8.1 NETWORK_ENABLED=OFF URL_ENDPOINT=https://cdn.proj.org USER_WRITABLE_DIRECTORY=/var/lib/postgresql/.local/share/proj DATABASE_PATH=/usr/share/proj/proj.db" (compiled against PROJ 9.6.0) LIBXML="2.9.14" LIBJSON="0.18" LIBPROTOBUF="1.5.1" WAGYU="0.5.0 (Internal)" TOPOLOGY
- Memories: 10000; edges: 26615
- Host: linux x64, 24 CPUs; Node v26.12.0
- Parameters: 150 m route radius; recursive pruning threshold 0.01; 5 repetitions per query.

## Query plans

| Query | Planning ms (median ± SD) | Execution ms (median ± SD) | Execution mean ms | Actual rows median |
|---|---:|---:|---:|---:|
| spatial_index_candidate | 3.656 ± 0.723 ms | 20.006 ± 11.229 ms | 25.597 | 2875 |
| spatial_sequential_control | 3.315 ± 0.414 ms | 21.933 ± 1.758 ms | 22.496 | 2875 |
| associative_depth_1 | 1.336 ± 0.275 ms | 0.212 ± 0.061 ms | 0.210 | 2 |
| associative_depth_2 | 0.952 ± 0.136 ms | 0.223 ± 0.076 ms | 0.249 | 6 |
| associative_depth_3 | 1.044 ± 0.167 ms | 0.318 ± 0.061 ms | 0.348 | 12 |
| fading_view | 0.120 ± 0.031 ms | 1.988 ± 0.413 ms | 2.066 | 100 |
| fading_direct | 0.120 ± 0.024 ms | 129.392 ± 23.445 ms | 139.561 | 100 |
| timeline | 0.093 ± 0.006 ms | 0.107 ± 0.029 ms | 0.120 | 100 |

## Materialized view

- Initial creation: 372.272 ± 17.093 ms (temporary generated schema dropped transactionally).
- Refresh: 363.177 ± 2.801 ms.

Each repetition runs sequentially in one database session, so these are repeated observations with changing cache state, not independent cold-start samples. The spatial comparison disables index and bitmap scans at the session level without dropping production indexes. Full plans and per-run values are in [latest-10000.json](latest-10000.json). Results depend on dataset selectivity, planner choices, cache state, host load, and hardware.
