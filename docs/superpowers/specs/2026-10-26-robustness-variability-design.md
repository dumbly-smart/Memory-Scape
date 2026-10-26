# Edge-removal robustness variability

## Intent

Make the synthetic graph robustness experiment easier to interpret by summarizing its five deterministic edge-removal trials at each removal fraction. The existing report lists every trial but makes the variability hard to compare.

## Approaches

- Keep only per-trial rows: no new assumptions, but readers must aggregate values themselves.
- Report descriptive mean, sample standard deviation, minimum, and maximum for F1 and MRR: concise and explicit about the observed five trials; selected.
- Add inferential confidence intervals: rejected because five seeded synthetic corruptions are not a defensible sample for population-level inference.

## Scope and constraints

Use the existing seeded fixture and trials. Do not change the retrieval algorithm, scenario generation, or database state. Add a pure metric-summary helper, integrate its output into JSON and Markdown artifacts, and test its arithmetic and empty-input handling. Label summaries as descriptive synthetic-trial statistics, not confidence intervals or human evidence.

## Success criteria

Each edge-removal fraction reports count and F1/MRR mean, sample standard deviation, min, and max; calculations are deterministic and unit tested; the report states the interpretation limit.
