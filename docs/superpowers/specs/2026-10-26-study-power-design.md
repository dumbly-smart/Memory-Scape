# Paired binary study power sensitivity

## Intent

Add an offline planning tool for the human-study protocol's paired binary accuracy outcome. The tool estimates participant counts for an exact conditional McNemar test from assumed rates of discordant paired outcomes.

## Approaches

- Use a normal approximation: fast, but less dependable with sparse discordant pairs.
- Enumerate exact conditional binomial power under McNemar's test: selected because the protocol's primary outcome is paired binary accuracy and the method retains discrete small-sample behavior.
- Add a statistical package: rejected to keep the prototype reproducible without a new runtime dependency.

## Scope and assumptions

Inputs are the probability that only MemoryScape is correct and the probability that only conventional recall is correct. Their sum is the discordant-pair probability; their ratio determines the conditional alternative. The calculation uses a two-sided exact conditional binomial test, fixed alpha, target power, and a participant-level pair as the independent unit. Output is a planning sensitivity analysis, not a confirmatory analysis, approved sample-size justification, or evidence. A pilot and preregistration must establish plausible inputs before recruitment.

## Success criteria

Pure tested functions compute exact conditional power and the minimum sample size up to a documented cap; the CLI prints a transparent sensitivity table; documentation states the assumptions and institutional approval requirements.
