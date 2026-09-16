# BABEL modelling notes

The headless model was used to catch structural balance failures before implementation. Treat the numbers below as directional, not proof of balance: the agents are heuristic and human play now matters more than further bot tuning.

> **Superseded in part.** This document records the pre-implementation model.
> A model that runs against the *implemented* rules now lives in
> `packages/harness` — see `docs/AI_AND_HARNESS.md` to run it and
> `docs/MILESTONE_6_BASELINE.md` for the first results. Where the two disagree,
> the harness wins: it plays the real rules with the same agent a person meets
> in the browser. The final 3-Leader shape below is broadly confirmed — 56.7%
> shared wins against the 50-65% recorded here — with two corrections: Towers
> are far more central than the old action mix suggested (11.3% of actions),
> and Schemes are effectively unused at 0.4%.

## What the modelling established

- **Host Defence 5 / 6 / 7** is the current 3–4 Leader baseline. 4/5/6 was too soft; 6/7/8 too punishing.
- **Army dice** replaced additive Might. Each Army die uses `d6 + 2` against Host Defence and can be assigned across Hosts.
- **Towers act only during a player's Attack action.** Each occupied feature with a Tower contributes one targeted support die. Passive Heaven-phase Tower fire was rejected as less clear.
- **Walls are temporary Wood barricades**, not permanent path blockers. Crossing spends movement and destroys the Wall.
- **Seraphs** arrive in Stage III as Movement-2, Shield-1 Hosts requiring two successful hits.
- **Industrial infrastructure** pays every foreign building owner the placement payout but gives the placing player only one +1 helper bonus total per expanded feature. Recurring harvester-trigger Prestige was removed; the recurring reward is economic.
- **Foundation loss** is two-step: first Host at zero Babel pieces occupies the Foundation; a second arrival while occupied loses the game.
- **Explicit player-count scaling** is required. Solo controls two Leaders rather than trying to make one action support the whole game.

## Final 3-Leader shape

Representative final batches with Architect / Commander / Industrialist agents produced roughly 50–65% shared wins depending on seed/batch, with successful-game average Prestige around:

- Architect: 53.9
- Commander: 50.5
- Industrialist: 52.0

Prestige wins were distributed rather than dominated by one strategy. One selfish player was survivable and could win Prestige; two or more selfish players sharply reduced the shared win rate.

Representative action mix:

- Attack ~39.5%
- Barter ~21.1%
- Babel ~13.1%
- Build ~12.7%
- Muster ~6.3%
- Scheme ~3.6%

Barter and Attack frequency are explicit human-alpha watch items.

## Scaling baseline

| Leaders | Pieces/stage | Beacons I/II/III | First Beacon | Defence I/II/III |
|---:|---:|---|---|---|
| 2 | 3 | 1/1/2 | Round 3 | 4/5/6 |
| 3 | 5 | 1/2/3 | Round 2 | 5/6/7 |
| 4 | 6 | 1/3/4 | Round 2 | 5/6/7 |

Solo uses two Leaders and the 2-Leader rules.

## Do not overfit the bots

The next balance evidence should come from the browser alpha with telemetry. Keep the structural rules stable and tune only where human play exposes a real issue. See `FINAL_BALANCE_PASS_2026-09-15.md` for the final pre-canon report.
