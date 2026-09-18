import { describe, expect, it } from 'vitest';
import { V02_RULES } from '@babel-game/game-data';
import {
  applyMove,
  coordKey,
  distancesToBabel,
  getLegalBeaconSites,
  hasRouteToBabel,
  isFrontierTile,
  isPassableAt,
  requiredBeacons,
  resolveHeavenPhase,
  setupGame,
  stepOptions,
  type Board,
  type GameState,
  type Host,
} from '../src/index.js';

const land = (terrain: Board[string]['terrain'] = 'desert') =>
  ({ terrain, river: 'none', rotation: 0 }) as const;
const river = { terrain: 'farmland', river: 'straight', rotation: 0 } as const;

const ophanim = (id: string, x: number, y: number): Host => ({
  id,
  kind: 'ophanim',
  at: { x, y },
  shieldUp: false,
});

function game(board: Board, over: Partial<GameState> = {}): GameState {
  return {
    ...setupGame(['Ada', 'Peter'], 'heaven'),
    /* Neutralise Confusion so this suite tests one rule at a time. */
    confusion: { card: null, cancelledBy: null },
    board,
    ...over,
  };
}

describe('passability (GDD §7)', () => {
  it('blocks river tiles and Lakes, allows plain land including Desert', () => {
    const board: Board = {
      '1,0': land('desert'),
      '2,0': river,
      '3,0': land('forest'),
      '4,0': { terrain: 'lake', river: 'none', rotation: 0 },
    };
    expect(isPassableAt(board, { x: 1, y: 0 })).toBe(true);
    expect(isPassableAt(board, { x: 2, y: 0 })).toBe(false);
    expect(isPassableAt(board, { x: 3, y: 0 })).toBe(true);
    expect(isPassableAt(board, { x: 4, y: 0 })).toBe(false);
  });

  it('treats a Mountain river source as impassable too', () => {
    const board: Board = { '1,0': { terrain: 'mountain', river: 'source', rotation: 0 } };
    expect(isPassableAt(board, { x: 1, y: 0 })).toBe(false);
  });
});

describe('distance to Babel', () => {
  const corridor: Board = { '1,0': land(), '2,0': land(), '3,0': land() };

  it('counts tiles outward from Babel', () => {
    const distance = distancesToBabel(corridor);
    expect(distance['0,0']).toBe(0);
    expect(distance['1,0']).toBe(1);
    expect(distance['3,0']).toBe(3);
  });

  it('omits squares with no legal land route', () => {
    /* A river at 2,0 severs the corridor beyond it. */
    const severed: Board = { '1,0': land(), '2,0': river, '3,0': land() };
    const distance = distancesToBabel(severed);
    expect(distance['1,0']).toBe(1);
    expect(distance['3,0']).toBeUndefined();
    expect(hasRouteToBabel(severed, { x: 3, y: 0 })).toBe(false);
  });

  it('routes around a river rather than through it', () => {
    /* Direct route east is blocked, so the way in is the long way round. */
    const board: Board = {
      '1,0': river,
      '1,-1': land(),
      '0,-1': land(),
      '2,0': land(),
      '2,-1': land(),
    };
    const distance = distancesToBabel(board);
    expect(distance['1,0']).toBeUndefined();
    expect(distance['0,-1']).toBe(1);
    /* The only way in is 0,-1 -> 1,-1 -> 2,-1 -> 2,0. */
    expect(distance['2,0']).toBe(4);
  });
});

