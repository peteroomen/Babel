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

---

# Third round — confirmation, and Babel's cost curve

## Same-kind Barter at four cards, confirmed

`npm run model -- --confirm --games 90`

| | Control | Same-kind, 4 cards |
|---|---|---|
| Shared win rate | 60.0% | **78.9%** |
| Timeouts | 10.0% | 2.2% |
| Mean rounds | 64.1 | 57.1 |
| Babel pieces standing | 9.8 | 11.9 |
| Barter share | 15.8% | 13.0% |
| Build share | 5.9% | 8.5% |

At n=90 the gap is +18.9 points against a difference standard error of about 7,
so roughly 2.7 standard errors. The n=25 result held.

One thing the smaller run could not see — **strategic diversity improves
sharply**:

| Individual wins by | Control | Same-kind, 4 cards |
|---|---|---|
| Architect | 3.4% | 19.7% |
| Commander | 41.4% | 33.8% |
| Industrialist | 57.4% | 45.1% |

Canon has the Architect functionally unable to win on Prestige. Under
same-kind-4 all three strategies are live. Milestone 6 asks explicitly that
extra agency must not collapse strategic diversity; this does the opposite.

**Confirmed recommendation: `barterMode: 'sameKind'`, `barterCost: 4`.**

## Babel's cost curve

`npm run model -- --babel --games 45`. Every candidate holds the *total*
resources per piece at canon's 3, 5 and 8, so these test the mix, not the price,
and all run on canon Barter so the two do not confound.

| | Cost by Stage | Win rate | Rounds | Pieces | Barter |
|---|---|---|---|---|---|
| **Control** | B2+F1 / B4+F1 / B6+F2 | 64.4% | 65.1 | 10.6 | 16.5% |
| **Layered** | B2+F1 / B3+W2 / B4+M3+F1 | 68.9% | 61.6 | 10.8 | 16.3% |
| **Broad** | B1+W1+F1 / B2+W2+M1 / B3+W2+M2+F1 | **84.4%** | 61.9 | **13.4** | 16.0% |
| **Metal spine** | B2+F1 / B2+W3 / B2+M4+F2 | 68.9% | 71.6 | 11.5 | 16.2% |

**Broad is the strongest single change tested anywhere in this milestone.**
Every Stage wanting three resources means every Leader's income is useful to
Babel, whatever terrain they happen to be sitting on, instead of everyone
competing for the one terrain that yields Brick.

It also gives Metal a sink at last — Metal left unspent falls from 21.1 per
Leader to 11.2. The first baseline noted Metal as the bottleneck that gates
Muster, Towers and Schemes; asking Babel for some of it makes Metal something a
Leader actively works for rather than a wall they hit.

**Metal spine is the one to avoid.** Four Metal per piece in Stage III is more
than the board reliably supplies: games run longest (71.6 rounds), timeouts are
worst (15.6%), and Brick piles up unused at 34.4 per Leader.

### The hypothesis that did not hold

Changing the cost mix **does not reduce Barter**. Every curve lands within half
a point of control: 16.5% → 16.3% / 16.0% / 16.2%.

The reasoning behind the idea was sound — three quarters of all Barters convert
into Brick, so spreading the cost off Brick ought to remove the need. It does
not, because Barter is a *response to being short of something*, not a response
to being short of Brick specifically. Spreading Babel's cost across four
resources changes which resource a Leader is short of; it does not change how
often they are short. The Barter lever is Barter's own cost, and the Babel
lever is a different, larger improvement that happens to be about something
else.

## They do not stack

`npm run model -- --stack --games 45`

| | Control | Same-kind 4 | Broad Babel | **Both** |
|---|---|---|---|---|
| Shared win rate | 64.4% | 77.8% | **84.4%** | 73.3% |
| Mean rounds | 65.1 | 54.8 | 61.9 | 54.4 |
| Barter share | 16.5% | 13.2% | 16.0% | **10.7%** |
| Resources from Barter | 4.8% | 3.4% | 4.5% | **2.7%** |
| Access rate | 47.2% | 42.6% | 48.5% | 40.3% |

Together they land *below* either alone. The two changes pull in opposite
directions on resource access: Broad raises it to 48.5% by making every income
stream useful, while same-kind-4 lowers it to 42.6% by removing the conversion
escape. Combined, 40.3% — the tightest of anything tested, and apparently past
the point where the table can absorb it.

The combination is not bad, and it does produce the lowest Barter share in the
milestone (10.7%) and the most even spread of individual wins (27/27/39). But
it buys those with a win rate eleven points below Broad alone, and at n=45 that
gap is only about 1.4 standard errors — enough to say "no additive benefit",
not enough to rank them confidently.

