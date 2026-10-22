# MemoryScape entity relationships

```mermaid
erDiagram
  MEMORIES ||--o{ MEMORY_CONTEXTS : has
  CONTEXTS ||--o{ MEMORY_CONTEXTS : labels
  MEMORIES ||--o{ MEMORY_REINFORCEMENTS : reinforced
  MEMORIES ||--o{ MEMORY_EDGES : source
  MEMORIES ||--o{ MEMORY_EDGES : destination
  MEMORIES ||..o{ FADING_MEMORIES_MV : reviewed_from
```

`memory_contexts` is the normalized many-to-many join relation. `memory_edges` stores directed, weighted associations between two memory rows. The fading view is derived and is not an independent source of truth.
