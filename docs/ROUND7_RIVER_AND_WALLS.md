# Round seven — Babel's river, and whether Walls earn their place

**Date:** 2026-09-17
**Runs:** `npm run model -- --river`, `-- --walls`, and the `--river-confirm` /
`--walls-confirm` arms at 140-160 paired seeds each. 3 Leaders (Architect,
Commander, Industrialist) unless a table is named, round cap 120.

At 140 games a win rate carries about 3.5 points of standard error, so a gap
under about 10 points between two arms is not a result on its own. Every
difference below is labelled with whether it clears that.

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

Under canon, **Babel's river is a stub**: about 2.8 tiles long, reaching 2.6
tiles upstream, at the end of a whole game. The fixed start tile plus, usually,
nothing. Rivers appear all over the board and essentially never connect to the
one piece of water the fiction cares about.

Paying for it changes that immediately:

| | Control | Any join, +1 | Reach, +1 | Reach, +2 |
|---|---|---|---|---|
| Reach from Babel | 2.17 | 5.78 | **4.95** | 7.90 |
| Tiles in Babel's river | 2.35 | 6.80 | 5.17 | 8.47 |
| Placements paid | — | 4.5% | 3.0% | 4.9% |

(First pass, 40 seeds. The confirmation below puts reach at 6.41 under
`reach, +1`; the effect is larger with more seeds, not smaller.)

This is not the Reserve: the agents respond to it, and the board looks different
at the end of the game. That is the first bar a candidate rule has to clear.

### It is not overpowered. It is barely a Prestige rule at all

Confirmed over 140 paired seeds per arm:

| | Control | Reach, +1 | Reach, +2 |
|---|---|---|---|
| River Prestige per game (whole table) | 0.0 | **5.3** | 11.1 |
| Share of all Prestige earned | — | **2.4%** | 5.0% |
| Reach from Babel | 2.59 | **6.41** | 6.56 |
| Shared win rate | 75.0% | 80.7% | 80.7% |
| Mean rounds | 41.1 | 45.4 | 45.5 |

Note what doubling the price does *not* buy: the river comes out the same length
(6.41 against 6.56) and the table wins at the same rate. Past +1 the extra
Prestige is inflation — the bots were already taking every river square they
could reach, so the second point pays for behaviour the first point had already
bought.

At +1 a Leader takes about 1.8 Prestige from the river across a game in which
they will score 60 to 80. Nobody wins on it and nobody can farm it, because the
supply is the bag: you can only extend the river on a turn the bag deals you a
river tile that fits.

### The wrinkle the rule was wanted for did not show up in the bots

The hoped-for effect was a Leader taking a worse square for the Prestige. The
metric for that is payout per placement, and it does not fall:

| | Control | Reach, +1 | Reach, +2 |
|---|---|---|---|
| Payout per placement | 1.834 | 1.841 | 1.833 |

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
| Shared win rate | 75.0% | 80.7% | 80.7% |
| Mean rounds | 41.1 | 45.4 | 45.5 |

Both arms give up about 5.7 points of difficulty and four rounds of length, which
at 140 games is a little over one standard error of the difference — suggestive
rather than proven, and in the direction the mechanism predicts. It is the number
to watch if the rule is adopted, because it is the one that could quietly push
the table out of the 60-70% band the difficulty round settled on.

This is the thing to watch in human play, not Prestige inflation: the rule's
real cost is paid in Heaven's mobility, and a table that leans into it is buying
safety as much as points.

### A milestone instead of a stipend — the idea that should have been better

Per-tile Prestige is *income*: everyone who draws a river tile takes a point and
nobody competes for it. A milestone is *claimed* — only one Leader can be the one
who takes the river from five tiles to six — so it ought to be worth taking a bad
square for, which is the wrinkle the whole rule was wanted for.

It does not work. 120 paired seeds:

| | Control | +1 per tile | +2 every 3rd | +3 every 4th |
|---|---|---|---|---|
| Reach from Babel | 2.66 | **6.39** | 3.18 | 2.92 |
| River Prestige per game | 0.0 | 5.3 | 1.7 | 1.3 |
| Placements paid | — | 3.8% | 0.7% | 0.4% |

The milestone arms barely move the river at all, and the rarer the milestone the
worse it gets. The reason is a chicken and egg that no amount of tuning fixes:
**the reward only exists at the threshold, and the river only arrives at the
threshold if somebody paid for the tiles in between.** Nobody does, so it never
arrives, so the milestone is never claimed.

It is worse than that with people at the table, not better. A milestone at six
tiles means the Leaders who place tiles four and five are building a prize for
whoever happens to draw the right tile next. A human sees that faster than a bot
does.

So the stipend it is — and the reason the stipend works is exactly the thing that
looked like its weakness. It pays every contributor a little, so the river is
built by everyone, which is what makes it long enough to matter.

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

The first one is fixable and was fixed. `heavenPlan` now spends the table's
RD-008 route choice on walking Hosts into Walls whenever one of their equally
short steps crosses one. Re-run, same 160 paired seeds:

| | Walls, played by luck | Walls, played correctly | No Walls |
|---|---|---|---|
| Shared win rate | 74.4% | 75.6% | 79.4% |
| Segments ever crossed | 33.9% | **35.1%** | — |

Playing Walls properly is worth about one point of crossing rate and about one
point of win rate. The reason it changes so little is structural: a Host only
has a choice to steer at all when two of its steps are equally short, and only
matters when one of those two carries a Wall. Eight segments on a hundred-tile
board almost never meet that condition.

So the objection is real, quantified, and small. Walls are not being wasted by
the bots. They are just not worth much.

### At a table that actually likes Walls, they are a trap

