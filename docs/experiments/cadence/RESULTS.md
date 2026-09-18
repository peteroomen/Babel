# Spawn cadence experiment results

Status: provisional experiment report. These candidates are not canon and do
not change `CANON_RULES`, Host statistics, Beacon siting, Babel costs/height,
or AI strategy.

## Method

The screen contained 228 unattended games: 14 initial cells and five authorized
refinement cells, 12 paired games per cell. The fresh validation added 360
games, for 588 games total. The existing heuristic AI played
all Leaders; `playGame(..., { paired: true })` shared each seed across the
variants in a cell, but RNG streams diverged as soon as a rules difference
changed draws or state. Fixed rosters were AC, ACI, and ACIE, rotated by seed.

The fresh validation uses 60 games per selected cell with `--roster-mode
diverse`: balanced subsets of the five archetypes, with seat rotation in roster
blocks. Wilson intervals are descriptive 95% binomial intervals, not a model of
the roster mixture. Every game retains the 120-round cap; a cap hit is a
timeout, not a win or loss. A zero-Host game is flagged as possible geography
contamination rather than silently discarded.

Exact commands:

```sh
npm run cadence -- --games 12 --seed-prefix screen-20260917 --players 2 --variants p2-1-2-2,p2-1-1-1,p2-1-1-1.5,p2-1-1.5-1.5,p2-0.75-1-1 --output docs/experiments/cadence/screen
npm run cadence -- --games 12 --seed-prefix screen-20260917 --players 3 --variants p3-1-2-2,p3-1-1-1,p3-1-1.5-1.5,p3-1-1.5-2 --output docs/experiments/cadence/screen
npm run cadence -- --games 12 --seed-prefix screen-20260917 --players 4 --variants p4-1-2-2,p4-1-2.5-2.5,p4-1-3-3,p4-1.5-2-2,p4-1.5-2.5-2.5 --output docs/experiments/cadence/screen
npm run cadence -- --games 12 --seed-prefix screen-20260917 --players 2 --variants p2-1-0.75-1,p2-1-0.75-0.75,p2-1-0.5-1 --output docs/experiments/cadence/refine
npm run cadence -- --games 12 --seed-prefix screen-20260917 --players 4 --variants p4-1-2.25-2.25,p4-1-2-2.5 --output docs/experiments/cadence/refine
npm run cadence -- --games 60 --seed-prefix validate-20260917 --players 2 --roster-mode diverse --variants p2-1-2-2,p2-1-0.75-0.75 --output docs/experiments/cadence/validation
npm run cadence -- --games 60 --seed-prefix validate-20260917 --players 3 --roster-mode diverse --variants p3-1-2-2,p3-1-1.5-1.5 --output docs/experiments/cadence/validation
npm run cadence -- --games 60 --seed-prefix validate-20260917 --players 4 --roster-mode diverse --variants p4-1-2-2,p4-1-2-2.5 --output docs/experiments/cadence/validation
```

The validation command is reproducible; all six cells below contain 60 games
from their per-cell files.

## 12-game screen

`W/T` is wins/timeouts. These are screening signals, not reliable rates.

| Players | Cadence | W/T |
|---:|---|---:|
| 2 | 1/2/2 (canon) | 0/0 |
| 2 | 1/1/1 | 4/0 |
| 2 | 1/1/1.5 | 1/1 |
| 2 | 1/1.5/1.5 | 0/0 |
| 2 | .75/1/1 | 3/0 |
| 2 | 1/.75/1 | 7/0 |
| 2 | 1/.75/.75 | 7/0 |
| 2 | 1/.5/1 | 5/0 |
| 3 | 1/2/2 (canon) | 4/0 |
| 3 | 1/1/1 | 12/0 |
| 3 | 1/1.5/1.5 | 9/0 |
| 3 | 1/1.5/2 | 5/0 |
| 4 | 1/2/2 (canon) | 9/0 |
| 4 | 1/2.5/2.5 | 3/0 |
| 4 | 1/3/3 | 2/0 |
| 4 | 1.5/2/2 | 8/0 |
| 4 | 1.5/2.5/2.5 | 5/0 |
| 4 | 1/2.25/2.25 | 5/3 |
| 4 | 1/2/2.5 | 5/0 |

