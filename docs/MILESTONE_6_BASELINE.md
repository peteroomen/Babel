# Milestone 6 baseline — resource agency

**Date:** 2026-09-16
**Run:** `npm run model -- --games 30`, 30 games per variant, 3 Leaders
(Architect, Commander, Industrialist), round cap 120.

These are the first numbers from the implemented rules rather than from the
pre-implementation model. Treat them as directional: 30 games gives a standard
error of roughly 9 percentage points on a win rate, so only differences well
past that are worth reading.

## The control is healthy

| | Control (canon v0.1) |
|---|---|
| Shared win rate | 56.7% |
| Timeouts | 10.0% |
| Mean rounds | 69.0 |
| Mean Babel pieces standing | 9.4 of 15 |

That sits inside the 50–65% band `MODEL_NOTES.md` recorded before
implementation, which is the first time the two models have agreed. It is the
line every candidate below is read against.

**Caveat on length.** A mean of 69 rounds is 207 turns at 3 Leaders. Whether
that is a game anybody wants to sit through is a design question this harness
cannot answer, but it is the most striking number in the run.

## Same-kind Barter: does what it was meant to, changes nothing else

| | Control | Same-kind |
|---|---|---|
| Barter share of actions | 16.4% | **13.4%** |
| Resources from Barter | 4.6% | 3.6% |
| Access rate | 47.6% | 42.8% |
| Surplus per Leader at end | 111.2 | 90.3 |
| Shared win rate | 56.7% | 60.0% |

Barter drops by about a fifth and stops being a precision converter — resources
sourced from it fall to 3.6%. Leaders get the resource they are chasing less
often (47.6% → 42.8%), which is the intended cost. Hoarding falls with it:
about twenty fewer unspent resources per Leader by the end, because a stack
that cannot be converted gets spent on something instead.

The win rate does not move beyond noise. That is the good outcome: the change
is about how it feels to be short of something, not about difficulty.

**Recommendation: adopt `barterMode: 'sameKind'` for canon v0.2**, subject to
human sessions. It achieves what the milestone asked for at no measurable cost
to the shape of the game.

## Shared tile Reserve: not yet tested

| | Reserve 1 | Reserve 2 |
|---|---|---|
| Turns the Reserve was swapped | **0.9%** | **2.0%** |
| Dead tiles refilled per game | 0.00 | 0.00 |

**The Reserve arms are effectively duplicates of the same-kind arm and should
not be read as evidence about the Reserve.** The agents almost never use it.

This is not the swap threshold being too strict. Probing the decision directly
across 959 place-step turns: at a margin of zero — swap on *any* improvement —
the agent would still only swap 8.0% of the time, and anything above 0.25
settles at ~2%.

The cause is the agent, not the rule. It scores a placement by the resources it
pays *this turn*, and a blind draw placed at the best of twenty-odd legal
squares is usually already fine by that measure. The reasons a person would
take a Reserve tile — shaping a river to wall off an invasion lane, denying a
rival the Hills they obviously need, setting up a feature three turns out — are
all invisible to it.

Two ways forward, in order of preference:

1. **Human playtest.** The browser now exposes Reserve slots in the table
   settings, so this can be answered by playing rather than by improving a bot.
   Milestone 6's own subjective prompt — *could you pursue the plan you wanted
   this turn?* — is the right instrument here.
2. Give the placement evaluator some lookahead before trusting any model number
   on the Reserve. Note the risk: a bot tuned until it likes the Reserve will
   report that the Reserve is good.

The dead-slot rule is implemented and enforced by tests, but it never fired in
360 games — no Reserve tile ever became unplaceable. It stays as a guard rather
than as a live mechanic.

## Where resources actually come from

| Source | Control | Same-kind |
|---|---|---|
| Tile placement | 53.3% | 51.4% |
| Harvesting buildings | 42.1% | 45.0% |
| Barter conversion | 4.6% | 3.6% |

Barter was never the economy. It is a corrective, and the milestone's concern
that it had become "the primary precision-resource engine" is not borne out at
16.4% of actions and 4.6% of resources. What it *was* doing is letting Leaders
convert their way out of any shortage; that is what same-kind removes.

## Action mix, against the pre-implementation record

| Action | 2026-09-15 model | Control now |
|---|---|---|
| Attack | 39.5% | 40.9% |
| Barter | 21.1% | 16.4% |
| Babel | 13.1% | 14.5% |
| Build (harvesters) | 12.7% | 5.5% |
| Muster | 6.3% | 3.6% |
| Scheme | 3.6% | 0.4% |
| Tower | — | 11.3% |
| Walls | — | 5.6% |

Attack and Babel land where the earlier model put them. Three differences are
worth noting, and all three are about the agents rather than the rules:

- **Towers at 11.3%** did not exist in the earlier mix. They are the only
  multiplier that scales with the whole table, and they matter enormously.
- **Schemes at 0.4%** are all but unused. Only the Merchant archetype buys them
  and it is not in the classic three-Leader table. Schemes are effectively
  untested by this harness.
- **Muster at 3.6%** is low. Metal gates Muster, Towers and Schemes alike and is
  the scarcest resource on the board; see below.

## Metal is the bottleneck

Not a variant result, but the clearest structural observation from building the
agents. Mountain is the rarest yielding terrain (weight 16 against Forest and
Farmland at 24), and Metal is the only thing that Muster, Towers and Schemes all
require — while Attack is free and produces nothing.

The rational line is therefore to attack with whatever Army you happen to have
and never invest, which is exactly what every early version of the agent
converged on, and it loses. Every version that wins had to be told to fund the
engine before swinging. A human will find this out too, more slowly.

Worth a look before v0.2 settles. It is also the reason the Lake question
matters more than it looks: Lake takes weight off the terrain that yields.

## The Lake question

Not run. `npm run model -- --lake` compares Lake at 0%, 4% and 8% against a
fixed Barter and Reserve setting, with the weight taken off Desert so the
yielding terrains keep their share of the bag. It is ready; it has not been
executed.

## What this run does not tell you

- Anything about the Reserve, as above.
- Anything about Schemes, at 0.4% of actions.
- Anything about 2-Leader or 4-Leader tables. Beacon counts, Host Defence and
  pieces-per-Stage all scale with the player count, and only 3 was run.
- Anything about how any of it feels.
