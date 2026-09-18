# Spawn cadence experiments

These are experimental `RuleSet` candidates only. They do not change
`CANON_RULES`, Host statistics, Beacon siting, Babel costs/height, or AI
strategy. Historical balance measurements predate the canonical combat/rules
repairs and should not be used as a direct baseline without rerunning them.

Run a screen with compact per-cell JSON and incremental writes:

```sh
npm run cadence -- --games 12 --seed-prefix screen-20260917 --players 2 --output docs/experiments/cadence/screen
npm run cadence -- --games 12 --seed-prefix screen-20260917 --players 3 --output docs/experiments/cadence/screen
npm run cadence -- --games 12 --seed-prefix screen-20260917 --players 4 --output docs/experiments/cadence/screen
```

Use `--variants id,id`, `--roster-mode diverse`, or `--output DIR` to narrow a
run. The fixed rosters are AC, ACI, and ACIE. Diverse mode cycles balanced
subsets of the five archetypes and rotates seats in blocks, so a 10-seed pair
screen covers all ten pairs before rotating the first seat.

Cadence cycles are integer arrivals per Heaven Phase. They are anchored to the
scheduled first Beacon round for the player count using absolute round offset:
Stage transitions and deferred Beacon placement do not restart a cycle or
replay an opening grace period. The 0.75 candidates use `[0,1,1,1]`, so their
anchor phase is intentionally quiet; this is recorded in the candidate note,
not hidden as a long-run average.

The JSON reports win/loss/timeout rates with Wilson 95% intervals, winning-round
mean/median, player turns, action shares, Stage reach/loss Stage, Hosts spawned
and killed, Beacon deferrals, and zero-Host games. Paired seeds share the
initial seed only; once candidates diverge in draws or state, their RNG streams
are not identical.

Each game retains the harness `ROUND_CAP` of 120 rounds. Reaching that cap is a
timeout, not a win or loss; timeout-heavy cells should not be treated as
steady win-rate estimates.

The unattended opponents use the existing heuristic AI. They assign combat
dice by Defence and decline Frenzied Works; results are an AI stress screen,
not a claim about human strategic difficulty.
