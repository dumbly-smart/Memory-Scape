# Spatial Memory Walk

`spatial_memory_walk(route jsonb, radius_m)` parses GeoJSON into SRID 4326 geometry, rejects non-LineString, invalid, zero-length, or too-short routes, casts the route to geography, and uses `ST_DWithin(memory.location, route, radius_m)` for meter-based filtering with the geography GiST index. `ST_Distance` reports meters and `ST_LineLocatePoint` orders results along the line. Equal route positions break ties by event time then UUID. The API accepts 2–1000 coordinate pairs and radii from 1 to 50,000 meters.

The interface collects map clicks into an editable vertex list; users can append or clear the path and change corridor radius. OSM tiles are only a basemap. Query correctness does not depend on the tile service.

## Spatiotemporal extension

Migration `013_research_recall.sql` adds `spatiotemporal_memory_walk(route,radius,from,until)`. It validates the route and interval, applies the geography `ST_DWithin` corridor predicate and `occurred_at >= from AND occurred_at < until`, and returns unique memory rows ordered by `ST_LineLocatePoint`. The UI at `/research/spatiotemporal` exposes the route, radius, and event-time window. The exclusive end avoids double counting when adjacent time windows are evaluated.

`tests/database/research-recall.sql` asserts exact start/end behavior and excludes out-of-corridor memories. `npm run research:evaluate -- --seed=497` also sweeps corridor radii and deterministically perturbs or removes fixture locations. Its labels are synthetic ground truth, and the resulting metrics do not establish human recall performance.
