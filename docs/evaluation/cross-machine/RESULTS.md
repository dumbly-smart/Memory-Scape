# Cross-machine benchmark comparison

Dataset: 10000 memories. Cache strategy: postgres_restart_only. Percent change uses archlinux-10k as baseline; negative values indicate a lower median time.

| Query | archlinux-10k median (ms) | github-Linux-X64 median (ms) |
|---|---:|---:|
| associative_depth_1 | 0.405 (0.0%) | 0.277 (-31.6%) |
| associative_depth_2 | 0.303 (0.0%) | 0.204 (-32.7%) |
| associative_depth_3 | 0.445 (0.0%) | 0.295 (-33.7%) |
| fading_direct | 198.339 (0.0%) | 139.075 (-29.9%) |
| fading_view | 3.531 (0.0%) | 2.817 (-20.2%) |
| spatial_index_candidate | 57.510 (0.0%) | 43.710 (-24.0%) |
| spatial_sequential_control | 25.203 (0.0%) | 18.324 (-27.3%) |
| timeline | 0.132 (0.0%) | 0.102 (-22.7%) |

Values and confidence intervals are host-specific observations. The comparison does not treat machines as interchangeable or claim a causal hardware effect.

## Host metadata

- **archlinux-10k** — linux/x64, 24 CPUs, 15.3 GiB RAM, Node v26.12.1, PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
- **github-Linux-X64** — linux/x64, 4 CPUs, 15.6 GiB RAM, Node v22.23.3, PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit

Source artifacts: `docs/evaluation/fresh-buffer-trials/10000/fresh-buffer-pools.json`, `docs/evaluation/cross-machine/github-runner-10000.json`.
