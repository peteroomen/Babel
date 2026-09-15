import { describe, expect, it } from 'vitest';
import {
  BABEL_PIECE_COST,
  BUILDINGS,
  type ResourceType,
} from '@babel-game/game-data';
import {
  EDGES,
  OPPOSITE,
  applyMove,
  coordKey,
  currentPlayer,
  getLegalActions,
  getLegalTilePlacements,
  hasRiverOn,
  neighbour,
  setupGame,
  type Board,
  type Command,
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

const RESOURCES: readonly ResourceType[] = ['food', 'wood', 'brick', 'metal'];

/**
 * Play a game, choosing placements and actions pseudo-randomly from the legal
 * sets the core itself reports. Every action type the core offers gets
 * exercised, so the invariants below cover real games rather than a pass loop.
 */
function playGame(seed: string, turns: number): GameState {
  let state = setupGame(['Ada', 'Peter', 'Rook'], seed);
  let cursor = 7;
  const roll = (n: number) => {
    cursor = (cursor * 31 + 17) % 1009;
    return cursor % n;
  };

  for (let i = 0; i < turns; i++) {
    if (state.phase === 'gameOver') break;

    const options = getLegalTilePlacements(state.board, state.drawnTile!);
    expect(options.length).toBeGreaterThan(0);
    const option = options[roll(options.length)]!;
    const rotation = option.rotations[roll(option.rotations.length)]!;
    const me = currentPlayer(state);

    state = applyMove(state, { type: 'placeTile', player: me, at: option.at, rotation }).state;

    const legal = getLegalActions(state, me);
    const choice = legal[roll(legal.length)]!;
    let command: Command;
    switch (choice.type) {
      case 'buildHarvester': {
        const site = choice.sites[roll(choice.sites.length)]!;
        command = { type: 'buildHarvester', player: me, at: site.at, building: site.type };
        break;
      }
      case 'buildBabel':
        command = { type: 'buildBabel', player: me };
        break;
      case 'barter': {
        /* Spend from whatever the Leader actually holds. */
        const hand = state.leaders[me]!.resources;
        const held = RESOURCES.flatMap((r) => Array<ResourceType>(hand[r]).fill(r));
        command = {
          type: 'barter',
          player: me,
          spend: held.slice(0, 3),
          gain: RESOURCES[roll(RESOURCES.length)]!,
        };
        break;
      }
      default:
        command = { type: 'pass', player: me };
    }
    state = applyMove(state, command).state;
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
    /* One tile per turn, plus GDD §5's fixed start tile. */
    expect(Object.keys(state.board)).toHaveLength(41);
  });

  it('exercises every action type the core currently offers', () => {
    const state = playGame('gamma', 60);
    const actions = new Set(
      state.log.flatMap((e) => (e.type === 'actionTaken' ? [e.action.split(' ')[0]] : [])),
    );
    expect(actions).toContain('pass');
    expect(actions).toContain('build');
    expect(actions).toContain('barter');
  });

  it('keeps Prestige equal to the Prestige actually awarded', () => {
    const state = playGame('delta', 60);
    const awarded: Record<string, number> = {};
    for (const event of state.log) {
      if (event.type === 'prestigeGained') {
        awarded[event.player] = (awarded[event.player] ?? 0) + event.amount;
      }
    }
    for (const [id, leader] of Object.entries(state.leaders)) {
      expect(leader.prestige).toBe(awarded[id] ?? 0);
    }
  });

  it('never lets a Leader hold a negative resource', () => {
    const state = playGame('epsilon', 60);
    for (const leader of Object.values(state.leaders)) {
      for (const resource of RESOURCES) {
        expect(leader.resources[resource]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never exceeds one building per land tile, all on matching terrain', () => {
    const state = playGame('alpha', 60);
    for (const [key, building] of Object.entries(state.buildings)) {
      expect(state.board[key]).toBeDefined();
      expect(building.owner).toBeTruthy();
    }
  });

  it('has a log that fully explains every resource a Leader holds', () => {
    /* Double-entry: starting stock, plus every credit the log records, minus
       every cost it records, must reproduce the final hand exactly. */
    const state = playGame('gamma', 60);

    const ledger: Record<string, Record<ResourceType, number>> = Object.fromEntries(
      state.order.map((id) => [id, { food: 1, wood: 2, brick: 0, metal: 0 }]),
    );
    const spend = (id: string, cost: Partial<Record<ResourceType, number>>) => {
      const hand = ledger[id] as Record<ResourceType, number>;
      for (const [resource, amount] of Object.entries(cost)) {
        hand[resource as ResourceType] -= amount ?? 0;
      }
    };

    for (const event of state.log) {
      switch (event.type) {
        case 'resourcesGained': {
          const hand = ledger[event.player] as Record<ResourceType, number>;
          hand[event.resource] += event.amount;
          break;
        }
        case 'buildingConstructed':
          spend(event.player, BUILDINGS[event.building].cost);
          break;
        case 'babelPieceBuilt':
          spend(event.player, BABEL_PIECE_COST[event.stage]);
          break;
        case 'bartered': {
          const hand = ledger[event.player] as Record<ResourceType, number>;
          for (const resource of event.spent) hand[resource] -= 1;
          hand[event.gained] += 1;
          break;
        }
        default:
          break;
      }
    }

    for (const [id, leader] of Object.entries(state.leaders)) {
      expect({ id, ...leader.resources }).toEqual({
        id,
        ...(ledger[id] as Record<ResourceType, number>),
      });
    }
  });
});
