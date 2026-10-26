# Synthetic research evaluation results

Captured 2026-10-26T09:07:44.912Z. These are generated from the fixed labeled fixture, not participant observations.

## Environment and protocol

- PostgreSQL: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- PostGIS: POSTGIS="3.6.4 94d984b" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" (compiled against GEOS 3.13.1) PROJ="9.8.1 NETWORK_ENABLED=OFF URL_ENDPOINT=https://cdn.proj.org USER_WRITABLE_DIRECTORY=/var/lib/postgresql/.local/share/proj DATABASE_PATH=/usr/share/proj/proj.db" (compiled against PROJ 9.6.0) LIBXML="2.9.14" LIBJSON="0.18" LIBPROTOBUF="1.5.1" WAGYU="0.5.0 (Internal)" TOPOLOGY
- Persistent workspace rows before/after: equal (see JSON for counts).
- Host: linux x64, 24 CPUs; Node v26.12.1
- Fixture: seed 497, 8 memories, 9 directed edges.
- Spatiotemporal truth: seed, strong-mid, weak-mid, target-a, target-b, three-hop within 75 m and [2025-01-01T12:00:00.000Z, 2025-01-01T14:00:00.000Z).
- Associative truth: strong-mid, weak-mid, target-a, target-b, three-hop.
- Query repetitions: 5 per scenario. Metrics are precision, recall, F1, and mean reciprocal rank.

## Ablation and pruning sensitivity

| Scenario | Candidates | Precision | Recall | F1 | MRR | Top activation | Median round-trip ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 0.962 |
| edge_weight_disabled | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.78000 | 0.952 |
| target_strength_disabled | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.85500 | 1.003 |
| valence_salience_disabled | 6 | 0.833 | 1.000 | 0.909 | 0.500 | 0.64125 | 1.029 |
| one_hop_depth_ablation | 4 | 0.750 | 0.600 | 0.667 | 1.000 | 0.68400 | 0.762 |
| temporal_decay_1d_lambda_0.2 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.56001 | 0.831 |
| temporal_decay_7d_lambda_0.2 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.16867 | 0.860 |
| temporal_decay_30d_lambda_0.2 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — | 0.909 |
| pruning_threshold_0 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 0.920 |
| pruning_threshold_0.01 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 0.809 |
| pruning_threshold_0.05 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 0.844 |
| pruning_threshold_0.1 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 0.830 |
| pruning_threshold_0.2 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.68400 | 1.468 |
| pruning_threshold_0.35 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.68400 | 1.487 |

## Synthetic parameter calibration

| Scenario | Candidates | Precision | Recall | F1 | MRR | Top activation | Median round-trip ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| salience_0.25_threshold_0.01 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 0.824 |
| salience_0.5_threshold_0.01 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.64800 | 1.015 |
| salience_0.75_threshold_0.01 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.61200 | 0.892 |
| salience_0.25_threshold_0.05 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 0.911 |
| salience_0.5_threshold_0.05 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.64800 | 1.247 |
| salience_0.25_threshold_0.1 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 0.838 |
| salience_0_threshold_0.01 | 6 | 0.833 | 1.000 | 0.909 | 0.500 | 0.85500 | 1.169 |
| salience_0_threshold_0.05 | 6 | 0.833 | 1.000 | 0.909 | 0.500 | 0.85500 | 0.830 |
| salience_0_threshold_0.1 | 6 | 0.833 | 1.000 | 0.909 | 0.500 | 0.85500 | 0.818 |
| salience_0_threshold_0.2 | 6 | 0.833 | 1.000 | 0.909 | 0.500 | 0.85500 | 0.889 |
| salience_0.75_threshold_0.05 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.61200 | 0.956 |
| salience_0.5_threshold_0.1 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.64800 | 1.003 |
| salience_0.75_threshold_0.1 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.61200 | 0.800 |
| salience_0.25_threshold_0.2 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.68400 | 0.882 |
| salience_0.5_threshold_0.2 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.64800 | 0.939 |
| salience_1_threshold_0.01 | 3 | 1.000 | 0.600 | 0.750 | 1.000 | 0.57600 | 0.755 |
| salience_1_threshold_0.05 | 3 | 1.000 | 0.600 | 0.750 | 1.000 | 0.57600 | 0.750 |
| salience_1_threshold_0.1 | 3 | 1.000 | 0.600 | 0.750 | 1.000 | 0.57600 | 0.935 |
| salience_1_threshold_0.2 | 3 | 1.000 | 0.600 | 0.750 | 1.000 | 0.57600 | 0.805 |
| salience_0.75_threshold_0.2 | 4 | 0.750 | 0.600 | 0.667 | 1.000 | 0.61200 | 0.765 |

