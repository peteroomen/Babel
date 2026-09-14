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

## Milestone 6 — playtest instrumentation

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

## Milestone 7 — only after the game is fun

Then consider:

- character powers;
- visual polish and animation;
- online multiplayer;
- AI opponents;
- extra cards/enemies/buildings;
- sound/music;
- persistence/meta progression.
