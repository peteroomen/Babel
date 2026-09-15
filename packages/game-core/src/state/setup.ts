import { RIVER_WEIGHTS, TERRAIN_WEIGHTS } from '@babel-game/game-data';
import { coordKey } from '../map/edges.js';
import { hasAnyLegalPlacement, type Board } from '../map/placement.js';
import { createRng, nextInt, weightedPick, type RngState } from '../rng/index.js';
import { BABEL_COORD, START_TILE_COORD } from './babel.js';
import type { GameState, LeaderState, PlayerId, TileDraw } from './types.js';

/** How many unplaceable tiles to discard before giving up. See RD-002. */
const MAX_REDRAWS = 50;

function newLeader(id: PlayerId, name: string): LeaderState {
  return {
    id,
    name,
    /* GDD §5: each Leader begins with 2 Wood, 1 Food, Army 1, 0 Prestige. */
    resources: { food: 1, wood: 2, brick: 0, metal: 0 },
    prestige: 0,
    army: 1,
    schemeHand: [],
  };
}

/** GDD §6 / §22: blind draw from the bag, with replacement per RD-003. */
export function drawTile(rng: RngState): [TileDraw, RngState] {
  const [terrain, afterTerrain] = weightedPick(rng, TERRAIN_WEIGHTS);
  const [river, afterRiver] = weightedPick(afterTerrain, RIVER_WEIGHTS[terrain]);
  return [{ terrain, river }, afterRiver];
}

/**
 * Draw a tile that can actually be placed.
 *
 * RD-002: a drawn tile with no legal placement in any rotation is discarded and
 * redrawn. The bag is infinite, so nothing is exhausted by this.
 */
export function drawPlaceableTile(
  board: Board,
  rng: RngState,
): { draw: TileDraw; rng: RngState; discarded: TileDraw[] } {
  const discarded: TileDraw[] = [];
  let state = rng;

  for (let attempt = 0; attempt < MAX_REDRAWS; attempt++) {
    const [draw, next] = drawTile(state);
    state = next;
    if (hasAnyLegalPlacement(board, draw)) return { draw, rng: state, discarded };
    discarded.push(draw);
  }

  throw new Error(
    `no placeable tile after ${MAX_REDRAWS} draws; the board or the river bag is malformed`,
  );
}

export function setupGame(names: readonly string[], seed: string): GameState {
  if (names.length < 2 || names.length > 4) {
    throw new Error(`BABEL supports 2-4 Leaders, got ${names.length}`);
  }

  const order = names.map((_, i) => `p${i}`);
  const leaders = Object.fromEntries(
    names.map((name, i) => [`p${i}`, newLeader(`p${i}`, name)]),
  );

  /* GDD §5: the fixed Farmland tile, river running north-south into Babel. */
  const board: Board = {
    [coordKey(START_TILE_COORD)]: { terrain: 'farmland', river: 'straight', rotation: 0 },
  };

  /* GDD §5: randomise the First Player. */
  const [first, afterFirst] = nextInt(createRng(seed), order.length);
  const { draw, rng, discarded } = drawPlaceableTile(board, afterFirst);
  const opener = order[first] as PlayerId;

  return {
    round: 1,
    stage: 1,
    phase: 'turns',
    turnStep: 'place',
    order,
    currentPlayerIndex: first,
    firstPlayerIndex: first,
    leaders,
    board,
    buildings: {},
    babel: { stack: [] },
    beacons: [],
    hosts: [],
    hostSeq: 0,
    pendingBeacon: null,
    pendingAttack: null,
    drawnTile: draw,
    pendingVote: null,
    rng,
    log: [
      { type: 'roundStarted', round: 1 },
      ...discarded.map(
        (tile) =>
          ({
            type: 'tileDiscarded',
            player: opener,
            terrain: tile.terrain,
            river: tile.river,
            reason: 'noLegalPlacement',
          }) as const,
      ),
      { type: 'tileDrawn', player: opener, terrain: draw.terrain, river: draw.river },
    ],
    winner: null,
    lossReason: null,
  };
}
