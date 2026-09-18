import type { RuleSet } from '@babel-game/game-data';
import { OPPOSITE, coordKey, neighbour, riverEdgesOf, type Coord, type Rotation } from '../map/edges.js';
import { tileAt, type Board } from '../map/placement.js';
import { START_TILE_COORD } from '../state/babel.js';
import type { GameEvent, PlacedTile, PlayerId, TileDraw } from '../state/types.js';

/**
 * Babel's river: the water that actually reaches the Foundation.
 *
 * GDD §5 fixes a Farmland tile north of Babel with its river running into it,
 * so the river that feeds Babel is the connected chain rooted at that tile.
 * Every other river on the board is somebody else's water until it joins.
 *
 * Distance is counted in tiles: the start tile is 1, its river neighbours 2,
 * and so on. The furthest number in the map is the river's **reach**, which is
 * how far upstream Babel's water now runs, and the length of the map is how
 * many tiles the whole system covers — a river can gain tiles without gaining
 * reach by branching sideways, and the two numbers are what tell those apart.
 */
export function babelRiverDistances(board: Board): Record<string, number> {
  const start = tileAt(board, START_TILE_COORD);
  if (!start || start.river === 'none') return {};

  const distance: Record<string, number> = { [coordKey(START_TILE_COORD)]: 1 };
  let frontier: Coord[] = [START_TILE_COORD];
  let step = 1;

  while (frontier.length > 0) {
    step += 1;
    const next: Coord[] = [];
    for (const at of frontier) {
      const tile = tileAt(board, at);
      if (!tile) continue;
      for (const edge of riverEdgesOf(tile.river, tile.rotation)) {
        const other = neighbour(at, edge);
        const key = coordKey(other);
        if (key in distance) continue;
        const across = tileAt(board, other);
        if (!across) continue;
        /* RD-001 already forces both sides of a placed edge to agree, so this
           only ever rejects the empty-facing edges a river is allowed to have.
           Checking it anyway keeps the walk correct for a hand-built board. */
        if (!riverEdgesOf(across.river, across.rotation).includes(OPPOSITE[edge])) continue;
        distance[key] = step;
        next.push(other);
      }
    }
    frontier = next;
  }

  return distance;
}

const maxOf = (distance: Record<string, number>): number => {
  let best = 0;
  for (const value of Object.values(distance)) if (value > best) best = value;
  return best;
};

/** How many tiles of river reach Babel. */
export const babelRiverTiles = (board: Board): number =>
  Object.keys(babelRiverDistances(board)).length;

/** How far upstream Babel's river runs, in tiles. */
export const babelRiverReach = (board: Board): number => maxOf(babelRiverDistances(board));

/** What one placement would do to Babel's river. */
export type RiverGain = {
  /** Does the placed tile join the water that reaches Babel? */
  readonly joined: boolean;
  readonly reachBefore: number;
  readonly reachAfter: number;
  readonly tilesBefore: number;
  readonly tilesAfter: number;
};

/**
 * Measure a placement against Babel's river without mutating anything.
 *
 * `before` is optional purely so a caller scoring twenty candidate squares for
 * one draw can walk the existing river once instead of twenty times.
 */
export function riverGainFor(
  board: Board,
  at: Coord,
  draw: TileDraw,
  rotation: Rotation,
  before?: Record<string, number>,
): RiverGain {
  const prior = before ?? babelRiverDistances(board);
  const priorReach = maxOf(prior);
  const priorTiles = Object.keys(prior).length;

  if (draw.river === 'none') {
    return {
      joined: false,
      reachBefore: priorReach,
      reachAfter: priorReach,
      tilesBefore: priorTiles,
      tilesAfter: priorTiles,
    };
  }

  /**
   * The cheap question first: does any of this tile's river edges meet a tile
   * that is already part of Babel's river?
   *
   * A flood fill from Babel reaches the new tile if and only if one of its
   * river edges meets the existing network, so this decides `joined` exactly —
   * and a Leader scoring twenty candidate squares gets a negative answer for
   * nearly all of them without walking the board at all. Only a tile that does
   * join needs the second fill, because joining can also drag a whole
   * disconnected chain in behind it and change the reach by more than one.
   */
  const joined = riverEdgesOf(draw.river, rotation).some((edge) => {
    const other = neighbour(at, edge);
    if (!(coordKey(other) in prior)) return false;
    const across = tileAt(board, other);
    return across !== undefined && riverEdgesOf(across.river, across.rotation).includes(
      OPPOSITE[edge],
    );
  });

  if (!joined) {
    return {
      joined: false,
      reachBefore: priorReach,
      reachAfter: priorReach,
      tilesBefore: priorTiles,
      tilesAfter: priorTiles,
    };
  }

  const placed: PlacedTile = { ...draw, rotation };
  const after = babelRiverDistances({ ...board, [coordKey(at)]: placed });
  return {
    joined: true,
    reachBefore: priorReach,
    reachAfter: maxOf(after),
    tilesBefore: priorTiles,
    tilesAfter: Object.keys(after).length,
  };
}

/**
 * Prestige this placement would earn under the rules in force.
 *
 * `earned` is what this Leader has already taken from the river, for the cap.
 * Returns 0 whenever the rule is off, which is canon.
 */
export function riverPrestigeFor(
  board: Board,
  at: Coord,
  draw: TileDraw,
  rotation: Rotation,
  rules: RuleSet,
  earned = 0,
  before?: Record<string, number>,
  recordedReach?: number,
): number {
  const rule = rules.riverPrestige;
  if (!rule || rule.perTile <= 0 || draw.river === 'none') return 0;

  const gain = riverGainFor(board, at, draw, rotation, before);
  if (!gain.joined) return 0;
  const highWater = recordedReach ?? gain.reachBefore;
  if (rule.requireReach && gain.reachAfter <= highWater) return 0;

  let award = rule.perTile;
  if (rule.milestone !== null && rule.milestone > 0) {
    /* How many multiples of `milestone` this placement carried the reach past.
       Usually one; more when the tile joins a chain that was already there. */
    const crossed =
      Math.floor(gain.reachAfter / rule.milestone) - Math.floor(highWater / rule.milestone);
    if (crossed <= 0) return 0;
    award = rule.perTile * crossed;
  }

  if (rule.cap === null) return award;
  return Math.max(0, Math.min(award, rule.cap - earned));
}


/**
 * What this Leader has already taken from the river, for the cap.
 *
 * Read off the event log rather than carried in the state: the log is already
 * the record of every Prestige award, and a second copy of the same number in
 * `LeaderState` is one more thing a replay could get out of step with. Costs a
 * scan of the log per placement, which is nothing against a BFS of the board.
 */
export function riverPrestigeEarned(
  state: { readonly log: readonly GameEvent[]; readonly rules: RuleSet },
  player: PlayerId,
): number {
  /* Nothing needs the running total unless a cap is going to be applied. */
  if (!state.rules.riverPrestige || state.rules.riverPrestige.cap === null) return 0;
  let total = 0;
  for (const event of state.log) {
    if (event.type === 'prestigeGained' && event.source === 'river' && event.player === player) {
      total += event.amount;
    }
  }
  return total;
}
