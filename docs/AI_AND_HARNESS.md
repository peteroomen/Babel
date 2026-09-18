# The AI and the model harness

Two things, one policy. `@babel-game/game-ai` decides what a Leader does;
`@babel-game/harness` plays thousands of games with it and counts what happened.
They share the policy on purpose: a harness result is then evidence about the
opponent a person actually meets in the browser, not about a second
implementation that only exists in a test.

```
game-data ── rules and tuneable numbers, including the RuleSet
    │
game-core ── the rules themselves. Pure. Knows nothing about players or UI.
    │
    ├── game-ai ── what a Leader should do. Pure. Returns Commands.
    │       │
    │       ├── apps/web ── a person plays; AI Leaders take the other seats
    │       └── harness ── unattended games, variants, metrics, CLI
```

## Playing against the AI

Open the table settings in the header. Set **Leaders** to the size of table you
want and **Played by the machine** to how many of those seats are bots. Bots
take the last seats, so you are always the first Leader; set the machine count
to one below the Leader count to play solo.

Beacon siting, the Heaven Phase and the Confusion window stay with the human.
Those are the table's decisions rather than any one Leader's (RD-005, RD-008),
and handing them to a bot would quietly decide things a person should be
deciding.

When nobody is at the table — an unattended harness game — `tableCommand` makes
those calls instead. One of them is a real decision rather than a formality:
RD-008 lets the table pick between equally short routes for a Host, and
`heavenPlan` spends that choice on steering a Host into a Wall wherever one is
there to be walked into. That is what a competent table would do, and without it
a Wall only ever lands by luck, so every measurement of Walls was measuring the
dice.

## The archetypes

Five, each a short priority list rather than a search. A reader has to be able
to say what a bot wants, and a priority list makes that obvious in a way a
weighted evaluation function does not.

| Archetype | Plays for |
|---|---|
| **Architect** | Babel. Races the Tower upward and lets others worry about Heaven. |
| **Commander** | The Army. Metal first, then Towers, then kills things. |
| **Industrialist** | Harvesters. Gets rich, helps late. |
| **Engineer** | Towers and Babel's river. Makes the ground do the fighting. |
| **Merchant** | Schemes and Barter. Chases Prestige wherever it is cheapest. |

All five share two behaviours that the loss condition forces on them:

- **Siege response.** When a Host is one step from Babel, or the standing Host
  count reaches three per Beacon, every archetype drops its plan and defends.
  Humanity loses together (GDD §2), so the response has to be shared. Without
  this only the Commander ever defended and the table drowned.
- **Fund the plan before swinging.** Attack is free and produces nothing.
  Muster and Towers both need Metal, the scarcest resource on the board, so a
  Leader that attacks through a shortage never escapes it.

### Writing another one

Add the name to `Archetype`, a label and a blurb, a `goal()` branch saying what
it saves for, and a branch in `chooseAction`'s switch. The `want()` /
resource-access metric follows from `goal()` automatically. `ai.test.ts` plays
every archetype in `ARCHETYPES` through a whole game, so a new one is covered
the moment it is listed.

## Running the model

```
npm run model                  # the four Milestone 6 variants, 200 games each
npm run model -- --games 400   # more seeds
npm run model -- --levers      # Attack cost and Barter cost instead
npm run model -- --babel       # Babel cost curves instead
npm run model -- --confirm     # control vs the leading candidate, more seeds
npm run model -- --stack       # the leading candidates alone and together

# The factorial sweep: every combination of five levers, in blocks.
npm run sweep -- --cells 0-15 --games 12 --out a.json
npm run sweep -- --cells 16-31 --games 12 --out b.json
npm run sweep -- --report a.json b.json
npm run model -- --lake        # the terrain-weight question instead
npm run model -- --river       # Prestige for lengthening Babel's river
npm run model -- --walls       # do Walls earn their rules text?
npm run model -- --json        # machine-readable, for diffing runs

# Two flags that apply to any set:
npm run model -- --river --paired               # same seeds for every variant
npm run model -- --walls --table engineer,commander,architect
```

`--paired` gives every variant the same seeds instead of seeds salted with the
variant's own name. The streams still diverge as soon as the rules make a
different number of draws, but the opening board and the first tiles are shared,
so two arms are compared on the same early game. Every result recorded before
round seven was measured unpaired, which is why it is off by default.

`--table` chooses who is sitting down. It matters more than it looks for any
question about a subsystem only one archetype plays: asking whether Walls earn
their place at a table with no Engineer at it answers a narrower question than
it appears to.

A game takes roughly three seconds, so a default run is a few minutes.

## Variants are configuration, not forks

A variant is a `RuleSet` handed to `setupGame`, and the state carries it for the
rest of the game. That means a replay from seed plus command log reproduces the
variant it was recorded under, the UI can offer the same switches a harness run
used, and no experiment ever needs a branch of the rules.

```ts
setupGame(names, seed, { ...CANON_RULES, barterMode: 'sameKind', reserveSlots: 1 })
```

`CANON_RULES` is canon v0.6 and is the default for the browser, setup helpers,
and generic live sweeps. `V05_RULES` and `V04_RULES` are frozen beside it so
v0.5 and v0.3/v0.4
comparison and the cadence experiment can be replayed bit-for-bit; the
historical `rounds.ts` sets and `CANON_VARIANTS` explicitly use that frozen
ruleset. Every earlier canon is kept frozen beside it — `LEGACY_V01_RULES`,
`V02_RULES`, `V03_RULES`, and `V04_RULES` — so a round's evidence can always be
re-read against the game it was proposed for.

## What the metrics mean

Most are counted straight off the event log. Two need defining:

- **Access rate** — of the turns where a Leader began short of something its
  current plan needed, the share where it gained at least one of that resource
  from any source. This is the harness's answer to the question Milestone 6
  asks human playtesters: *could you pursue the plan you wanted this turn?*
- **Surplus at end** — resources still in hand when the game ended, per Leader.
  A high number means the economy produced things nobody could use.
- **Payout per placement** — mean resources a placed tile paid its placer. The
  control on any rule that pays a Leader to place somewhere other than where the
  money is: if they are really taking worse squares, this falls.
- **Reach from Babel** — how far upstream the water that actually touches the
  Foundation runs, in tiles. Under canon it is about 2.5 at the end of a whole
  game, which is the fixed start tile and very little else.
- **Segments crossed** — the share of Wall segments ever built that a Host
  actually walked into. A Wall does nothing else, so this is the share of the
  Wood spent on Walls that bought anything at all.

## Two warnings

**The bots are a measuring instrument, not a design target.** They exist to make
variants comparable to each other. `docs/MODEL_NOTES.md` puts it correctly: do
not overfit them. If a rule change only looks good because of how a bot
happens to prioritise, it is not a result.

**Prefer the sweep to authored variants.** A head-to-head measures a lever
against one arbitrary baseline; the sweep measures it across every setting of
the others and shows interactions. Round three ranked two changes as winners
that turned out to cancel each other, and round four caught a proposed sink
that made the game 24 points worse. Both were visible in the factorial and
invisible in the head-to-heads.

**A bot defect looks exactly like a balance finding.** Every early run of this
harness reported a 0% win rate, which read as a brutally hard game. It was
three policy bugs: nobody built Towers, nobody mustered past Army 2, and the
round cap was shorter than a normal game. Before believing a result, check the
action mix and the resources left unspent — a table sitting on forty unused
resources is telling you about the bots, not about BABEL.
