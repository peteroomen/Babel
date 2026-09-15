import { describe, expect, it } from 'vitest';
import {
  EDGES,
  OPPOSITE,
  applyMove,
  coordKey,
  currentPlayer,
  getLegalTilePlacements,
  hasRiverOn,
  neighbour,
  setupGame,
  type Board,
  type GameState,
} from '../src/index.js';

/**
 * Property test: whatever sequence of legal moves is played, the board must
 * never contain two adjacent tiles that disagree across their shared edge.
 * RD-001 is only meaningful if it holds for the whole board, not just the tile
 * being placed.
 */
function findRiverMismatch(board: Board): string | null {
  for (const [key, tile] of Object.entries(board)) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    for (const edge of EDGES) {
      const other = board[coordKey(neighbour({ x, y }, edge))];
      if (!other) continue;
      const mine = hasRiverOn(tile.river, tile.rotation, edge);
      const theirs = hasRiverOn(other.river, other.rotation, OPPOSITE[edge]);
      if (mine !== theirs) {
        return `${key} (${tile.river}/${tile.rotation}) disagrees with its ${edge} neighbour`;
      }
    }
  }
  return null;
}

/** Play a game, choosing placements pseudo-randomly from the legal set. */
function playGame(seed: string, turns: number): GameState {
  let state = setupGame(['Ada', 'Peter', 'Rook'], seed);
  let cursor = 7;
  for (let i = 0; i < turns; i++) {
    const options = getLegalTilePlacements(state.board, state.drawnTile!);
    expect(options.length).toBeGreaterThan(0);

    cursor = (cursor * 31 + 17) % 1009;
    const option = options[cursor % options.length]!;
    const rotation = option.rotations[cursor % option.rotations.length]!;
    const me = currentPlayer(state);

    state = applyMove(state, { type: 'placeTile', player: me, at: option.at, rotation }).state;
    state = applyMove(state, { type: 'takeAction', player: me, action: 'pass' }).state;
  }
  return state;
}

describe('board invariants hold across whole games', () => {
  const seeds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];

  it.each(seeds)('no river ever dead-ends against a plain edge (seed %s)', (seed) => {
    const state = playGame(seed, 40);
    expect(findRiverMismatch(state.board)).toBeNull();
  });

  it('the board stays fully connected to Babel', () => {
    const state = playGame('alpha', 40);
    /* Every tile must be reachable from Babel through orthogonal steps. */
    const seen = new Set<string>();
    const queue = [{ x: 0, y: 0 }];
    while (queue.length) {
      const current = queue.pop()!;
      for (const edge of EDGES) {
        const next = neighbour(current, edge);
        const key = coordKey(next);
        if (seen.has(key) || !state.board[key]) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    expect(seen.size).toBe(Object.keys(state.board).length);
  });

  it('never places a tile on Babel and never double-places a square', () => {
    const state = playGame('beta', 40);
    expect(state.board['0,0']).toBeUndefined();
    /* 40 turns plus GDD §5's fixed start tile. */
    expect(Object.keys(state.board)).toHaveLength(41);
  });

  it('only ever credits resources that a payout event accounts for', () => {
    const state = playGame('gamma', 40);
    const credited = { food: 0, wood: 0, brick: 0, metal: 0 };
    for (const event of state.log) {
      if (event.type === 'resourcesGained') credited[event.resource] += event.amount;
    }
    /* Starting stock per GDD §5 is 2 Wood + 1 Food each. */
    const held = { food: -3, wood: -6, brick: 0, metal: 0 };
    for (const leader of Object.values(state.leaders)) {
      for (const resource of ['food', 'wood', 'brick', 'metal'] as const) {
        held[resource] += leader.resources[resource];
      }
    }
    expect(held).toEqual(credited);
  });
});
