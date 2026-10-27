# MemoryScape presentation guide

This guide is for a 10–12 minute BCSE497J project presentation followed by questions. The central story is simple: a student records an episode; time can weaken it; a place or an association can help find it again. MemoryScape makes those retrieval steps visible as database operations.

## One-sentence pitch

MemoryScape is a local-first personal knowledge system that uses PostgreSQL and PostGIS to retrieve memories by route, event time, and explainable graph association, while recording temporal decay and reinforcement in the database.

## 30-second opening

> “A note can tell us what happened, but it often does not help us find that note again when we remember only where we were, when it happened, or what it was connected to. MemoryScape explores those three cues with database-native retrieval. PostgreSQL stores the episodes and relationships, PostGIS searches along routes, and recursive SQL follows explainable association paths. This is a systems prototype: the mechanisms are inspired by ideas from memory research, but we do not claim that the software reproduces the brain or improves human recall.”

## Suggested slide order and speaker notes

### 1. Title and hook — 30 seconds

Show the project title and team. Start with a familiar example: “You remember studying near the library, but not the title of the note you made.” This introduces the retrieval problem without claiming that a database is a model of human memory.

Say the project name, course, and team members. Move quickly to the problem rather than reading the title slide aloud.

### 2. Problem and motivation — 60 seconds

Explain that ordinary note systems commonly retrieve by words or folders. MemoryScape makes three additional cues explicit:

- **Where:** a point or a route corridor.
- **When:** the event time and a requested time interval.
- **What is connected:** people, topics, activities, and directed memory edges.

Speaker line:

> “Our question is not whether software can reproduce remembering. It is whether a relational database can store these cues and execute useful, inspectable recall queries over them.”

### 3. Research questions and contribution — 60 seconds

State the three core questions in plain language:

1. Can PostGIS find memories near a user-drawn route and order them along it?
2. Can PostgreSQL apply decay and reinforcement atomically and keep a history of changes?
3. Can recursive SQL propagate activation through a graph with bounded, explainable paths?

Then state the engineering contribution:

> “The contribution is an integrated, database-centered implementation and evaluation of these workflows. The individual ideas and database primitives are established; we are demonstrating how they work together in a personal-memory application.”

### 4. Architecture and schema — 75 seconds

Walk across the architecture diagram from interface to API to PostgreSQL. Explain that the browser sends parameters and draws results; the database performs the route filtering, ranking, temporal updates, and graph traversal.

Use the relational diagram to identify:

- `memories` for the episode, its event time, location, and strength;
- `contexts` and `memory_contexts` for reusable many-to-many context links;
- `memory_edges` for directed, weighted associations;
- `memory_reinforcements` for auditable strength changes.

Mention that `occurred_at` means when an event happened, while `last_strength_at` records the time of the last strength calculation. They serve different purposes.

Speaker line:

> “This is intentionally relational. Contexts are reusable entities, edges have explicit source and destination memories, and reinforcement is recorded as data rather than hidden in the interface.”

### 5. Explain the three engines — 90 seconds

**Spatial recall.** A route is sent as a GeoJSON LineString. PostgreSQL converts it to a geography and uses `ST_DWithin` with a radius in meters. `ST_LineLocatePoint` supplies the order along the route. The result includes distance and route position so the UI can explain why it appeared.

**Temporal decay and reinforcement.** State the implemented rule:

`S(t) = S₀ × exp(−λ × elapsed_days)`

The database calculates elapsed time from `last_strength_at` and advances that timestamp in the same update. Reinforcement first accounts for unapplied decay and then applies:

`S′ = min(1, S + α × (1 − S))`

The before and after strengths are recorded in the same transaction. Be explicit that these are configurable engineering rules, not fitted biological constants.

**Associative recall.** A recursive CTE walks directed edges. Each hop uses edge weight, target-memory strength, and the configured valence-salience factor. The query tracks the current path to prevent cycles, prunes weak paths, limits depth to 32, and returns the strongest valid path as the explanation.

Speaker line:

> “The important DBMS point is that these are not JavaScript approximations. SQL and PostGIS perform the retrieval and return scores, ordering, and paths for the interface to display.”

### 6. Live demonstration — 3–4 minutes

Use synthetic data. Do not enter or display real personal locations or diaries during a public presentation.