describe('Host routing (GDD §14)', () => {
  it('only ever steps closer to Babel', () => {
    const corridor: Board = { '1,0': land(), '2,0': land(), '3,0': land() };
    expect(stepOptions(corridor, { x: 3, y: 0 })).toEqual([{ x: 2, y: 0 }]);
    expect(stepOptions(corridor, { x: 1, y: 0 })).toEqual([{ x: 0, y: 0 }]);
  });

  it('offers every equally short route so the players can choose', () => {
    /* From 1,1 both 1,0 and 0,1 are one step from Babel. */
    const board: Board = { '1,1': land(), '1,0': land(), '0,1': land() };
    expect(stepOptions(board, { x: 1, y: 1 })).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ]);
  });

  it('offers nothing to a stranded Host', () => {
    const marooned: Board = { '1,0': river, '2,0': land() };
    expect(stepOptions(marooned, { x: 2, y: 0 })).toEqual([]);
  });

  it('moves an Ophanim one tile and a Seraph two', () => {
    const corridor: Board = { '1,0': land(), '2,0': land(), '3,0': land() };
    const state = game(corridor, {
      hosts: [
        ophanim('h1', 3, 0),
        { id: 'h2', kind: 'seraph', at: { x: 3, y: 0 }, shieldUp: true },
      ],
    });
    const { state: after } = resolveHeavenPhase(state);
    expect(after.hosts.find((h) => h.id === 'h1')!.at).toEqual({ x: 2, y: 0 });
    expect(after.hosts.find((h) => h.id === 'h2')!.at).toEqual({ x: 1, y: 0 });
  });

  it('honours a legal route override and ignores an illegal one', () => {
    const board: Board = { '1,1': land(), '1,0': land(), '0,1': land() };
    const state = game(board, { hosts: [ophanim('h1', 1, 1)] });

    const chosen = resolveHeavenPhase(state, { h1: [{ x: 1, y: 0 }] });
    expect(chosen.state.hosts[0]!.at).toEqual({ x: 1, y: 0 });

    /* Stepping sideways is not a shortest route, so the default stands. */
    const bogus = resolveHeavenPhase(state, { h1: [{ x: 9, y: 9 }] });
    expect(['0,1', '1,0']).toContain(coordKey(bogus.state.hosts[0]!.at));
  });
});

describe('Beacons (GDD §13)', () => {
  it('requires a frontier land tile with a route to Babel', () => {
    /* 1,0 is hemmed in by 2,0; only 2,0 still touches open space. */
    const board: Board = { '1,0': land(), '2,0': land() };
    expect(isFrontierTile(board, { x: 2, y: 0 })).toBe(true);
    expect(getLegalBeaconSites(board, []).map(coordKey)).toEqual(['1,0', '2,0']);
  });

  it('refuses river and Lake tiles', () => {
    const board: Board = { '1,0': river, '2,0': land() };
    /* 2,0 has no land route because 1,0 is water. */
    expect(getLegalBeaconSites(board, [])).toEqual([]);
  });

  it('refuses a square that already holds a Beacon', () => {
    const board: Board = { '1,0': land(), '2,0': land() };
    expect(getLegalBeaconSites(board, [{ x: 2, y: 0 }]).map(coordKey)).toEqual(['1,0']);
  });

  it('scales the count by player count, Stage and round (GDD §4)', () => {
    /* 2 Leaders: first Beacon at the end of Round 3, then 1 / 1 / 2. */
    expect(requiredBeacons(2, 1, 2)).toBe(0);
    expect(requiredBeacons(2, 1, 3)).toBe(1);
    expect(requiredBeacons(2, 3, 5)).toBe(2);
    /* 4 Leaders start earlier and face more. */
    expect(requiredBeacons(4, 1, 2)).toBe(1);
    expect(requiredBeacons(4, 2, 5)).toBe(3);
  });

  it('spawns one Host per Beacon each phase', () => {
    const board: Board = { '1,0': land(), '2,0': land() };
    const state = game(board, { beacons: [{ x: 2, y: 0 }], rules: V02_RULES });

    const first = resolveHeavenPhase(state);
    expect(first.state.hosts).toHaveLength(1);
    expect(first.state.hosts[0]!.at).toEqual({ x: 2, y: 0 });

    const second = resolveHeavenPhase(first.state);
    expect(second.state.hosts).toHaveLength(2);
  });

  it('spawns only Ophanim before Stage III', () => {
    const board: Board = { '1,0': land(), '2,0': land() };
    let state = game(board, { beacons: [{ x: 2, y: 0 }], stage: 2, rules: V02_RULES });
    for (let i = 0; i < 20; i++) state = resolveHeavenPhase(state).state;
    expect(state.hosts.length).toBeGreaterThan(0);
    expect(state.hosts.every((h) => h.kind === 'ophanim')).toBe(true);
  });

  it('mixes Seraphs in at Stage III, under the one-per-Beacon spawn', () => {
    const board: Board = { '1,0': land(), '2,0': land() };
    /* GDD §14's Seraph roll belongs to the one-per-Beacon spawn, which v0.3
       replaced with a rolled table. V02_RULES is where this rule still lives. */
    let state = game(board, { beacons: [{ x: 2, y: 0 }], stage: 3, rules: V02_RULES });
    const kinds: string[] = [];
    for (let i = 0; i < 60; i++) {
      const result = resolveHeavenPhase(state);
      state = result.state;
      for (const event of result.events) {
        if (event.type === 'hostSpawned') kinds.push(event.kind);
      }
    }
    /* GDD §14 puts this at roughly 25%; assert the mix exists, not its rate. */
    expect(kinds).toContain('seraph');
    expect(kinds).toContain('ophanim');
  });
});

