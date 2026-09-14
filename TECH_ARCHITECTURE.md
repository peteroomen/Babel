# Technical architecture recommendation

## Target

Digital-first browser board game, initially local hot-seat, eventually suitable for online multiplayer and deployment as a web app.

## Recommended base stack

- **TypeScript** everywhere.
- **React** for UI.
- **Vite** for the first prototype unless the implementation agent has a strong reason to require a full-stack framework immediately.
- **Vitest** for unit/rules tests.
- A pure `game-core` package/module containing authoritative rules and state transitions.

### boardgame.io: spike, don't marry it blindly

boardgame.io is unusually well matched to turn-based board games: phases, turn order, multiplayer synchronization, logs and React bindings. However, as checked on 2026-09-15, npm's current `boardgame.io` release is still `0.50.2` and was published roughly four years ago, although the GitHub repository has seen 2026 maintenance activity.

Therefore:

1. Spend a short spike proving that boardgame.io can represent BABEL's turn/Heaven-phase flow, hidden Scheme hands and future multiplayer without fighting the library.
2. If the spike is clean, use it as the orchestration/networking layer.
3. If it creates friction or dependency risk, use a small custom deterministic state machine instead. **Do not put BABEL's core rules inside framework-specific callbacks.**

The architecture should survive either choice.

## Proposed repository shape

```text
babel/
  README.md
  docs/
    GDD.md
    RULES_QUICK_REFERENCE.md
    FINAL_BALANCE_PASS_2026-09-15.md
  apps/
    web/
      src/
        components/
        board/
        panels/
        game-ui/
  packages/
    game-core/
      src/
        state/
        rules/
        map/
        features/
        heaven/
        combat/
        cards/
        scoring/
        rng/
      test/
    game-data/
      src/
        terrain.ts
        buildings.ts
        confusion.ts
        schemes.ts
        scaling.ts
  reference_model/
    babel_sim.py
    test_babel_sim.py
```

A monorepo is optional; the important boundary is **pure game-core vs rendering**.

## Core state sketch

The exact types may change, but aim for explicit serializable state:

```ts
type Coord = { x: number; y: number };

type GameState = {
  round: number;
  stage: 1 | 2 | 3;
  babel: BabelState;
  board: Record<string, PlacedTile>;
  walls: WallEdge[];
  beacons: Beacon[];
  hosts: Host[];
  leaders: LeaderState[];
  currentPlayer: string;
  firstPlayer: string;
  confusion: ConfusionState;
  terrainDeck: TerrainTile[];
  schemeDeck: SchemeCard[];
  log: GameEvent[];
  rngSeed: string;
};
```

Do not store derived feature membership permanently unless profiling proves necessary. Recompute/cache through one shared feature service so occupation and harvester logic cannot diverge.

## Important services

### `getConnectedFeature(board, coord)`
Returns all orthogonally connected tiles sharing the same base terrain. River overlays do not split the feature.

### `getLegalTilePlacements(state, tile)`
Central source of truth for square adjacency and river-edge legality.

### `getHostRoutes(state, host)`
Shortest legal land routes to Babel accounting for river impassability and current Walls as movement delays rather than absolute blockers.

### `applyMove(state, command, rng)`
Pure state transition returning `{ state, events }`.

### `getLegalActions(state, playerId)`
The UI renders from this result rather than duplicating action prerequisites.

## Randomness

Use seeded RNG. Store enough information in the event log to replay a game exactly.

Random inputs include:

- terrain draw;
- combat dice;
- Scheme draw;
- Confusion draw / reshuffle;
- Seraph spawn selection in Stage III.

## Multiplayer later

Do not implement networking first. But avoid architecture that makes it impossible:

- game state must be JSON-serializable;
- commands should be explicit and validated server-side later;
- hidden Scheme hands require per-player views when online multiplayer is added;
- RNG should be authoritative, not client-local.

## Rendering

Use ordinary DOM/CSS or SVG for the first board. Do not start with Phaser/WebGL unless the square grid becomes a real rendering bottleneck. We need a rules prototype, not an engine demo.

## Deployment

Any static-capable host is fine for local/hot-seat prototype. If online multiplayer is added, introduce a server/authoritative session layer then. Do not let hosting dictate milestone 1 architecture.
