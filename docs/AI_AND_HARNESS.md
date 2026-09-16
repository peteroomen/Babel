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

## The archetypes

Five, each a short priority list rather than a search. A reader has to be able
to say what a bot wants, and a priority list makes that obvious in a way a
weighted evaluation function does not.

| Archetype | Plays for |
|---|---|
| **Architect** | Babel. Races the Tower upward and lets others worry about Heaven. |
| **Commander** | The Army. Metal first, then Towers, then kills things. |
| **Industrialist** | Harvesters. Gets rich, helps late. |
| **Engineer** | Towers and Walls. Makes the ground do the fighting. |
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
npm run model -- --lake        # the terrain-weight question instead
npm run model -- --json        # machine-readable, for diffing runs
```

A game takes roughly three seconds, so a default run is a few minutes.

## Variants are configuration, not forks

A variant is a `RuleSet` handed to `setupGame`, and the state carries it for the
rest of the game. That means a replay from seed plus command log reproduces the
variant it was recorded under, the UI can offer the same switches a harness run
used, and no experiment ever needs a branch of the rules.

```ts
setupGame(names, seed, { ...CANON_RULES, barterMode: 'sameKind', reserveSlots: 1 })
```

`CANON_RULES` is canon v0.1 and is the default everywhere.

## What the metrics mean

Most are counted straight off the event log. Two need defining:

- **Access rate** — of the turns where a Leader began short of something its
  current plan needed, the share where it gained at least one of that resource
  from any source. This is the harness's answer to the question Milestone 6
  asks human playtesters: *could you pursue the plan you wanted this turn?*
- **Surplus at end** — resources still in hand when the game ended, per Leader.
  A high number means the economy produced things nobody could use.

## Two warnings

**The bots are a measuring instrument, not a design target.** They exist to make
variants comparable to each other. `docs/MODEL_NOTES.md` puts it correctly: do
not overfit them. If a rule change only looks good because of how a bot
happens to prioritise, it is not a result.

**A bot defect looks exactly like a balance finding.** Every early run of this
harness reported a 0% win rate, which read as a brutally hard game. It was
three policy bugs: nobody built Towers, nobody mustered past Army 2, and the
round cap was shorter than a normal game. Before believing a result, check the
action mix and the resources left unspent — a table sitting on forty unused
resources is telling you about the bots, not about BABEL.