## Fresh diverse-roster validation

All six selected cells are complete, with 60 games in each per-cell file.

| Players | Cell | Wins / n | Wilson 95% | Timeouts | Zero-Host | Mean winning round | Action share Attack / Babel / Tower |
|---:|---|---:|---:|---:|---:|---:|---|
| 2 | 1/2/2 canon | 5/60 | 3.6–18.1% | 1 | 5 | 28.0 | 38.0% / 8.2% / 11.2% |
| 2 | 1/.75/.75 | 25/60 | 30.1–54.3% | 8 | 5 | 54.6 | 38.2% / 10.9% / 12.8% |
| 3 | 1/2/2 canon | 2/60 | 0.9–11.4% | 3 | 0 | 58.0 | 42.2% / 12.1% / 14.2% |
| 3 | 1/1.5/1.5 | 20/60 | 22.7–45.9% | 6 | 0 | 60.5 | 40.4% / 14.2% / 14.0% |
| 4 | 1/2/2 canon | 31/60 | 39.3–63.8% | 7 | 0 | 59.4 | 40.6% / 14.1% / 13.4% |
| 4 | 1/2/2.5 | 12/60 | 11.8–31.8% | 4 | 0 | 64.7 | 41.7% / 14.0% / 13.9% |

The same five two-player seeds had zero Hosts in both arms (seeds 17, 34, 35,
45, and 55). Geography therefore inflates the absolute two-player rates but
does not explain the observed paired improvement: after excluding those games,
the candidate won 20/55 contact games versus 0/55 for canon. The 3-player and
4-player comparisons had no zero-Host games. The roster mix still matters: in
the fresh two-player validation, Merchant-containing teams produced 3/24 wins
and 7 timeouts, while teams without Merchant produced 22/36 wins and 1
timeout. These are selection limitations, not evidence that the cadence effect
is roster-invariant.

## Interpretation

Provisionally, easing Stage II improves the 2-player and 3-player AI screens,
while the 2-player zero-Host geography inflates both absolute rates. The
4-player validation confirms that raising late pressure remains a large
difficulty increase: the fixed screen fell from 9/12 canon wins to 5/12 at
1/2/2.5, and the diverse validation fell from 31/60 to 12/60. Neither diverse
cell had zero-Host games. Broader rosters already struggle more under canon,
so the stronger cadence overshoots; this is not a general-purpose four-player
schedule.

The provisional recommended schedule is Stage I 1 for every count, Stage II
and III 0.75 for two players, 1.5 for three players, and 2 for four players
(1/.75/.75, 1/1.5/1.5, and 1/2/2). The across-count win-rate span narrows from
48.3 percentage points under the controls (8.3%, 3.3%, 51.7%) to 18.3 points
under those selections (41.7%, 33.3%, 51.7%). CIs overlap, so this is not an
equivalence proof; a fresh holdout is still needed before canon adoption.
Winning-player turns remain long (108.8, 181.05, and 236.42 for the selected
two-, three-, and four-player arms), with 8/60, 6/60, and 7/60 timeouts. Keep
four-player cadence unchanged pending that holdout, and review Beacon/pacing
semantics, geography, timeout handling, and AI limitations before adopting any
cadence into canon. These are descriptive screens, not a claim that the
candidate schedules produce stable human win rates.

## Raw data

- [Initial screen JSON](screen/)
- [Refinement JSON](refine/)
- [Diverse validation JSON](validation/) (the per-cell `p4-p4-*.json` files
  are authoritative; concurrent 4-player writers can make `summary-p4.json`
  reflect only the last writer)
- [Cadence methodology and semantics](README.md)

Implementation/tooling checks: base rules repair commit `2de4555`; cadence
tooling and tests bring the suite to 364 passing tests, and the production build
passes. The unattended AI assigns combat dice by Defence and declines Frenzied
Works, so these measurements are an AI stress screen rather than a human
difficulty claim.
