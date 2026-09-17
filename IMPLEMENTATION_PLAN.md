# Prototype implementation plan

## Milestone 0 — framework spike

Goal: decide orchestration layer without committing the rules to it.

- Scaffold React + TypeScript + Vite.
- Build a tiny `game-core` with turn rotation and seeded draw.
- Try boardgame.io for one player turn + Heaven phase + hidden player state.
- Keep or reject boardgame.io based on friction, not sunk cost.

Exit: selected architecture documented; core remains framework-independent.

## Milestone 1 — spatial economy vertical slice

Build:

- square grid;
- five terrain types;
- river shapes and rotation;
- legal placement highlighting;
- feature detection;
- placement resource payout;
- 2–4 local hot-seat Leaders;
- resource cards/state;
- event/debug log.

Exit: drawing and placing terrain already produces interesting readable geography.

## Milestone 2 — industry, Babel and Prestige

Build:

- Sawmill, Farmstead, Brickworks, Mine;
- foreign expansion trigger;
- building ownership;
- occupation suppression hook;
- Babel physical stack/pieces;
- stage thresholds and player-count scaling;
- Babel Prestige;
- Barter;
- baseline Prestige UI.

Exit: players can build an economy and race/cooperate on Babel without Heaven.

## Milestone 3 — Heaven

Build:

- Beacon legality and collective placement UI;
- Ophanim Host spawning;
- shortest-path movement and tie selection;
- feature occupation;
- Babel strikes / Foundation breach;
- Army dice and Muster;
- Attack assignment UI;
- Seraph shields/movement.

Exit: complete game loop can win or lose.

## Milestone 4 — defensive geography

Build:

- Towers and targeted support dice;
- Walls as temporary barricades;
- Wall breaking and movement consumption;
- clear occupation/defended-feature visualization.

Exit: active army vs fortified-defense decisions can be human-playtested.

## Milestone 5 — compact card layer

Build only canonical cards:

- 3 Scheme effects / 6 cards total;
- 6 unique Confusion effects with staged additions;
- hidden Scheme hands;
- Confusion display and legal-action changes.

Exit: full canon v0.1 rules playable locally.

## Milestone 6 — resource agency experiment

**Status: done. Canon is v0.3.** See `docs/AI_AND_HARNESS.md` for how to run
the model and `docs/MILESTONE_6_BASELINE.md` for every round of results.

What the modelling adopted, in the order it was adopted:

- **v0.2** — same-kind Barter at four cards, and a Babel cost curve that
  spreads the same total across three resources per Stage.
- **v0.3** — Barter no longer costs the turn's action (once per turn), and
  Heaven arrives from a rolled table rather than one Host per Beacon: a d6 on
  the Stage's table says what comes, a die among the open Beacons says where,
  and a printed number per Stage says how many (1 / 2 / 2). Four new Host kinds
  came with it — Herald, Colossus, Swarm and Warded — each posing a problem the
  table's existing answers do not cover.

Measured at 67% shared wins over 30 games with 1.61 arrivals a round, against
92% and 2.03 for v0.2: fewer Hosts on the board, and a game you can lose.

Both candidates are implemented as a `RuleSet` carried by the game state rather
than a fork of the rules, so the browser can offer the same switches the model
ran. The agent policy that plays them lives in `@babel-game/game-ai` and is the
same policy a person meets when they add machine Leaders to their table.


Goal: reduce the feeling that resource access is dominated by blind terrain luck and repeated Barter actions, without making the map deterministic or adding a large new subsystem.

Treat these as **experimental v0.2 candidates**, not canon until the harness and human playtest support them.

### Barter candidate

Change Barter from “any 3 resources → 1 resource of choice” to:

- exactly **3 of the same resource → 1 resource of choice**;
- e.g. `3 Wood → 1 Metal` is legal;
- `2 Wood + 1 Food → 1 Metal` is not.

Purpose: keep Barter as an escape valve for large surplus stacks while preventing it from becoming the primary precision-resource engine.

### Shared tile Reserve candidate

Add a shared face-up Reserve / Survey slot beside the terrain bag.

At the start of a Leader's turn:

1. draw one placeable tile from the bag as normal;
2. either keep it, or swap it with one face-up Reserve tile;
3. if swapped, the unwanted drawn tile becomes the new Reserve tile;
4. place the selected tile, then take the normal one action.

Rules/implementation notes:

- swapping is free and is **not** an action;
- Reserve is communal, so one Leader may consume a tile another was planning around;
- `RESERVE_SLOTS` must be tuneable for harnessing;
- test `0 / 1 / 2` slots first, with **1** as the design favourite going in;
- if a Reserve tile has no legal placement anywhere at the start of a turn, discard/refill it rather than allowing a permanently dead slot;
- preserve the existing automatic redraw of impossible blind draws.

### Lake decision

Lake exists in the rules/type system but currently has draw weight `0`. During this milestone:

- decide whether Lake should enter the real terrain distribution as a low-frequency river terminus;
- if yes, harness at least a few small candidate weights rather than choosing by feel;
- keep total terrain weights explicit and comparable across variants.

### Do **not** add Harvest yet

Do not add a generic “Harvest this feature” action in this milestone. First test whether better tile agency plus stricter Barter fixes the action mix. A repeatable Harvest action risks making mature engines disengage from map placement.

If another economic fallback is still needed later, prefer an action that manipulates future tile choice / Reserve state over one that directly prints resources.

### Harness variants and metrics

At minimum compare:

