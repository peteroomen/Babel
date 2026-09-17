# Round seven — Babel's river, and whether Walls earn their place

**Date:** 2026-09-17
**Run:** `npm run model -- --river` and `-- --walls`, 3 Leaders (Architect,
Commander, Industrialist), round cap 120.

Two questions came out of a play session, and they turn out to be the same
question asked twice: **what is the terrain for?**

1. Should lengthening the river that runs from Babel pay Prestige?
2. Do Walls do enough to be worth their rules text?

---

## 1. Babel's river

### The rule as modelled

GDD §5 fixes a Farmland tile north of Babel with its river running into the
Foundation. That tile is the root of what the code now calls **Babel's river**:
the connected chain of water that actually reaches Babel. Everything else on the
board is somebody else's river until it joins.

`riverPrestige` pays the Leader who placed a tile that joins that chain. Two
readings of "longer" were modelled separately, because they are different rules:

- **any join** — any tile that joins Babel's water scores, including one that
  thickens the river beside the Foundation;
- **reach** — only a placement that pushes the river's *furthest point* further
  from Babel scores. This is the rule as a person would say it aloud, and it is
  the one to prefer.

`riverGainFor` measures both against the board before the tile goes down, so a
Leader is paid for what they added rather than for what was already there.

### The first thing the model found has nothing to do with Prestige

Under canon, **Babel's river is a stub**: 2.35 tiles long, reaching 2.17 tiles
upstream, at the end of a whole game. The fixed start tile plus, usually,
nothing. Rivers appear all over the board and essentially never connect to the
one piece of water the fiction cares about.

Paying for it changes that immediately:

| | Control | Any join, +1 | Reach, +1 | Reach, +2 |
|---|---|---|---|---|
| Reach from Babel | 2.17 | 5.78 | **4.95** | 7.90 |
| Tiles in Babel's river | 2.35 | 6.80 | 5.17 | 8.47 |
| Placements paid | — | 4.5% | 3.0% | 4.9% |

This is not the Reserve: the agents respond to it, and the board looks different
at the end of the game. That is the first bar a candidate rule has to clear.

### It is not overpowered. It is barely a Prestige rule at all

| | Control | Any join, +1 | Reach, +1 | Reach, +2 |
|---|---|---|---|---|
| River Prestige per game (whole table) | 0.0 | 5.7 | **3.9** | 13.6 |
| Share of all Prestige earned | — | 2.9% | **1.9%** | 5.8% |

At +1 a Leader takes about 1.3 Prestige from the river across a game in which
they will score 60 to 80. Nobody wins on it and nobody can farm it, because the
supply is the bag: you can only extend the river on a turn the bag deals you a
river tile that fits.

### The wrinkle the rule was wanted for did not show up in the bots

The hoped-for effect was a Leader taking a worse square for the Prestige. The
metric for that is payout per placement, and it does not fall:

| | Control | Reach, +1 |
|---|---|---|
| Payout per placement | 1.812 | 1.867 |

Two honest readings, and the truth is probably both:

- **The choices rarely conflict.** A draw has twenty-odd legal squares, and one
  that extends the river usually also pays acceptably. The trade-off is real but
  it is not on the table every turn.
- **The bots cannot see the trade the rule is actually for.** They score a
  placement by the resources it pays *this turn* — the same blind spot that made
  the Reserve look useless. Denying a rival the Hills they need, shaping the
  approach three turns out, choosing the square that keeps a feature open: all
  invisible. A person's "non-optimal placement" is mostly made of those.

So: the model can say the rule does not cost a Leader income. It cannot say
whether it feels like a decision. That is a human-table question.

### What the rule actually does is change the difficulty

Rivers are impassable to Heaven. A rule that pays for extending Babel's river is
a rule that pays for **building a moat around the Foundation**, and that shows up
where you would expect:

| | Control | Reach, +1 | Reach, +2 |
|---|---|---|---|
| Shared win rate | 70.0% | 70.0% | 82.5% |
| Mean rounds | 39.2 | 44.1 | 46.2 |

At +1 the win rate does not move and the game runs about five rounds longer. At
+2 the table is winning 82.5% of the time, which is outside the 60-70% band the
difficulty round settled on. **The price is the lever, and 1 is the price.**