## Where this leaves v0.2

Two independent, well-evidenced improvements that should not both be taken:

1. **Broad Babel cost** — the bigger win-rate effect, keeps games a touch
   shorter, gives Metal a purpose. Does nothing about Barter.
2. **Same-kind Barter at four** — confirmed at n=90, cuts Barter, and fixes the
   Architect's inability to win on Prestige.

They address different complaints. If the concern is the *game*, take Broad. If
the concern is *Barter*, take same-kind-4. Taking both measurably costs win
rate without a matching gain.

Both are in the browser's table settings. This is now a question about which
game is more fun, which no amount of further running will answer.

---

# Round four — a factorial sweep of five levers

Rather than more authored head-to-heads, this round runs **every combination**
of five levers: 32 cells, 12 games each, 384 games. A lever's *main effect* is
then measured across every setting of the other four (192 games either side,
standard error about 5 points) instead of against one arbitrary baseline — and
interactions become visible, which is what the earlier rounds kept tripping on.

`npm run sweep -- --cells 0-15 --games 12 --out a.json` (and 16-31), then
`npm run sweep -- --report a.json b.json`.

| Lever | Δ win rate | Δ Barter | Δ rounds | Δ Babel pieces | Δ surplus |
|---|---|---|---|---|---|
| **P** Babel: broad cost curve | **+21.9%** | +0.6% | +2.8 | +3.3 | +11 |
| **B** Barter: four of one kind | +9.4% | **−3.7%** | −5.4 | +0.8 | +5 |
| **R** Rivers: terminators | +6.2% | +0.7% | −2.4 | +0.6 | −5 |
| **D** Desert blocks Hosts | −12.5% | −1.1% | −5.6 | −1.9 | −3 |
| **M** Monument (Prestige sink) | **−24.0%** | −0.5% | +14.8 | −2.7 | +9 |

Best cells: `PR` and `BPR` at 91.7%, `P` and `BP` at 83.3%.
Worst: every cell containing `M` bar one, plus `PDM` at 25.0%.

## The Monument was a bad idea, and why is the useful part

It is the worst lever tested: −24 points, games fifteen rounds longer, three
fewer Babel pieces standing — and **surplus went *up* by 9**. A sink that fails
to drain the thing it was built to drain is telling you the diagnosis was wrong.

It was. The late game is not short of things to buy. **It is short of
actions.** A Leader gets one action per turn and earns resources every turn
regardless, so the pile grows whatever is on the menu. Adding another thing to
spend an action on cannot drain it — it can only crowd out Babel and defence,
which is exactly what the numbers show.

That reframes the original complaint. "Resources feel useless" is really *"I
can never spend what I earn, because I only act once a turn."* Things that
could actually address it:

- spend resources as part of an action you were taking anyway, rather than as a
  competing action (placement costs, or paying to improve a placement);
- let one action consume much more (build several Babel pieces at once);
- more actions per turn late on;
- or simply earn less — cut payouts rather than add sinks.

None of those are what I proposed, and the sweep is what caught it.

## Desert blocking Hosts backfires, for a non-obvious reason

−12.5 points. Measured directly across 20 games:

| | Terminators | + Desert blocks |
|---|---|---|
| Mean Beacon distance from Babel when sited | 4.40 | **3.54** |
| Hosts spawned per game | 174.9 | 123.0 |
| Host moves per game | 192.9 | 105.5 |
| Arrivals at Babel | 21.7 | 19.1 |

Making terrain impassable shrinks the region connected to Babel — and a Beacon
must have a land route to Babel to be legal (GDD §13). So Beacons are forced
into that shrunken region, **closer to the Foundation**. Spawns fall 30% and
Hosts move far less, but arrivals fall only 12%, because every Host that does
spawn starts a shorter walk.

You trade a longer journey for a nearer start, and the nearer start wins. This
is not an argument against the idea — it is an argument that Beacon siting has
to compensate, for example by requiring a minimum distance from Babel.

## Terminators do not fix rivers — my error

I proposed raising the share of one-edge river shapes to cap floating ends. The
win rate said +6.2 points, which looked like success. The geometry says
otherwise:

| | Canon | Terminators (first attempt) | Terminators (corrected) |
|---|---|---|---|
| Mean river chain | 2.73 tiles | **2.24** | **1.94** |
| Single-tile rivers | 45% | 38% | 44% |
| Frontier squares locked to a river tile | 20% | 21% | **14%** |

The first attempt raised the *total* river share as well as the source share,
which made rivers more numerous and shorter. Correcting that — holding rivers at
canon's 23% and shifting only the mix — genuinely cut the locked squares from
20% to 14%, but made chains shorter still.

