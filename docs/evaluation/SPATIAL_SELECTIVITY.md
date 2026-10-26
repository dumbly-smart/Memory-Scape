# Spatial selectivity and planner behavior

## Method

A fresh disposable PostgreSQL database was seeded with the deterministic 50,000-memory dataset. Five trials each restarted PostgreSQL, clearing its shared buffer pool. Each repetition tested a fixed campus route at 25, 150, and 1,000 m. Radius order rotated across repetitions, and the planner-candidate versus controlled sequential query order alternated. The control disabled index and bitmap scans for the query but retained all indexes. Operating-system page cache was not cleared.

## Results

| Radius | Memories returned | Share of dataset | Candidate median ms | Candidate mean 95% CI ms | Candidate plan | Sequential median ms | Sequential mean 95% CI ms | Sequential plan |
|---:|---:|---:|---:|---:|---|---:|---:|---|
| 25 m | 2,025 | 4.05% | 129.883 | [116.834, 152.128] | Gather → Bitmap Heap Scan → Bitmap Index Scan (memories_location_gix) | 143.722 | [113.564, 157.732] | Gather → Seq Scan |
| 150 m | 14,375 | 28.75% | 134.925 | [106.152, 152.598] | Gather → Bitmap Heap Scan → Bitmap Index Scan (memories_location_gix) | 138.655 | [108.726, 158.237] | Gather → Seq Scan |
| 1000 m | 49,725 | 99.45% | 159.016 | [140.191, 170.617] | Gather → Seq Scan | 144.809 | [128.755, 161.699] | Gather → Seq Scan |

At 25 m and 150 m the planner-candidate plan used a bitmap index path; at 1,000 m it selected a parallel sequential scan, matching the controlled plan family. Candidate and control mean confidence intervals overlap at every radius. The 25 m and 150 m candidate medians were modestly lower, while at 1,000 m the candidate median was higher; this five-trial sample does not establish a statistically reliable performance difference or a causal index benefit. It does show that the planner changed scan strategy as route selectivity rose from 4.05% to 99.45%.

The route is one fixed line through a dense synthetic campus cluster. This experiment says nothing about other geographies, route shapes, coordinate distributions, or production workloads. The controlled scan is achieved with planner settings, not by dropping an index. Trials reset PostgreSQL shared buffers but do not clear or verify the operating-system cache. Confidence intervals are nominal Student t intervals for each mean; they are not intervals for paired differences.

Raw plans, per-trial observations, environment metadata, and timings are in [`spatial-radius/sweep-50k/fresh-buffer-pools.json`](spatial-radius/sweep-50k/fresh-buffer-pools.json). The executable sweep is `BENCHMARK_SPATIAL_RADII_METERS=25,150,1000 FRESH_BUFFER_TRIALS=5 FRESH_BUFFER_OUTPUT_DIR=docs/evaluation/spatial-radius/sweep-50k npm run db:benchmark:fresh-buffers -- --memories=50000`.