Selected configuration: salience 0.25, base 0.75, threshold 0.01 under the selection rule: Highest synthetic-ground-truth F1, then reciprocal rank, then lower pruning threshold, then lower valence salience. Runtime is reported but does not influence the selected coefficients. This is a synthetic fixture result, not human or biological calibration.

## Route radius sensitivity

| Scenario | Candidates | Precision | Recall | F1 | MRR | Top activation | Median round-trip ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| corridor_radius_25m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.264 |
| corridor_radius_50m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.117 |
| corridor_radius_75m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.104 |
| corridor_radius_150m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.101 |
| corridor_radius_500m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.097 |
| corridor_radius_1500m | 7 | 0.857 | 1.000 | 0.923 | 1.000 | — | 0.107 |

## Robustness under location and graph corruption

| Scenario | Candidates | Precision | Recall | F1 | MRR | Top activation | Median round-trip ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| location_noise_0m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.124 |
| location_noise_5m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.341 |
| location_noise_25m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.250 |
| location_noise_75m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.208 |
| location_noise_150m | 1 | 1.000 | 0.167 | 0.286 | 1.000 | — | 0.181 |
| location_noise_300m | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — | 0.195 |
| edge_removal_0.25_trial_1 | 4 | 1.000 | 0.800 | 0.889 | 1.000 | 0.68400 | 1.196 |
| edge_removal_0.25_trial_2 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.68400 | 1.379 |
| edge_removal_0.25_trial_3 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 1.130 |
| edge_removal_0.25_trial_4 | 4 | 0.750 | 0.600 | 0.667 | 1.000 | 0.68400 | 1.018 |
| edge_removal_0.25_trial_5 | 4 | 0.750 | 0.600 | 0.667 | 0.500 | 0.64125 | 0.859 |
| edge_removal_0.5_trial_1 | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.64125 | 0.861 |
| edge_removal_0.5_trial_2 | 2 | 1.000 | 0.400 | 0.571 | 1.000 | 0.68400 | 0.944 |
| edge_removal_0.5_trial_3 | 4 | 0.750 | 0.600 | 0.667 | 0.500 | 0.64125 | 1.215 |
| edge_removal_0.5_trial_4 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.68400 | 0.790 |
| edge_removal_0.5_trial_5 | 3 | 1.000 | 0.600 | 0.750 | 1.000 | 0.68400 | 0.775 |
| edge_removal_0.75_trial_1 | 2 | 0.500 | 0.200 | 0.286 | 0.500 | 0.64125 | 0.698 |
| edge_removal_0.75_trial_2 | 2 | 1.000 | 0.400 | 0.571 | 1.000 | 0.35100 | 0.665 |
| edge_removal_0.75_trial_3 | 2 | 0.500 | 0.200 | 0.286 | 0.500 | 0.64125 | 0.645 |
| edge_removal_0.75_trial_4 | 2 | 0.500 | 0.200 | 0.286 | 1.000 | 0.68400 | 0.661 |
| edge_removal_0.75_trial_5 | 2 | 1.000 | 0.400 | 0.571 | 1.000 | 0.35100 | 0.669 |
| missing_locations_0.25 | 5 | 1.000 | 0.833 | 0.909 | 1.000 | — | 0.110 |
| missing_locations_0.5 | 3 | 1.000 | 0.500 | 0.667 | 1.000 | — | 0.095 |

### Descriptive variability across seeded edge-removal trials

| Edges removed | Trials | F1 mean ± sample SD | F1 range | MRR mean ± sample SD | MRR range |
|---:|---:|---:|---:|---:|---:|
| 25% | 5 | 0.786 ± 0.117 | 0.667–0.909 | 0.900 ± 0.224 | 0.500–1.000 |
| 50% | 5 | 0.558 ± 0.324 | 0.000–0.800 | 0.700 ± 0.447 | 0.000–1.000 |
| 75% | 5 | 0.400 ± 0.156 | 0.286–0.571 | 0.800 ± 0.274 | 0.500–1.000 |

These sample standard deviations and ranges describe only the five deterministic corruptions at each edge-removal fraction. They are not confidence intervals and do not estimate human, real-world, or population variability.

## Interpretation limits

Elapsed time is client-observed PostgreSQL round-trip time for the query and result transfer. Scenarios run sequentially in one session with changing cache state; these values are local workload observations, not cold-cache or cross-machine claims. The selected parameter setting optimizes this small synthetic fixture only. It is not evidence of biological constants, cognitive validity, or general retrieval quality. Run with multiple fixture seeds and other machines before making broader performance claims.
