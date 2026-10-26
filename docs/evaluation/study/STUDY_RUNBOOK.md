# Human study runbook

This is an execution kit for an exploratory study using fictional memories. It does not approve or authorize research with people. Obtain institutional ethics review, informed consent materials, and a preregistered analysis plan before recruitment or collection.

## Frozen task pack

- `stimuli-v1.json` contains three task prompts, all condition-specific query parameters, a 90-second limit, and three balanced schedule orders.
- `answer-key-v1.json` contains the target memory UUID for each task. Treat it as operator material and do not show it to participants.
- The stimuli and key share version `v1`. `npm run study:validate` checks the structure and prints SHA-256 hashes. Record both hashes in the study log and do not edit either file after preregistration.
- The task IDs resolve to deterministic demo-seed memories (sessions 2, 262, and 522). All three targets are in the graph page's first 100 memories, have a searchable event-date interval, lie on their supplied 50 m route corridor, and have a direct incoming association from the supplied graph seed.

## Sample-size sensitivity planning

After ethics approval, run a usability pilot and estimate paired discordance rates for the primary binary accuracy outcome. `npm run study:power -- --memoryscape-only=0.20 --conventional-only=0.10 --alpha=0.05 --power=0.8` computes the smallest participant count up to `--max=2000` using the exact conditional McNemar test. The two supplied rates are respectively MemoryScape-correct/conventional-wrong and conventional-correct/MemoryScape-wrong. The default command prints several illustrative scenarios instead. Do not use those defaults as a sample-size justification: preregister pilot-supported rates, the primary contrast, exclusions, attrition allowance, and multiplicity handling with appropriate statistical review.

## Prepare an isolated database

Use a new, empty study database. Do not seed the ordinary workspace or a database containing user memories.

```sh
docker compose -p memoryscape-study -f docker-compose.study.yml up -d --wait
export DATABASE_URL='postgres://memoryscape:memoryscape_local@127.0.0.1:55432/memoryscape_study'
npm run db:migrate
npm run db:seed
npm run study:validate
npm run study:verify-db
```

`docker-compose.study.yml` creates a separate localhost-only PostgreSQL/PostGIS/pg_cron service and persistent volume. Its `cron.database_name` matches the study database, which is required by pg_cron. It does not connect to or seed the ordinary workspace database. Set `STUDY_POSTGRES_PASSWORD` if the local default is changed. Start `npm run dev` in a second terminal with the same `DATABASE_URL` so the web app uses this study database. `db:seed` refuses a nonempty database. `study:verify-db` is read-only: it calls the actual spatial and associative SQL functions and checks that each target is in conventional search/date results, within its route corridor, above the graph pruning threshold, and visible with its seed in the graph page's first 100 memories. Run it before each session after restoring the frozen database.

For one participant, assign one schedule order and give each condition the scenario set shown in that order:

| Schedule | Trial 1 | Trial 2 | Trial 3 |
|---|---|---|---|
| 1 | Conventional · A | Spatial · B | Associative · C |
| 2 | Spatial · C | Associative · A | Conventional · B |
| 3 | Associative · B | Conventional · C | Spatial · A |

The participant sees the matching task prompt. The operator applies the condition's query parameters from `stimuli-v1.json`. Keep the seed database, app commit, browser/viewport, route radius (50 m), associative depth (1), pruning threshold (0.01), and time limit (90 seconds) fixed. Do not use participants' personal memories or locations.

## Record and score responses

Start with `response-template.csv`. Store one row per task, using a random study code that cannot be used to infer identity. Keep consent records separate. The scorer accepts these columns:

`participant_code,scenario_version,task_id,condition,order_index,submitted_memory_id,found_target,elapsed_seconds,confidence_1_to_7,workload_1_to_7,technical_issue`

`order_index` is 1, 2, or 3 from the assigned schedule. `submitted_memory_id` is the UUID of the selected episode. The scorer derives correctness from the frozen key; do not enter a self-rated correctness value. It rejects duplicate trials, invalid schedule assignments, malformed IDs, invalid scales, over-limit times, and mismatched versions.

```sh
npm run study:score -- responses.csv
npm run study:score -- responses.csv /secure/path/study-summary
```

With no output prefix, the command prints Markdown. With a prefix, it creates aggregate-only `.json` and `.md` files and refuses to overwrite existing files. It never writes or copies raw response rows. Keep raw CSV access restricted under the approved retention plan; publish only approved aggregate results.

The report includes per-condition accuracy, target-found rate, mean completion time among correct responses, confidence/workload summaries, technical-issue counts, and paired accuracy differences with descriptive Student t intervals when at least two participants have complete condition data. It does not select exclusions, establish a confirmatory result, or infer biological validity. Set exclusions and the analysis plan before examining results.

## Response template

See [`response-template.csv`](response-template.csv). The initial file contains only a header and no participant data.