1. Open a prepared memory such as a campus study event. Point out its event timestamp, place, contexts, and strength.
2. Open **Spatial Memory Walk**. Draw or load a short route, set a radius, and run it. Select a result and show its route order and distance. If browser geolocation is enabled, show the current-location marker; otherwise use the prepared route.
3. Open **Associative Graph**, select a seed memory, choose a small depth such as 2 or 3, and run recall. Select one returned memory and point out the relationship path and score.
4. Open **Fading Memory Review**, inspect a card, reinforce it, and show that the strength and reinforcement history changed.
5. If time allows, show the timeline or one-card weekly review briefly. Do not try to tour every screen.

Narrate the database result, not every click: “This memory is close to the route,” “this one was reached over these two edges,” and “this update created a history record.”

### 7. Evaluation and findings — 90 seconds

Explain the method before the numbers: five sequential trials, synthetic clustered data, one host, PostgreSQL restart before each trial, and no operating-system cache flush. The measurements describe this workload only.

Report the central results accurately:

| Query | 10,000 memories | 50,000 memories |
|---|---:|---:|
| Spatial index candidate | 57.510 ms | 58.784 ms |
| Controlled sequential plan | 25.203 ms | 49.212 ms |
| Fading-memory materialized-view lookup | 3.531 ms | 7.493 ms |
| Equivalent direct fading query | 198.339 ms | 205.908 ms |

The tested route was broad, so the sequential plan was faster than the spatial-index candidate. Say this plainly; it is useful workload evidence and does not establish that GiST is generally slower. The materialized-view query was faster in these trials, but refresh work also has a cost. Avoid saying that these measurements prove an index speedup or general production performance.

### 8. Conclusion and next work — 45 seconds

Summarize feasibility and limits:

> “We built a working prototype where route retrieval, temporal updates, and bounded associative recall are executed and explained by PostgreSQL. Our tests and benchmarks establish implementation behavior on synthetic data. They do not establish improved human memory, biological validity, usability, or performance on all workloads.”

Name the next research steps: test routes with controlled selectivity, measure graph growth at greater depths, repeat benchmarks across environments, and only then plan a consented human study with appropriate institutional review.

## Demo preparation checklist

- Start the application and check the database health endpoint before the presentation.
- Load the deterministic synthetic dataset and prepare one known route and one known graph seed.
- Confirm the map tiles load; if not, use the local synthetic route data and explain that tile display requires the configured tile source.
- Keep a screenshot or short recording of the route and graph results as a fallback, but label it as a prepared demo.
- Use a small associative depth first so results are quick and legible.
- Avoid geolocation permission prompts by deciding in advance whether to demonstrate current location or use manual route drawing.
- Keep the evaluation table available so the timings and caveats can be read accurately.

## Likely questions and strong answers

**What is novel here?**

> “We are not claiming to invent episodic memory, spreading activation, exponential decay, PostGIS, or recursive CTEs. The contribution is the integrated, inspectable database implementation and its synthetic correctness and performance evaluation.”

**Why call it biologically inspired?**

> “The product uses analogies to contextual cues, fading strength, reinforcement, and association. The coefficients and update equations are engineering choices. We have not established that they match neural processes.”

**Why did the spatial index candidate lose?**

> “The measured route was broad and returned many clustered points. For that selectivity, the controlled sequential plan was faster. We report this result rather than generalizing from it; selective routes need a separate controlled evaluation.”

**Why PostgreSQL instead of a graph database?**

> “The project needs relational integrity, geospatial operations, transactional strength updates, scheduled work, and graph traversal. PostgreSQL lets us demonstrate those mechanisms in one database while keeping the traversal SQL visible.”

**Does the system improve recall?**

> “We have not measured human recall. Current evidence covers implementation contracts and synthetic workloads. A human study is future work and would need consent, institutional review, and an appropriate protocol.”

**Why cap traversal at 32 hops?**

> “It is an operational safety bound, not a claim that 32 hops is cognitively meaningful or performant. The UI lets the user choose depth within that bound; deeper graph behavior needs further measurement.”

## Pitching guidance

Lead with the problem and a concrete memory example. Then make the database work the differentiator: the system does not merely draw a map or graph; SQL filters, orders, updates, traverses, and explains the returned memories. Use the benchmark findings as evidence of honest measurement, including the result that did not favor the index. Close with the exact boundary of the research: a reproducible database prototype is demonstrated; improved human remembering is not yet demonstrated.
