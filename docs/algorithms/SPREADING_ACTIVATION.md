# Associative spreading activation

The `associative_recall` SQL function is a `WITH RECURSIVE` traversal over directed `memory_edges`. The seed starts at configurable activation (default 1). Every hop calculates `A_next = A_current × edge_weight × (0.75 + 0.25 × abs(edge_valence)) × target_memory_strength`.

Both positive and negative salient valence therefore preserve cue strength; signed valence remains in the returned explanation. Paths below the threshold are excluded inside the recursive term. Traversal depth is clamped to 0–3. A UUID path array prevents revisiting a node within a path. If several paths reach one memory, `row_number` deterministically chooses maximum activation, then fewer hops, then lexical UUID path. Returned edge types, weights, valences, and node arrays explain the winning path. Coefficients are engineering choices, not experimentally established constants.
