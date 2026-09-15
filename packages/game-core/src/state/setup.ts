import { TERRAIN_WEIGHTS, type TerrainType } from '@babel-game/game-data';
import { createRng, nextInt, weightedPick, type RngState } from '../rng/index.js';
import { coordKey, type GameState, type LeaderState, type PlayerId } from './types.js';

/** GDD §5. Babel's Foundation sits at the centre of the world. */
export const BABEL_COORD = { x: 0, y: 0 } as const;

/**
 * GDD §5: a fixed Farmland tile with a north-south river sits immediately
 * north of Babel and feeds it. Screen coordinates, so north is -y.
 */
export const START_TILE_COORD = { x: 0, y: -1 } as const;

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

export function drawTerrain(rng: RngState): [TerrainType, RngState] {
  return weightedPick(rng, TERRAIN_WEIGHTS);
}

export function setupGame(names: readonly string[], seed: string): GameState {
  if (names.length < 2 || names.length > 4) {
    throw new Error(`BABEL supports 2-4 Leaders, got ${names.length}`);
  }

  const order = names.map((_, i) => `p${i}`);
  const leaders = Object.fromEntries(
    names.map((name, i) => [`p${i}`, newLeader(`p${i}`, name)]),
  );

  /* GDD §5: randomise the First Player. */
  let rng = createRng(seed);
  const [first, afterFirst] = nextInt(rng, order.length);
  rng = afterFirst;

  const [tile, afterDraw] = drawTerrain(rng);
  rng = afterDraw;

  return {
    round: 1,
    stage: 1,
    phase: 'turns',
    turnStep: 'place',
    order,
    currentPlayerIndex: first,
    firstPlayerIndex: first,
    leaders,
    board: {
      [coordKey(START_TILE_COORD)]: { terrain: 'farmland', riverEdges: ['n', 's'] },
    },
    drawnTile: tile,
    pendingVote: null,
    rng,
    log: [
      { type: 'roundStarted', round: 1 },
      { type: 'tileDrawn', player: order[first] as PlayerId, terrain: tile },
    ],
    winner: null,
  };
}
