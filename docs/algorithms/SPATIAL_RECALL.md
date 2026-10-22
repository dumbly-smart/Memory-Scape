# Spatial Memory Walk

`spatial_memory_walk(route jsonb, radius_m)` parses GeoJSON into SRID 4326 geometry, rejects non-LineString, invalid, zero-length, or too-short routes, casts the route to geography, and uses `ST_DWithin(memory.location, route, radius_m)` for meter-based filtering with the geography GiST index. `ST_Distance` reports meters and `ST_LineLocatePoint` orders results along the line. Equal route positions break ties by event time then UUID. The API accepts 2–1000 coordinate pairs and radii from 1 to 50,000 meters.

The interface collects map clicks into an editable vertex list; users can append or clear the path and change corridor radius. OSM tiles are only a basemap. Query correctness does not depend on the tile service.
