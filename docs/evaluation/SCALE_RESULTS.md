# Dataset-scale performance comparison

Five-trial, restart-only PostgreSQL buffer-pool measurements were collected on this host at 10,000 and 50,000 synthetic memories. Each trial used one repetition of each query following a fresh PostgreSQL restart. Full plans and trial data remain in the linked scale artifacts.

## Query medians

| Query | 10K median ms | 50K median ms | 10K shared reads median | 50K shared reads median |
|---|---:|---:|---:|---:|
| spatial_index_candidate | 57.510 | 58.784 | 80 | 354 |
| spatial_sequential_control | 25.203 | 49.212 | 0 | 213 |
| associative_depth_1 | 0.405 | 0.190 | 4 | 6 |
| associative_depth_2 | 0.303 | 0.166 | 3 | 4 |
| associative_depth_3 | 0.445 | 0.198 | 6 | 5 |
| fading_view | 3.531 | 7.493 | 192 | 960 |
| fading_direct | 198.339 | 205.908 | 0 | 0 |
| timeline | 0.132 | 0.091 | 0 | 0 |

## Materialized view

| Dataset | Initial creation median ms | Refresh median ms |
|---|---:|---:|
| 10,000 | 459.090 | 483.634 |
| 50,000 | 376.805 | 415.968 |

## Interpretation

The route predicate selected a bitmap index plan in the observed trials, but the controlled sequential plan was faster at both tested sizes (10K: 57.510 vs 25.203 ms; 50K: 58.784 vs 49.212 ms). At 50K the index candidate plan also read more shared blocks (median 354 versus 213), while the sequential control read fewer blocks than at 10K due to cache and operating-system state variation. This evidence does not support claiming that the spatial index made this particular broad, clustered route query faster. The route covered a dense synthetic cluster and returned many candidates, so this is not a selective-route workload.

Associative depth timings, timeline retrieval, and the materialized-view query remained below 8 ms in these samples; direct fading-memory retrieval and view maintenance were materially more expensive. These observations are workload- and host-specific. There are only five sequential restart trials per size, and the 10K and 50K batches were not interleaved; no causal scaling curve, general latency guarantee, or machine-independent result follows.

## Reproduction and artifacts

Recreate scale-specific data with a disposable database and run `FRESH_BUFFER_TRIALS=5 FRESH_BUFFER_OUTPUT_DIR=docs/evaluation/fresh-buffer-trials/50000 npm run db:benchmark:fresh-buffers -- --memories=50000`. The deterministic generator refuses a nonempty database. Compare raw results at [`fresh-buffer-trials/10000/`](fresh-buffer-trials/10000/) and [`fresh-buffer-trials/50000/`](fresh-buffer-trials/50000/). The JSON summary is [`SCALE_RESULTS.json`](SCALE_RESULTS.json).

**Limitations:** Both datasets use this same host and restart-only shared-buffer clearing. These are not cold-disk results, randomized scale order, independent machine replications, or real-user workloads. The synthetic generator uses clustered campus coordinates and patterned graph structure. No benchmark figure establishes biological validity or cognitive usefulness.
