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

---

# Second round — Attack cost and Barter cost

**Run:** `npm run model -- --levers --games 25`, same table and cap.
25 games gives a standard error of about 10 points on a win rate, so read
anything under 20 points apart as "no difference".

## Why Barter stayed high

The first round cut Barter from 16.4% to 13.4% and that felt like a small
return. Counting what was actually traded says why:

| | Control | Same-kind |
|---|---|---|
| Barters gaining **Brick** | 76% | 78% |
| Barters by the **Architect** | 66% | 63% |

**Three quarters of every Barter in the game is a Leader converting Wood and
Food into Brick to build Babel.** It is not a general-purpose precision engine;
it is a workaround for one specific shortage. Babel costs 2, 4 and 6 Brick by
Stage, and Brick comes only from Hills at weight 22.

That reframes the lever. Changing *what* Barter accepts barely touches it,
because a Leader stockpiling for Babel easily accumulates three of one thing.
Changing *what it costs* hits it directly:

| | Barter share | Resources from Barter |
|---|---|---|
| Control (any 3) | 16.4% | 4.6% |
| Same-kind (3 of one) | 13.4% | 3.6% |
| **Any 4** | **11.8%** | 3.3% |
| **Same-kind, 4 of one** | 14.0% | 3.7% |

The real question underneath is whether Babel should be that Brick-heavy. If
Barter is mostly a Brick workaround, the direct fix is Babel's cost curve, not
Barter's rules.

## Attack costing resources: the direction is right, every calibration fails

| | Win rate | Mean rounds | Babel pieces | Attack | Pass |
|---|---|---|---|---|---|
| Control (free) | **60.0%** | 69.9 | 9.5 | 40.9% | 1.9% |
| 1 Food per die | 0.0% | 29.2 | 0.0 | 24.4% | 12.1% |
| 1 Wood per die | 0.0% | 23.8 | 0.2 | 19.1% | 21.4% |
| 1 Food flat per Attack | 32.0% | 44.6 | 5.1 | 35.1% | 5.7% |

**Per die is catastrophic.** Attack is taken on two turns in five with two to
four dice, so a per-die price roughly doubles what a Leader spends across a
whole game. The table starves: Pass climbs to 12–21% — Leaders with literally
nothing they can afford to do — and Babel never leaves the ground.

I guessed Wood would work, on the grounds that Leaders end the control games
sitting on 33 unspent Wood each. **That was wrong, and it was worse than Food.**
The surplus is an end-state number: it accumulates late, and the deaths happen
early when nobody has any. Charging Attack in Wood also crowds out Walls, which
collapse from 5.7% to 0.7% — the cheapest defence in the game, gone.

**Flat is survivable but still expensive**: 32% against 60%. And that is the
actual finding —

> Attack is load-bearing. At 3 Leaders the table's kill rate barely matches
> Heaven's spawn rate already (3 attacks a round against 3 Hosts arriving in
> Stage III), so there is no slack to tax. Any price on Attack comes straight
> out of survival.

If you want Leaders to invest rather than swing, the lever is the other side:
make Muster and Towers cheaper or Metal more available, rather than making
Attack cost more. Pricing Attack *and* easing Host pressure together would be
the pair to test, not either alone.

## The one clear improvement: same-kind Barter at four cards

| | Control | Same-kind, 4 cards |
|---|---|---|
| Shared win rate | 60.0% | **76.0%** |
| Mean rounds | 69.9 | **55.0** |
| Babel pieces standing | 9.5 | **11.4** |
| Barter share | 16.4% | 14.0% |
| Build share | 5.4% | 8.9% |
| Surplus per Leader | 113.2 | 89.1 |

Better on every axis that was flagged as a concern: fewer Barters, more
building, less hoarding, and games fifteen rounds shorter — which addresses the
"69 rounds is a long game" worry from the first baseline. It is the best result
of anything tested.

Treat the win rate with care: +16 points at n=25 is under two standard errors.
The direction is consistent across every other metric, which is what makes it
worth taking seriously, but it wants a longer run before it becomes canon.

**Recommendation: `barterMode: 'sameKind'` with `barterCost: 4` for v0.2**,
confirmed by a longer run and human play. Leave Attack free.

## Two tiles in the Reserve

Already covered by `reserveSlots: 2` in the first round, and the caveat is
unchanged: the agents swap on 2.0% of turns with two slots against 0.9% with
one, so both arms remain effectively the control. Two slots is not untested
because it is uninteresting — it is untested because the bot cannot use it. It
needs a human.

## Everything above is still bots

The action mix says these agents attack on two turns in five and barter on one
in six. If your own play looks nothing like that, the numbers are describing a
different game from the one you are playing — which is exactly why the
playtest matters more than another run.
