# Human evaluation protocol (draft)

**Status: planning document only. No participants have been recruited and no human-subject data have been collected. Obtain institutional ethics review and approval before recruitment or data collection.**

## Research question

For a fixed set of fictional episodic memories, do route-based spatial recall and bounded associative recall help people retrieve the intended episode more accurately or quickly than conventional text and chronological browsing?

This study evaluates task performance and perceived usability. It does not establish biological equivalence, validate the proposed equations as cognitive laws, diagnose memory, or support medical claims.

## Design

Use a within-participant, counterbalanced exploratory study. Each participant completes equivalent tasks using:

1. **Conventional browsing:** the Memory Library's text search and date filters.
2. **Spatial recall:** the Spatial Memory Walk over a supplied route and radius.
3. **Associative recall:** the graph recall interface from a supplied seed memory, with a fixed depth and pruning threshold.

Use at least three equivalent fictional scenario sets so participants do not see the same answers in every condition. Assign scenario-to-condition order with a balanced Latin-square schedule. Keep the database seed, available memories, query parameters, instructions, and time limit fixed across participants. Record the actual seed version and algorithm settings in the study log.

Run a small usability pilot after ethics approval to identify confusing instructions and estimate task-time variability. Set the confirmatory sample size from a preregistered power analysis on the primary paired outcome; do not choose a sample size after looking at confirmatory results. If recruitment or power is limited, label the study exploratory and report precision rather than claiming effectiveness.

## Participants and safeguards

- Recruit adults able to provide informed consent under the institution's approved process.
- Participation is voluntary. Explain the tasks, data collected, foreseeable discomfort, withdrawal process, retention period, and contact for questions before consent.
- Use only fictional, synthetic scenario memories. Do not ask for real autobiographical memories, locations, contacts, health details, or private notes.
- Do not collect names, account credentials, real location, audio, video, or free-text personal narratives in the study dataset.
- Store a random study code separately from any consent record. Restrict access to the minimum approved research team; encrypt files at rest and during transfer.
- Allow participants to stop without penalty. Delete withdrawn task records when the approved protocol permits and the participant requests it.
- Publish only aggregate results and suppress small groups that could identify participants.

## Procedure

1. Obtain approval, consent, and a random participant code.
2. Explain that MemoryScape is a research prototype and demonstrate the controls using a practice scenario not used in measured tasks.
3. Assign a counterbalanced order and an equivalent scenario set.
4. Present each retrieval question with its assigned condition. Start timing when the question is shown; stop when the participant submits an answer or the preregistered time limit expires.
5. Record correctness against a frozen answer key, elapsed seconds, whether the target was found, confidence (1–7), and a short workload rating (1–7). Do not record screen/audio/video unless separately approved and consented.
6. After all conditions, collect a brief usability questionnaire and an optional non-identifying comment about interface difficulty. Avoid requests for personal memory content.
7. Debrief participants, explain the research question and limitations, and provide the approved contact details.

## Outcomes and analysis

**Primary outcome:** within-participant difference in target retrieval accuracy between each research engine and conventional browsing, measured on matched tasks.

**Secondary outcomes:** target-finding completion rate, elapsed time for correct answers, confidence rating, workload rating, and usability questionnaire scores.

Predefine exclusions (for example, an incomplete session or a documented technical failure) before looking at outcomes. Report participant flow and missingness. Summarize paired condition differences with participant-level confidence intervals and show per-condition distributions. For confirmatory claims, use the analysis specified in an approved preregistration and account for multiple primary comparisons. Treat response times as censored at the time limit and report accuracy alongside time so incorrect fast guesses are not rewarded.

No analysis can establish biological validity from a small usability study. Results only describe performance on the specified fictional tasks and prototype version.

## Data dictionary

Use a local CSV with one row per participant-task-condition. Keep consent records separate from this file.

| Column | Type | Meaning |
|---|---|---|
| `participant_code` | random string | Non-identifying study code |
| `scenario_version` | string | Version/hash of the fictional memory set |
| `task_id` | string | Preregistered task identifier |
| `condition` | enum | `conventional`, `spatial`, or `associative` |
| `order_index` | integer | Position of condition/task in the counterbalanced schedule |
| `correct` | boolean | Submitted answer matches the frozen answer key |
| `found_target` | boolean | Participant selected/opened the target memory |
| `elapsed_seconds` | nonnegative number | Time to answer, capped at the preregistered limit |
| `confidence_1_to_7` | integer | Participant's confidence in the response |
| `workload_1_to_7` | integer | Perceived task workload |
| `technical_issue` | boolean | A documented issue affected this trial |

Do not put participant names, actual memories, locations, contact details, or other direct identifiers in this CSV.

## Reproducibility record

Before a session, record the app commit, database migration version, deterministic seed/scenario version, browser and viewport, algorithm coefficients, search radius, traversal depth, pruning threshold, task order, and approved protocol version. Keep this record separate from participant identifiers. Archive the analysis script and a redacted, aggregate-only report with the final research submission.

## Current limitations

This protocol has not been reviewed by an ethics committee, power analysis has not been performed, the scenario task set and frozen answer key have not been built, and no participant data exist. Complete those steps and obtain approval before any human evaluation. Until then, cognitive validity remains untested.
