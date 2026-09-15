import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canBuildHarvester,
  getLegalActions,
  getLegalBuildSites,
  setupGame,
  type Board,
  type GameState,
} from '../src/index.js';

const forest = { terrain: 'forest', river: 'none', rotation: 0 } as const;
const hills = { terrain: 'hills', river: 'none', rotation: 0 } as const;

function ready(names: string[], board: Board = { '4,5': forest, '5,5': forest }): GameState {
  const base = setupGame(names, 'actions');
  return {
    ...base,
    /* Neutralise Confusion so this suite tests one rule at a time. */
    confusion: { card: null, cancelledBy: null },
    board,
    turnStep: 'action',
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    drawnTile: null,
    leaders: Object.fromEntries(
      Object.entries(base.leaders).map(([id, l]) => [
        id,
        { ...l, resources: { food: 5, wood: 5, brick: 5, metal: 5 } },
      ]),
    ),
  };
}

describe('building a harvester (GDD §9)', () => {
  it('charges the cost and awards +1 Prestige', () => {
    const state = ready(['Ada', 'Peter']);
    const { state: after, events } = applyMove(state, {
      type: 'buildHarvester',
      player: 'p0',
      at: { x: 4, y: 5 },
      building: 'sawmill',
    });

    /* Sawmill costs 2 Wood. */
    expect(after.leaders['p0']!.resources.wood).toBe(3);
    expect(after.leaders['p0']!.prestige).toBe(1);
    expect(after.buildings['4,5']).toEqual({ type: 'sawmill', owner: 'p0' });
    expect(events).toContainEqual({
      type: 'prestigeGained',
      player: 'p0',
      amount: 1,
      source: 'building',
    });
  });

  it('refuses a building whose terrain does not match', () => {
    const state = ready(['Ada', 'Peter'], { '4,5': hills });
    expect(
      canBuildHarvester(state.board, {}, state.leaders['p0']!, { x: 4, y: 5 }, 'sawmill'),
    ).toBe('terrainMismatch');
  });

  it('refuses a second building on the same tile', () => {
    const state = ready(['Ada', 'Peter']);
    const buildings = { '4,5': { type: 'farmstead' as const, owner: 'p1' } };
    expect(
      canBuildHarvester(state.board, buildings, state.leaders['p0']!, { x: 4, y: 5 }, 'sawmill'),
    ).toBe('tileOccupiedByBuilding');
  });

  it('allows only one of a type per Leader per connected feature', () => {
    const state = ready(['Ada', 'Peter']);
    const mine = { '4,5': { type: 'sawmill' as const, owner: 'p0' } };
    /* 5,5 is in the same Forest feature as 4,5. */
    expect(
      canBuildHarvester(state.board, mine, state.leaders['p0']!, { x: 5, y: 5 }, 'sawmill'),
    ).toBe('alreadyOwnsInFeature');
  });

  it('lets a different Leader invest in the same feature', () => {
    const state = ready(['Ada', 'Peter']);
    const theirs = { '4,5': { type: 'sawmill' as const, owner: 'p1' } };
    expect(
      canBuildHarvester(state.board, theirs, state.leaders['p0']!, { x: 5, y: 5 }, 'sawmill'),
    ).toBeNull();
  });

  it('refuses when the Leader cannot pay', () => {
    const base = ready(['Ada', 'Peter']);
    const broke = { ...base.leaders['p0']!, resources: { food: 0, wood: 0, brick: 0, metal: 0 } };
    expect(canBuildHarvester(base.board, {}, broke, { x: 4, y: 5 }, 'sawmill')).toBe(
      'cannotAfford',
    );
  });

  it('offers only sites the Leader may actually use', () => {
    const state = ready(['Ada', 'Peter'], { '4,5': forest, '9,9': hills });
    const sites = getLegalBuildSites(state.board, {}, state.leaders['p0']!);
    expect(sites.map((s) => `${s.at.x},${s.at.y}:${s.type}`).sort()).toEqual([
      '4,5:sawmill',
      '9,9:brickworks',
    ]);
  });
});

describe('Barter (GDD §8)', () => {
  it('turns any three resources into one of choice', () => {
    const state = ready(['Ada', 'Peter']);
    const after = applyMove(state, {
      type: 'barter',
      player: 'p0',
      spend: ['wood', 'wood', 'food'],
      gain: 'brick',
    }).state;

    expect(after.leaders['p0']!.resources.wood).toBe(3);
    expect(after.leaders['p0']!.resources.food).toBe(4);
    expect(after.leaders['p0']!.resources.brick).toBe(6);
  });

  it('requires exactly three cards', () => {
    const state = ready(['Ada', 'Peter']);
    expect(() =>
      applyMove(state, { type: 'barter', player: 'p0', spend: ['wood', 'wood'], gain: 'brick' }),
    ).toThrow(/exactly 3/);
  });

  it('refuses to spend resources the Leader does not hold', () => {
    const base = ready(['Ada', 'Peter']);
    const poor: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, resources: { food: 0, wood: 2, brick: 0, metal: 0 } },
      },
    };
    expect(() =>
      applyMove(poor, {
        type: 'barter',
        player: 'p0',
        spend: ['wood', 'wood', 'wood'],
        gain: 'brick',
      }),
    ).toThrow(/not enough/);
  });
});

describe('one action per turn (GDD §11)', () => {
  it('passes the turn on after any action', () => {
    const state = ready(['Ada', 'Peter']);
    const after = applyMove(state, { type: 'pass', player: 'p0' }).state;
    expect(after.currentPlayerIndex).toBe(1);
    expect(after.turnStep).toBe('place');
  });

  it('refuses a second action in the same turn', () => {
    const state = ready(['Ada', 'Peter']);
    const after = applyMove(state, { type: 'pass', player: 'p0' }).state;
    expect(() => applyMove(after, { type: 'pass', player: 'p1' })).toThrow(
      /place your tile first/,
    );
  });
});

describe('legal actions', () => {
  it('always offers Pass on your action step', () => {
    const state = ready(['Ada', 'Peter']);
    expect(getLegalActions(state, 'p0').map((a) => a.type)).toContain('pass');
  });

  it('offers nothing to a Leader who is not active', () => {
    const state = ready(['Ada', 'Peter']);
    expect(getLegalActions(state, 'p1')).toEqual([]);
  });

  it('offers nothing before the tile is placed', () => {
    const state = { ...ready(['Ada', 'Peter']), turnStep: 'place' as const };
    expect(getLegalActions(state, 'p0')).toEqual([]);
  });

  it('offers Babel only when the Leader can pay for a piece', () => {
    const base = ready(['Ada', 'Peter']);
    expect(getLegalActions(base, 'p0').map((a) => a.type)).toContain('buildBabel');

    const broke: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, resources: { food: 0, wood: 0, brick: 0, metal: 0 } },
      },
    };
    expect(getLegalActions(broke, 'p0').map((a) => a.type)).not.toContain('buildBabel');
  });

  it('offers Barter only with three or more cards in hand', () => {
    const base = ready(['Ada', 'Peter']);
    const thin: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, resources: { food: 1, wood: 1, brick: 0, metal: 0 } },
      },
    };
    expect(getLegalActions(thin, 'p0').map((a) => a.type)).not.toContain('barter');
  });

  it('offers nothing once the game is over', () => {
    const state = { ...ready(['Ada', 'Peter']), phase: 'gameOver' as const };
    expect(getLegalActions(state, 'p0')).toEqual([]);
  });
});