describe('striking Babel (GDD §2)', () => {
  const approach: Board = { '1,0': land() };

  it('removes the newest piece and the Host that struck it', () => {
    const state = game(approach, {
      hosts: [ophanim('h1', 1, 0)],
      babel: { stack: ['p0', 'p1'] },
    });
    const { state: after, events } = resolveHeavenPhase(state);

    expect(after.babel.stack).toEqual(['p0']);
    expect(after.hosts).toHaveLength(0);
    expect(events).toContainEqual({ type: 'babelPieceLost', builtBy: 'p1', remaining: 1 });
  });

  it('occupies the Foundation when Babel has no pieces', () => {
    const state = game(approach, { hosts: [ophanim('h1', 1, 0)], babel: { stack: [] } });
    const { state: after, events } = resolveHeavenPhase(state);

    expect(after.hosts[0]!.at).toEqual({ x: 0, y: 0 });
    expect(after.phase).not.toBe('gameOver');
    expect(events.some((e) => e.type === 'foundationOccupied')).toBe(true);
  });

  it('loses the game when a second Host reaches an occupied Foundation', () => {
    const state = game(approach, {
      hosts: [ophanim('h1', 0, 0), ophanim('h2', 1, 0)],
      babel: { stack: [] },
    });
    const { state: after, events } = resolveHeavenPhase(state);

    expect(after.phase).toBe('gameOver');
    expect(after.lossReason).toBe('foundationBreached');
    expect(events).toContainEqual({ type: 'humanityLoses', reason: 'foundationBreached' });
  });

  it('clears Foundation occupation when False Prophet redirects its occupier', () => {
    const state = game(approach, {
      hosts: [ophanim('h1', 0, 0), ophanim('h2', 1, 0)],
      babel: { stack: [] },
      falseProphet: { hostId: 'h1', to: { x: 1, y: 0 } },
    });
    const { state: after } = resolveHeavenPhase(state);
    expect(after.phase).not.toBe('gameOver');
    expect(after.hosts.find((host) => host.id === 'h2')?.at).toEqual({ x: 0, y: 0 });
    expect(after.hosts.find((host) => host.id === 'h1')?.at).toEqual({ x: 1, y: 0 });
  });

  it('keeps Colossus building removals when the phase ends in loss', () => {
    const state = game({ '1,0': land(), '2,0': land() }, {
      hosts: [
        { id: 'h1', kind: 'colossus', at: { x: 2, y: 0 }, shieldUp: false },
        ophanim('h2', 0, 0),
        ophanim('h3', 1, 0),
      ],
      babel: { stack: [] },
      buildings: { '1,0': { type: 'tower', owner: 'p0' } },
    });
    const { state: after } = resolveHeavenPhase(state);
    expect(after.phase).toBe('gameOver');
    expect(after.buildings['1,0']).toBeUndefined();
  });

  it('lets the occupying Host sit on the Foundation without re-triggering', () => {
    const state = game(approach, { hosts: [ophanim('h1', 0, 0)], babel: { stack: [] } });
    const { state: after } = resolveHeavenPhase(state);
    expect(after.phase).not.toBe('gameOver');
    expect(after.hosts).toHaveLength(1);
  });

  it('blocks the Babel action while the Foundation is occupied', () => {
    const state = game(approach, {
      hosts: [ophanim('h1', 0, 0)],
      babel: { stack: [] },
      turnStep: 'action',
      currentPlayerIndex: 0,
      firstPlayerIndex: 0,
      leaders: {
        p0: { ...setupGame(['Ada', 'Peter'], 'x').leaders['p0']!, resources: { food: 9, wood: 9, brick: 9, metal: 9 } },
        p1: setupGame(['Ada', 'Peter'], 'x').leaders['p1']!,
      },
    });
    expect(() => applyMove(state, { type: 'buildBabel', player: 'p0' })).toThrow(
      /Foundation is occupied/,
    );
  });
});

describe('occupation shuts a feature down (GDD §10)', () => {
  it('suppresses payouts once a Host stands in the feature', () => {
    const board: Board = { '1,0': land('forest'), '2,0': land('forest') };
    const state = game(board, { hosts: [ophanim('h1', 2, 0)] });
    /* The Host is in the Forest feature, so the whole feature is shut down. */
    expect(state.hosts).toHaveLength(1);
    expect(coordKey(state.hosts[0]!.at)).toBe('2,0');
  });
});
