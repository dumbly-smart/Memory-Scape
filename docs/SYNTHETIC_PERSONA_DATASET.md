# VIT Vellore–Kannur synthetic student dataset

## Purpose and privacy

This is a wholly fictional example student, **Nikhil P.**, studying computer science at VIT Vellore and returning to a fictional approximate home location in Kannur during breaks. The name, relationships, journal entries, and events are invented. Coordinates point to approximate public campus/city/beach/travel anchors; there is no home address or claim that an event happened to a real person. Do not replace these entries with a real student's private diary without their consent.

The persona is intended to make the app useful to explore, not to present a polished or uniformly happy character. He is curious and methodical, loyal to family and friends, budget-conscious, interested in football, photography, Malayalam music and travel, and values sleep and time beyond grades. The timeline includes adjustment to living away from home, exam pressure, homesickness, asking for help, teamwork, ordinary routines, and growing independence.

## Contents

The generator deterministically creates 125 chronological memories from July 2024 through October 2026. They include VIT and hostel life, coursework and a database project, friends, family calls, Onam/Vishu/Christmas/summer returns, train travel between Katpadi and Kannur, and vacations in Wayanad, Coorg and Mysuru. It adds 62 normalized people/place/topic/activity/project/event/emotion contexts and 432 directed temporal/associative links. Every memory has the context `Synthetic persona: Nikhil P. (fictional)`, so the app's existing context filter can isolate this fixture. Strengths, decay rates, locations, dates, relationships, and IDs are reproducible.

The geographical points are intentionally approximate and clustered around campus, Kannur, stations, and vacation destinations. They demonstrate route recall and map clustering; they are not a travel GPS trace. `occurred_at` preserves the fictional event date. `last_strength_at` is set to installation time so historical memories do not receive an unintended multi-year decay on first use.

## Install and verify

Run against a local database after migrations:

```sh
npm run db:migrate
npm run db:seed:persona
```

This command is **additive**: it does not require an empty database, alter or delete existing memories, or run as part of ordinary app startup. It installs the dataset in one transaction. Re-running it is a no-op. Ownership is recorded in `synthetic_datasets` and `synthetic_dataset_memories` by migration `014_synthetic_datasets.sql`.

To remove just this fixture, run:

```sh
npm run db:remove:persona
```

Removal deletes only memories registered to this dataset; normal foreign-key cascades clean up their links and edges. Context rows are retained because contexts may be shared with other memories. Review the targeted database before removal if this fixture has been edited or referenced elsewhere.

Verify in SQL:

```sql
SELECT d.dataset_key, d.dataset_version, d.installed_at,
       count(dm.memory_id) AS owned_memories,
       min(m.occurred_at) AS first_event,
       max(m.occurred_at) AS last_event
FROM synthetic_datasets d
JOIN synthetic_dataset_memories dm USING (dataset_key)
JOIN memories m ON m.id = dm.memory_id
WHERE d.dataset_key = 'vit-kannur-student-v1'
GROUP BY d.dataset_key, d.dataset_version, d.installed_at;

SELECT count(DISTINCT mc.memory_id) AS persona_memories
FROM memory_contexts mc
JOIN contexts c ON c.id = mc.context_id
WHERE c.type = 'Custom'
  AND c.label = 'Synthetic persona: Nikhil P. (fictional)';
```

Open the Memory Library and filter by **Synthetic persona: Nikhil P. (fictional)**. Use the Map page to draw a route through VIT or Kannur, the Timeline to compare term and holiday periods, and Associative Recall from a project, person, or home memory. The graph's negative valence links represent emotionally salient associations, not an instruction to hide those memories.

## Reproducibility and tests

The fixture builder is in `scripts/vit-kannur-persona.ts`; the additive installer and scoped remover are separate scripts. `tests/database/vit-kannur-persona.test.ts` checks the timeline's size, deterministic identifiers, context/location references, valid values, life-story coverage, and graph endpoints. Run it with:

```sh
npx vitest run tests/database/vit-kannur-persona.test.ts
```

The memory IDs are deterministic UUIDs derived from the dataset key and fixture item keys. Updating the story in place requires a new dataset version and an explicit migration/upgrade strategy; do not change version 1 content after users have installed it.
