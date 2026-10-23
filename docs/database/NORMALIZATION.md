# Normalization rationale

The base relations target 3NF.

- In `memories`, the UUID determines event attributes, coordinates, and current decay state. Contexts and outgoing relationships are not repeated in a memory row.
- In `contexts`, the identifier determines type and label; `(type,label)` is an alternate candidate key.
- In `memory_contexts`, the pair `(memory_id,context_id)` determines the association timestamp. The composite primary key prevents duplicate links.
- In `memory_edges`, `id` determines endpoints, type, weight, valence, and creation time. `(src,dst,edge_type)` is a declared alternate key.
- In `memory_reinforcements`, each event identifier determines its memory, type, before/after values, amount, and time.

Functional dependencies include `memories.id → title, content, occurred_at, location, location_label, strength, decay_rate, last_strength_at, created_at, updated_at`; `contexts.id → type,label`; `(memory_id,context_id) → created_at`; and `memory_edges.id → src,dst,edge_type,valence,weight,created_at`. Derived context arrays exist only in query results/materialized views, not in normalized source tables.

Migration 010 adds `context_aliases`: each alias row belongs to exactly one context, while a generated normalized value derives from its text. Migration 011 enforces uniqueness of that normalized alias. It also adds `saved_searches`, where each row stores one name and one JSON object of filters; those filters describe a query and do not duplicate memory records. The partial unique memory capture key is nullable so ordinary captures retain no external key, while an offline retry key identifies at most one memory. Migration 012 separates Web Push configuration, subscriptions, and delivery receipts; a composite receipt key prevents duplicate notifications to a subscription for the same source record.