**The two goals are in tension.** One-edge caps reduce blocking and shorten
rivers; the straights, bends and tees that make long rivers are exactly what
creates the blocking. Source weight cannot buy both.

## Forcing rivers to extend does fix it

The other idea — a river tile must join water already on the board — is the one
that works, and it is not close:

| | Canon | Rivers must extend |
|---|---|---|
| Mean river chain | 2.73 tiles | **9.40** (longest seen: 33) |
| River ends pointing at empty ground | 35% | **7%** |
| Frontier squares locked to a river tile | 20% | **0%** |
| River tiles as a share of board | 14.0% | 5.7% |

Long rivers, essentially no floating ends, and the placement blocking gone
entirely.

**It is not free.** Rivers are impassable, so cutting river tiles from 14% of
the board to 5.7% removes most of the terrain that was quietly defending Babel:

| | win | Barter | rounds | pieces |
|---|---|---|---|---|
| canon | 60% | 13.8% | 66 | 9.5 |
| **B + P** | **80%** | 13.9% | 48 | 12.0 |
| B + P + must extend | 72% | **9.8%** | 52 | 10.8 |
| canon + must extend | 36% | 13.7% | 56 | 5.9 |

Must-extend costs about 8 points on top of B+P and 24 on canon. That is a
difficulty knob — Host Defence or Beacon counts can pay it back — not a reason
to reject the rule. It also drops Barter to 9.8%, the lowest figure recorded
anywhere in this milestone, presumably because a less blocked frontier means
Leaders can place for the resource they actually want.

## Where this leaves it

**Take: broad Babel cost (P) and same-kind Barter at four (B).** 80% shared
wins against canon's 60%, games 48 rounds instead of 66, twelve Babel pieces
standing instead of nine and a half.

**Take, with compensation: rivers must extend.** It is the only thing that fixes
the map, and the map was the complaint. Budget a difficulty adjustment for it.

**Reject: the Monument**, and with it the theory that the late game needs more
sinks rather than more actions.

**Hold: Desert blocking Hosts** until Beacon siting stops rewarding it with
closer spawns.

---

# Canon v0.2 — adopted

`CANON_RULES` now carries the two levers the sweep backed. `LEGACY_V01_RULES`
is frozen alongside it so every future report can still show the delta from the
baseline the earlier rounds were measured against, and the harness keeps a
`v01` variant for exactly that.

- **Babel costs a broad bundle**: 1B+1W+1F, 2B+2W+1M, 3B+2W+2M+1F by Stage.
  Same totals per piece as v0.1 (3, 5, 8) — only the mix moved.
- **Barter takes four of one resource.**

Over 25 games at 3 Leaders: 88% shared wins against v0.1's 44%, 58 rounds
against 72.

## What the economy looks like now

The question this was all supposed to answer — do resources still pile up?

**Yes, nearly as much.** Per Leader over a whole game:

| | v0.1 earned | v0.1 unspent | v0.2 earned | v0.2 unspent |
|---|---|---|---|---|
| Food | 69.9 | 41.8 (**60%**) | 67.4 | 38.2 (**57%**) |
| Wood | 74.1 | 36.5 (49%) | 57.6 | 17.8 (**31%**) |
| Brick | 60.4 | 16.5 (27%) | 50.6 | 23.1 (**46%**) |
| Metal | 38.7 | 22.9 (59%) | 38.0 | 11.9 (**31%**) |
| **Total** | **243.1** | **117.7 (48%)** | **213.7** | **91.0 (43%)** |

Forty-three per cent of everything earned is still never spent. The broad curve
did not drain the pile — it **moved** it:

- **Wood and Metal are fixed.** Both fall from about half unspent to under a
  third. Babel now eats them, which is exactly what it was for, and Metal
  finally has a sink.
- **Brick got worse**, 27% → 46%. Babel wants less of it than it used to, so the
  resource that was the bottleneck is now surplus. The shortage moved rather
  than closing.
- **Food is the outstanding problem**, and was already the worst under v0.1:
  57% unspent, 38 per Leader. Its only sinks are Muster (1), a Scheme (1) and
  one or two per Babel piece. Nothing else in the game asks for Food at all.

This is the action-scarcity result from round four showing up per resource. A
Leader earns every turn and acts once, so a pile accumulates whatever is on the
menu; widening what Babel asks for redistributes which pile grows without
changing the total much.

**Two things did improve that the playtest complained about.** Harvesters go
from 14% to 19% of early actions — worth building, because their output is now
worth something to Babel. And Babel itself rises from 14% to 21% of late
actions, so the endgame is less exclusively Attack.

**The next lever is Food**, or the action budget itself — not another sink.
