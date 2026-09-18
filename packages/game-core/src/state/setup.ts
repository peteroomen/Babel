import {
  CANON_RULES,
  MAX_RESERVE_SLOTS,
  RIVER_WEIGHTS,
  SCHEME_DECK,
  confusionCardsForStage,
  type ConfusionId,
  type RuleSet,
} from '@babel-game/game-data';
import { coordKey } from '../map/edges.js';
import { hasAnyLegalPlacement, type Board } from '../map/placement.js';
import { createRng, nextInt, shuffle, weightedPick, type RngState } from '../rng/index.js';
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
export function drawTile(
  rng: RngState,
  rules: RuleSet = CANON_RULES,
): [TileDraw, RngState] {
  const [terrain, afterTerrain] = weightedPick(rng, rules.terrainWeights);
  const [river, afterRiver] = weightedPick(
    afterTerrain,
    rules.riverWeights[terrain] ?? RIVER_WEIGHTS[terrain],
  );
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
  rules: RuleSet = CANON_RULES,
): { draw: TileDraw; rng: RngState; discarded: TileDraw[] } {
  const discarded: TileDraw[] = [];
  let state = rng;

  for (let attempt = 0; attempt < MAX_REDRAWS; attempt++) {
    const [draw, next] = drawTile(state, rules);
    state = next;
    if (hasAnyLegalPlacement(board, draw, rules)) return { draw, rng: state, discarded };
    discarded.push(draw);
  }

  throw new Error(
    `no placeable tile after ${MAX_REDRAWS} draws; the board or the river bag is malformed`,
  );
}

export function setupGame(
  names: readonly string[],
  seed: string,
  rules: RuleSet = CANON_RULES,
): GameState {
  if (names.length < 2 || names.length > 4) {
    throw new Error(`BABEL supports 2-4 Leaders, got ${names.length}`);
  }
  if (rules.reserveSlots < 0 || rules.reserveSlots > MAX_RESERVE_SLOTS) {
    throw new Error(`reserveSlots must be 0-${MAX_RESERVE_SLOTS}, got ${rules.reserveSlots}`);
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

  /* GDD §19: the Stage-I Confusion deck, and this round's card. */
  const [confusionDeck, afterConfusionShuffle] = shuffle(
    afterFirst,
    confusionCardsForStage(1),
  );
  const [schemeDeck, afterSchemeShuffle] = shuffle(afterConfusionShuffle, SCHEME_DECK);
  const [revealed, ...remainingConfusion] = confusionDeck as ConfusionId[];

  const { draw, rng, discarded } = drawPlaceableTile(board, afterSchemeShuffle, rules);
  const opener = order[first] as PlayerId;

  /* The Reserve starts full, so the first Leader already has the choice the
     variant is meant to give them. */
  const opening = fillReserve(board, [], rules, rng);

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
    walls: [],
    confusion: { card: revealed ?? null, cancelledBy: null },
    confusionDeck: remainingConfusion,
    confusionDiscard: [],
    schemeDeck,
    schemeDiscard: [],
    actionsThisRound: {},
    bonusWindow: null,
    inBonusAction: false,
    freeBarterUsed: false,
    falseProphet: null,
    babel: { stack: [] },
    riverReachRecord: 1,
    beacons: [],
    beaconCharge: [],
    hosts: [],
    hostSeq: 0,
    pendingBeacon: null,
    pendingAttack: null,
    drawnTile: draw,
    reserve: opening.reserve,
    pendingVote: null,
    rules,
    rng: opening.rng,
    log: [
      { type: 'roundStarted', round: 1 },
      ...(revealed ? [{ type: 'confusionRevealed', card: revealed } as const] : []),
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
      ...(opening.reserve.length > 0
        ? [{ type: 'reserveRefreshed', tiles: opening.reserve, reason: 'filled' } as const]
        : []),
    ],
    winner: null,
    lossReason: null,
  };
}

/**
 * Top the Reserve up to its configured size, dropping any tile that has become
 * unplaceable.
 *
 * Milestone 6: "if a Reserve tile has no legal placement anywhere at the start
 * of a turn, discard/refill it rather than allowing a permanently dead slot".
 * A tile can go dead as the map closes up around it — rivers in particular —
 * and a dead slot would quietly shrink the variant back towards no Reserve.
 */
export function fillReserve(
  board: Board,
  current: readonly TileDraw[],
  rules: RuleSet,
  rng: RngState,
): { reserve: readonly TileDraw[]; dropped: TileDraw[]; added: TileDraw[]; rng: RngState } {
  const kept = current.filter((tile) => hasAnyLegalPlacement(board, tile, rules));
  const dropped = current.filter((tile) => !hasAnyLegalPlacement(board, tile, rules));
  const reserve = [...kept];
  const added: TileDraw[] = [];
  let state = rng;

  while (reserve.length < rules.reserveSlots) {
    const next = drawPlaceableTile(board, state, rules);
    state = next.rng;
    reserve.push(next.draw);
    added.push(next.draw);
  }

  /* Shrinking the Reserve mid-game is not a supported move, but trimming
     rather than throwing keeps a hand-built state usable. */
  return { reserve: reserve.slice(0, rules.reserveSlots), dropped, added, rng: state };
}
