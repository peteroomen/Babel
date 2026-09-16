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

**Status: harness and candidates built; baseline established.** See
`docs/AI_AND_HARNESS.md` for how to run the model and
`docs/MILESTONE_6_BASELINE.md` for the first results.

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

## Milestone 7 — playtest instrumentation

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

## Milestone 8 — only after the game is fun

Then consider:

- character powers;
- visual polish and animation;
- online multiplayer;
- AI opponents;
- extra cards/enemies/buildings;
- sound/music;
- persistence/meta progression.