Every number above comes from the Architect / Commander / Industrialist table
every earlier round was measured on — and none of those three is the archetype
built around Walls. Asking whether Walls earn their place at a table with no
Engineer at it answers a narrower question than it looks like it does. So the
same comparison, at an Engineer / Commander / Architect table, 120 paired seeds:

| | Control | No Walls |
|---|---|---|
| Shared win rate | **47.5%** | **81.7%** |
| Timeouts | 17.5% | 0.0% |
| Mean rounds | 70.4 | 43.2 |
| Mean Babel pieces | 8.5 of 15 | 12.3 of 15 |
| Walls' share of all actions | 15.7% | — |
| Segments built per game | 65.7 | — |
| Segments ever crossed | 34.8 (53.0%) | — |

Thirty-four points, at a sample where that is roughly seven standard errors.
This is not noise and it is not a rounding difference: **a table with a
wall-builder at it loses the game half the time, and the same table with Walls
deleted wins it four times in five.**

What happens is legible in the action mix. The Engineer pours 15.7% of the
table's actions into Walls. The delay is real — 34.8 segments a game actually get
crossed, far more than the 2.9 at the other table — and it buys nothing, because
what Heaven is delayed *from* is a Babel that never gets built. Eight and a half
pieces of fifteen after seventy rounds, against twelve and a half after
forty-three.

And the Engineer is paid for it the whole time: +1 Prestige per Wall action, 33
actions a game, 95.8 Prestige in a game humanity loses. That is the shape of a
trap — individually rewarded, collectively fatal — and it is the weakest seat at
its own table even so (8.8% of individual wins, against the Architect's 77.2%).

A trap can be good design when the game tells you it is one. This one is
disguised as the defensive option, it is named after the thing a besieged city
obviously builds, and it pays Prestige on the turn you take it.

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

---

## Recommendations

### Adopt the river at +1, per tile, on reach

```ts
riverPrestige: { perTile: 1, requireReach: true, milestone: null, cap: null }
```

**Why this shape and not another.** `requireReach` because "longer" should mean
longer, not wider. Per tile rather than by milestone because a milestone is a
prize somebody else's tiles pay for, and the model says nobody builds toward it.
+1 rather than +2 because the second point buys no more river (6.41 tiles against
6.56) and no different game — it is inflation with extra steps. No cap, because
the bag is already the cap.

**What it is worth.** Babel's river goes from a 2.6-tile stub to 6.4 tiles.
Prestige from the river is 2.4% of the total, about 1.8 points per Leader per
game: real enough to notice on the score track, nowhere near enough to win on.

**The thing to watch.** Not Prestige — difficulty. Water is the ground Heaven
cannot walk, so this rule pays Leaders to build a moat, and the shared win rate
drifts from 75.0% to 80.7% with four more rounds on the clock. That is a little
over one standard error, so it is a direction rather than a fact, but the
mechanism is real and the 60-70% band is not far below. If human tables confirm
the drift, the answer is a Heaven knob (Defence, arrivals), not a smaller river
reward — the reward is doing its job.

**What the model cannot tell you.** Whether it *feels* like a decision. Payout
per placement does not move (1.834 → 1.841), so the bots are not giving up
income for it — but the bots score a square by what it pays this turn, so the
kind of "non-optimal placement" a person actually makes is invisible to them.
The rule is switchable in the browser's table settings for exactly this reason.

### Remove Walls

At the standard table they are inert: deleting the subsystem moves nothing that
can be told from noise, two thirds of every segment built is never touched, and
playing them correctly instead of by luck is worth about a point. At a table with
a wall-builder in it they are worse than inert — 47.5% shared wins against 81.7%
without them, while paying the wall-builder 95.8 Prestige for losing the game.

The alternatives do not rescue them. More segments and free Walls both make the
subsystem *bigger* at the same ratio. Making Walls reroute Heaven rather than
merely delay it is the one change that would matter, and GDD §17 rules it out on
purpose — "temporary barricades, not permanent pathfinding blockers" — because a
Host that can be sealed out is a Host that can be sealed out forever.

**The two proposals fit together, which is the real argument.** Walls and rivers
are the same idea: ground Heaven cannot simply walk over. The river does it
better on every axis — permanent rather than one crossing, on a tile a Leader was
placing anyway rather than a whole action, free rather than 1 Wood, and under the
rule above it pays Prestige for the same act. Walls are the weaker sibling of a
system the game already has. Cutting them removes an action from the action bar
and a paragraph from the rulebook, and loses nothing the river does not cover.

**What removal costs.** GDD §20's "Defender / fortified Commander" identity keeps
both of its other legs — Prestige for raising a Tower, and Prestige when a Tower
support die hits — so the style survives; it stops being a thing you can do
badly forever. The `engineer` archetype needs rewriting around Towers and river
shaping rather than Walls, which is a policy change, not a rules change.

### Not adopted, and why they are worth keeping on the shelf

| | |
|---|---|
| `riverPrestige.milestone` | The better-sounding rule that measures worse. Kept so the next person who has the idea can see the run instead of repeating it. |
| `riverPrestige.cap` | Unnecessary while the bag limits supply. It becomes interesting if a Reserve or a tile-choice rule ever lets a Leader pick river tiles on demand. |
| `walls-4`, `walls-cheap` | Both tested. Both scale the subsystem without changing its ratio. |

## What would change these answers

- **A human table taking worse squares for the river.** The one claim the model
  cannot make, and the one that decides whether this is a good rule or merely a
  harmless one.
- **A Wall that reroutes.** If GDD §17's "no pathfinding blockers" is ever
  reopened, everything above about Walls is void and needs re-running.
- **A tile-choice rule.** Every river number here assumes a blind draw. A Reserve,
  or any rule that lets a Leader pick terrain, uncaps the river strategy and the
  cap stops being decorative.