- current blind draw + current mixed Barter (control);
- blind draw + same-kind Barter;
- Reserve 1 + same-kind Barter;
- Reserve 2 + same-kind Barter.

Track:

- Barter actions as % of all actions;
- Build / Babel / Muster / Attack / Scheme action shares;
- probability a Leader can access the resource type they are actively seeking;
- resource stockpiles by type and unused surplus at game end;
- resources generated by raw placement vs harvesting buildings vs Barter conversion;
- rounds to win/loss and shared win rate;
- Babel pacing by Stage;
- frequency with which Reserve tiles are swapped, ignored, or auto-refreshed;
- whether Reserve usage is concentrated on Hills/Mountains;
- Prestige outcomes by broad strategy so extra tile control does not collapse strategic diversity.

For human sessions, also record a simple subjective prompt after several turns: **“Could you pursue the plan you wanted this turn?”**

Exit: choose whether same-kind Barter and `RESERVE_SLOTS = 0/1/2` should become canon v0.2, based on harness results plus human feel rather than win rate alone.

## Milestone 7 — telegraphing the game state

**Next.** The rules are close to right; the screen is not yet saying what they
are doing. The last full playthrough surfaced this as the loudest remaining
problem: the active Confusion card was only visible if you opened the panel, so
a whole round's rule change could pass unnoticed. Nothing here changes a rule.
The goal is that a player can look up at any moment and know what just happened
and what is about to.

### Make the active state impossible to miss

- **Confusion is a permanent fixture, not a panel entry.** The card in force
  sits in the header for the whole round, face up, with its one-line effect
  readable without a click.
- **A new Confusion announces itself.** Each round's reveal plays once —
  the card turns over, holds long enough to read, then settles into its
  header slot. Introduce it, then leave it visible; the announcement is the
  thing that is currently missing, not the information.
- Same treatment for the other state that changes under you: Stage
  escalation, a Scheme coming into force, a Beacon opening.

### Animate what the dice and the pieces actually do

- **Dice rolls resolve on screen.** The dice land, then the successes are
  marked against the Defence they beat — so a player sees *why* three dice
  became one hit, rather than being handed the total.
- **Tile and building placement.** A placed tile drops into its square; a
  harvester or Tower stamps onto the tile; a Babel piece rises onto the stack.
  Each one is short, and each one names its own consequence — the resources a
  tile pays should visibly come *from* the tiles that paid them.
- **Heaven moves in sequence, not in a jump cut.** Hosts step tile by tile in
  spawn order, Walls break where they break, a Colossus visibly stops at the
  building it pulls down. The Heaven Phase is the moment players have the least
  information about and the most at stake in.

### Rules

- Every animation is skippable and interruptible: a player who already knows
  what happened must never wait for the screen to finish telling them. Respect
  `prefers-reduced-motion` by collapsing every transition to its end state.
- Animation reads `GameState` and the event log; it never becomes a source of
  truth. `game-core` stays pure and stays synchronous — if the animation layer
  were deleted the game would still be playable.
- Motion is short (150–400ms) and informative. Nothing moves that is not
  telling the player something they would otherwise have to work out.

Exit: a player who has not read the rulebook can name the active Confusion
card, say why their last Attack scored what it scored, and follow a whole
Heaven Phase, without opening a panel.

## Milestone 8 — the five-Stage Babel

**Followup to Milestone 7.** Three Stages of five or six pieces gives Heaven
only two escalation points, which is why the v0.3 spawn table has to introduce
three new Host kinds at once at Stage III. Five Stages of two pieces each gives
the same tower a slower, finer clock: **one new kind of Host arrives with each
new Stage**, so the table meets one new problem at a time and has a round or
two to find the answer before the next arrives.

This is a real refactor rather than a constant change. `Stage` is `1 | 2 | 3`
throughout the codebase, and every one of these is keyed on it:

- the player-count scaling table (pieces per Stage, Beacons owed);
- `babelPieceCost` and the Prestige awarded per piece;
- `hostDefenceBonus`, `SPAWN_TABLE` and `ARRIVALS_BY_STAGE`;
- Confusion and Scheme unlocks;
- `STAGE_LABEL` and everything in the UI that prints it.

Approach:

- widen `Stage` to `1 | 2 | 3 | 4 | 5` and let the type errors enumerate the
  work — every table above is exhaustive on `Stage`, so the compiler will find
  them all;
- keep total pieces per game roughly where they are, so this changes the
  *shape* of the escalation rather than the length of the game;
- keep three-Stage play available as a `RuleSet` variant so the harness can
  measure the new curve against the adopted one rather than replacing it on
  feel.

Exit: a factorial sweep of the five-Stage curve against v0.3, holding the win
rate in the 60–70% band, with the arrival mix showing one genuinely new
problem per Stage rather than a cliff at the top.

## Milestone 9 — playtest instrumentation

Record/export per game:

- rounds;
- winner / loss reason;
- Prestige by source;
- actions by type/player;
- Babel pieces built/lost;
- Hosts spawned/killed/reaching Babel;
- Host turns spent occupying features;
- resources created by raw placement vs harvesters;
- Tower hits and Walls broken;
- Barter frequency;
- Scheme usage.

Add optional deterministic replay from seed + command log.

Exit: human alpha sessions generate evidence comparable to the headless model.

## Milestone 10 — only after the game is fun

Then consider:

- character powers;
- online multiplayer;
- AI opponents;
- extra cards/enemies/buildings;
- sound/music;
- persistence/meta progression.
