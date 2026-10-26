# Synthetic research evaluation results

Captured 2026-10-26T07:21:00.615Z. These are generated from the fixed labeled fixture, not participant observations.

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
| baseline | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 1.848 |
| edge_weight_disabled | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.78000 | 1.743 |
| target_strength_disabled | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.85500 | 1.932 |
| valence_salience_disabled | 6 | 0.833 | 1.000 | 0.909 | 0.500 | 0.64125 | 1.731 |
| one_hop_depth_ablation | 4 | 0.750 | 0.600 | 0.667 | 1.000 | 0.68400 | 1.875 |
| temporal_decay_1d_lambda_0.2 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.56001 | 1.845 |
| temporal_decay_7d_lambda_0.2 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.16867 | 1.967 |
| temporal_decay_30d_lambda_0.2 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — | 1.708 |
| pruning_threshold_0 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 1.844 |
| pruning_threshold_0.01 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 1.789 |
| pruning_threshold_0.05 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 1.732 |
| pruning_threshold_0.1 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 1.783 |
| pruning_threshold_0.2 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.68400 | 1.722 |
| pruning_threshold_0.35 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.68400 | 1.801 |

## Synthetic parameter calibration

| Scenario | Candidates | Precision | Recall | F1 | MRR | Top activation | Median round-trip ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| salience_0.25_threshold_0.01 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 3.600 |
| salience_0.5_threshold_0.01 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.64800 | 1.915 |
| salience_0.75_threshold_0.01 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.61200 | 1.814 |
| salience_0.25_threshold_0.05 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 2.549 |
| salience_0.5_threshold_0.05 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.64800 | 1.842 |
| salience_0.25_threshold_0.1 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 1.964 |
| salience_0_threshold_0.01 | 6 | 0.833 | 1.000 | 0.909 | 0.500 | 0.85500 | 2.248 |
| salience_0_threshold_0.05 | 6 | 0.833 | 1.000 | 0.909 | 0.500 | 0.85500 | 3.074 |
| salience_0_threshold_0.1 | 6 | 0.833 | 1.000 | 0.909 | 0.500 | 0.85500 | 3.081 |
| salience_0_threshold_0.2 | 6 | 0.833 | 1.000 | 0.909 | 0.500 | 0.85500 | 2.995 |
| salience_0.75_threshold_0.05 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.61200 | 1.755 |
| salience_0.5_threshold_0.1 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.64800 | 1.717 |
| salience_0.75_threshold_0.1 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.61200 | 1.716 |
| salience_0.25_threshold_0.2 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.68400 | 1.893 |
| salience_0.5_threshold_0.2 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.64800 | 1.913 |
| salience_1_threshold_0.01 | 3 | 1.000 | 0.600 | 0.750 | 1.000 | 0.57600 | 1.701 |
| salience_1_threshold_0.05 | 3 | 1.000 | 0.600 | 0.750 | 1.000 | 0.57600 | 1.631 |
| salience_1_threshold_0.1 | 3 | 1.000 | 0.600 | 0.750 | 1.000 | 0.57600 | 1.681 |
| salience_1_threshold_0.2 | 3 | 1.000 | 0.600 | 0.750 | 1.000 | 0.57600 | 1.626 |
| salience_0.75_threshold_0.2 | 4 | 0.750 | 0.600 | 0.667 | 1.000 | 0.61200 | 1.653 |

Selected configuration: salience 0.25, base 0.75, threshold 0.01 under the selection rule: Highest synthetic-ground-truth F1, then reciprocal rank, then lower pruning threshold, then lower valence salience. Runtime is reported but does not influence the selected coefficients. This is a synthetic fixture result, not human or biological calibration.

## Route radius sensitivity

| Scenario | Candidates | Precision | Recall | F1 | MRR | Top activation | Median round-trip ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| corridor_radius_25m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 1.138 |
| corridor_radius_50m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.858 |
| corridor_radius_75m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.899 |
| corridor_radius_150m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.853 |
| corridor_radius_500m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.840 |
| corridor_radius_1500m | 7 | 0.857 | 1.000 | 0.923 | 1.000 | — | 0.933 |

## Robustness under location and graph corruption

| Scenario | Candidates | Precision | Recall | F1 | MRR | Top activation | Median round-trip ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| location_noise_0m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.913 |
| location_noise_5m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.815 |
| location_noise_25m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.701 |
| location_noise_75m | 6 | 1.000 | 1.000 | 1.000 | 1.000 | — | 0.517 |
| location_noise_150m | 1 | 1.000 | 0.167 | 0.286 | 1.000 | — | 0.864 |
| location_noise_300m | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — | 0.858 |
| edge_removal_0.25_trial_1 | 4 | 1.000 | 0.800 | 0.889 | 1.000 | 0.68400 | 1.720 |
| edge_removal_0.25_trial_2 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.68400 | 1.807 |
| edge_removal_0.25_trial_3 | 6 | 0.833 | 1.000 | 0.909 | 1.000 | 0.68400 | 1.616 |
| edge_removal_0.25_trial_4 | 4 | 0.750 | 0.600 | 0.667 | 1.000 | 0.68400 | 1.697 |
| edge_removal_0.25_trial_5 | 4 | 0.750 | 0.600 | 0.667 | 0.500 | 0.64125 | 1.726 |
| edge_removal_0.5_trial_1 | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.64125 | 1.755 |
| edge_removal_0.5_trial_2 | 2 | 1.000 | 0.400 | 0.571 | 1.000 | 0.68400 | 1.753 |
| edge_removal_0.5_trial_3 | 4 | 0.750 | 0.600 | 0.667 | 0.500 | 0.64125 | 1.838 |
| edge_removal_0.5_trial_4 | 5 | 0.800 | 0.800 | 0.800 | 1.000 | 0.68400 | 1.927 |
| edge_removal_0.5_trial_5 | 3 | 1.000 | 0.600 | 0.750 | 1.000 | 0.68400 | 1.739 |
| edge_removal_0.75_trial_1 | 2 | 0.500 | 0.200 | 0.286 | 0.500 | 0.64125 | 1.631 |
| edge_removal_0.75_trial_2 | 2 | 1.000 | 0.400 | 0.571 | 1.000 | 0.35100 | 1.671 |
| edge_removal_0.75_trial_3 | 2 | 0.500 | 0.200 | 0.286 | 0.500 | 0.64125 | 1.732 |
| edge_removal_0.75_trial_4 | 2 | 0.500 | 0.200 | 0.286 | 1.000 | 0.68400 | 1.466 |
| edge_removal_0.75_trial_5 | 2 | 1.000 | 0.400 | 0.571 | 1.000 | 0.35100 | 1.605 |
| missing_locations_0.25 | 5 | 1.000 | 0.833 | 0.909 | 1.000 | — | 0.424 |
| missing_locations_0.5 | 3 | 1.000 | 0.500 | 0.667 | 1.000 | — | 0.652 |

## Interpretation limits

Elapsed time is client-observed PostgreSQL round-trip time for the query and result transfer. Scenarios run sequentially in one session with changing cache state; these values are local workload observations, not cold-cache or cross-machine claims. The selected parameter setting optimizes this small synthetic fixture only. It is not evidence of biological constants, cognitive validity, or general retrieval quality. Run with multiple fixture seeds and other machines before making broader performance claims.