This is the thing to watch in human play, not Prestige inflation: the rule's
real cost is paid in Heaven's mobility, and a table that leans into it is buying
safety as much as points.

---

## 2. Walls

### What a Wall is worth, arithmetically

One Build action and 1 Wood places two segments and pays 1 Prestige. A Host that
crosses a segment destroys it and spends that movement standing still. So a Wall
buys **one Host-move of delay, once, if a Host ever walks that exact edge**.

It has to be that exact edge, because a Wall does not change where Heaven walks.
`distancesToBabel` — the shortest-route map every Host follows — does not know
Walls exist. A Wall never diverts anything; it only delays whatever happens to
step on it.

### The measurement

160 games per arm, paired seeds:

| | Control | No Walls |
|---|---|---|
| Shared win rate | 74.4% | 79.4% |
| Mean rounds | 41.2 | 36.8 |
| Mean Babel pieces | 11.2 | 11.9 |
| Walls' share of all actions | 3.3% | — |
| Segments built per game | 8.18 | — |
| Segments ever crossed | 2.77 (**33.9%**) | — |
| Still standing, unused, at the end | 5.41 | — |

Deleting the entire subsystem moves the win rate by 5 points, which at this
sample is about one standard error of the difference — nothing. Two thirds of
every Wall ever built is still standing at the end of the game, having never
been touched by anything.

Walls do lengthen the game by four rounds, which is the delay working as
designed. It buys Heaven-time, and Heaven-time is not what the table was short
of.

### The bot caveat, and why it is smaller than it looks

The harness is not allowed to flatter this result. Two things could be hiding
value:

- **The table chooses Heaven's route.** GDD §14 lets the players pick between
  equally short steps, and the *right* play is to steer a Host into your own
  Wall, since crossing it costs the Host its whole move. The bots did not do
  that — they picked at random — so the 33.9% crossing rate is luck, not play.
- **A Wall's value is positional**, and positional value is exactly what these
  agents cannot see.

The first one is fixable and was fixed: `heavenPlan` now steers a Host into a
Wall whenever the table has the choice, which is what a competent table would
do. See the re-run below.

### What Walls would have to become to be worth keeping

Three shapes were considered, and only one is interesting:

1. **More segments (`walls-4`) or free (`walls-cheap`).** Both were run. More
   Walls get built and more get crossed, and nothing else changes: the ratio is
   the same, so the subsystem is bigger rather than better.
2. **Walls reroute Heaven.** GDD §17 rules this out on purpose — "temporary
   barricades, not permanent pathfinding blockers" — and it is also the rule
   that would need the most new code, because a Host can then be sealed in.
3. **Delete them, and let the river do the job.** Walls and rivers are the same
   idea: ground that Heaven cannot simply walk over. The river already does it
   better — it is permanent, it is on a tile a Leader was placing anyway, it
   costs no action, and under the rule above it pays Prestige.

---

## What this round added to the code

Nothing here changes canon. Both questions are `RuleSet` levers, off by default,
exactly as Milestone 6 asks: a variant is configuration the state carries, not a
fork of the rules.

| | |
|---|---|
| `rivers/index.ts` | Babel's river: the flood fill from the fixed start tile, its reach and its size, and what one placement would do to both. |
| `rules.riverPrestige` | `perTile`, `requireReach`, `milestone`, `cap`. Null in canon. |
| `rules.walls` | `cost`, `segments`, `prestige` — or null, which removes the action from `getLegalActions` and refuses the command. |
| `heavenPlan` | The table's RD-008 route choice, spent on steering Hosts into Walls. |
| `--paired`, `--table` | Common seeds across variants; choose who is sitting down. |
| Metrics | River reach and size, river Prestige and its share, payout per placement, and Walls from built to crossed to still-standing. |

The AI values a river Prestige at `RIVER_PRESTIGE_WEIGHT` — 2 resources of
payout, 3 for the Merchant. That number is the experiment, so it is named in
`policy.ts` rather than buried, and every river result has to be read against
it. It is also why rotation is scored per candidate again: turning a tile never
changed its payout, but it decides entirely where the river runs.
