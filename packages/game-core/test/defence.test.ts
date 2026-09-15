import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canBuildTower,
  canonicalWall,
  getLegalWallEdges,
  getLegalTowerSites,
  hasWallBetween,
  resolveHeavenPhase,
  setupGame,
  wallEdgeKey,
  type Board,
  type GameState,
  type Host,
} from '../src/index.js';

const land = (terrain: Board[string]['terrain'] = 'desert') =>
  ({ terrain, river: 'none', rotation: 0 }) as const;

/** A straight corridor of Desert from 3,0 down to Babel. */
const CORRIDOR: Board = { '1,0': land(), '2,0': land(), '3,0': land() };

const ophanim = (id: string, x: number, y: number): Host => ({
  id,
  kind: 'ophanim',
  at: { x, y },
  shieldUp: false,
});
const seraph = (id: string, x: number, y: number): Host => ({
  id,
  kind: 'seraph',
  at: { x, y },
  shieldUp: true,
});

function game(board: Board, over: Partial<GameState> = {}): GameState {
  const base = setupGame(['Ada', 'Peter'], 'defence');
  return {
    ...base,
    board,
    turnStep: 'action',
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    drawnTile: null,
    leaders: Object.fromEntries(
      Object.entries(base.leaders).map(([id, l]) => [
        id,
        { ...l, resources: { food: 9, wood: 9, brick: 9, metal: 9 }, army: 2 },
      ]),
    ),
    ...over,
  };
}

describe('Wall placement (GDD §17)', () => {
  it('offers only edges between two placed land tiles', () => {
    const edges = getLegalWallEdges(CORRIDOR, []).map(wallEdgeKey);
    expect(edges).toEqual(['1,0|2,0', '2,0|3,0']);
  });

  it('excludes an edge that already holds a Wall', () => {
    const existing = [canonicalWall({ x: 1, y: 0 }, { x: 2, y: 0 })];
    expect(getLegalWallEdges(CORRIDOR, existing).map(wallEdgeKey)).toEqual(['2,0|3,0']);
  });

  it('identifies an edge the same way from either side', () => {
    expect(wallEdgeKey(canonicalWall({ x: 2, y: 0 }, { x: 1, y: 0 }))).toBe(
      wallEdgeKey(canonicalWall({ x: 1, y: 0 }, { x: 2, y: 0 })),
    );
  });

  it('spends 1 Wood for two segments and pays +1 Prestige', () => {
    const state = game(CORRIDOR);
    const edges = getLegalWallEdges(CORRIDOR, []);
    const { state: after, events } = applyMove(state, {
      type: 'buildWalls',
      player: 'p0',
      edges,
    });

    expect(after.walls).toHaveLength(2);
    expect(after.leaders['p0']!.resources.wood).toBe(8);
    expect(after.leaders['p0']!.prestige).toBe(1);
    expect(events).toContainEqual({
      type: 'prestigeGained',
      player: 'p0',
      amount: 1,
      source: 'walls',
    });
  });

  it('refuses an edge that is not between two land tiles', () => {
    const state = game(CORRIDOR);
    expect(() =>
      applyMove(state, {
        type: 'buildWalls',
        player: 'p0',
        edges: [canonicalWall({ x: 9, y: 9 }, { x: 9, y: 8 })],
      }),
    ).toThrow(/illegal Wall edge/);
  });

  it('refuses the same edge twice in one action', () => {
    const state = game(CORRIDOR);
    const edge = canonicalWall({ x: 1, y: 0 }, { x: 2, y: 0 });
    expect(() =>
      applyMove(state, { type: 'buildWalls', player: 'p0', edges: [edge, edge] }),
    ).toThrow(/duplicate Wall edge/);
  });
});

describe('Hosts crossing Walls (GDD §17)', () => {
  it('costs a Movement-1 Host its whole phase, and destroys the Wall', () => {
    const wall = canonicalWall({ x: 2, y: 0 }, { x: 1, y: 0 });
    const state = game(CORRIDOR, { hosts: [ophanim('h1', 2, 0)], walls: [wall] });

    const { state: after, events } = resolveHeavenPhase(state);

    /* The Host has not moved... */
    expect(after.hosts[0]!.at).toEqual({ x: 2, y: 0 });
    /* ...and the Wall is gone, so next phase it walks through. */
    expect(after.walls).toHaveLength(0);
    expect(events.some((e) => e.type === 'wallBroken')).toBe(true);
    expect(events.some((e) => e.type === 'hostMoved')).toBe(false);
  });

  it('lets a Movement-2 Seraph break the Wall and cross with its second point', () => {
    const wall = canonicalWall({ x: 2, y: 0 }, { x: 1, y: 0 });
    const state = game(CORRIDOR, { hosts: [seraph('s1', 2, 0)], walls: [wall] });

    const { state: after, events } = resolveHeavenPhase(state);

    expect(after.hosts[0]!.at).toEqual({ x: 1, y: 0 });
    expect(after.walls).toHaveLength(0);
    expect(events.some((e) => e.type === 'wallBroken')).toBe(true);
    expect(events.some((e) => e.type === 'hostMoved')).toBe(true);
  });

  it('is temporary: the Wall does not come back', () => {
    const wall = canonicalWall({ x: 2, y: 0 }, { x: 1, y: 0 });
    let state = game(CORRIDOR, { hosts: [ophanim('h1', 2, 0)], walls: [wall] });

    state = resolveHeavenPhase(state).state;
    expect(hasWallBetween(state.walls, { x: 2, y: 0 }, { x: 1, y: 0 })).toBe(false);

    /* Second phase: nothing stands in the way, so the Host advances. */
    state = resolveHeavenPhase(state).state;
    expect(state.hosts[0]!.at).toEqual({ x: 1, y: 0 });
  });

  it('leaves Walls elsewhere on the board alone', () => {
    const blocking = canonicalWall({ x: 2, y: 0 }, { x: 1, y: 0 });
    const elsewhere = canonicalWall({ x: 3, y: 0 }, { x: 2, y: 0 });
    const state = game(CORRIDOR, {
      hosts: [ophanim('h1', 2, 0)],
      walls: [blocking, elsewhere],
    });

    const after = resolveHeavenPhase(state).state;
    expect(after.walls.map(wallEdgeKey)).toEqual(['2,0|3,0']);
  });
});

describe('Towers (GDD §16)', () => {
  const forest: Board = { '1,0': land('forest'), '2,0': land('forest') };

  it('allows at most one Tower per connected feature', () => {
    const state = game(forest);
    expect(canBuildTower(forest, {}, state.leaders['p0']!, { x: 1, y: 0 })).toBeNull();

    const defended = { '1,0': { type: 'tower' as const, owner: 'p1' } };
    /* 2,0 is in the same Forest feature as the existing Tower. */
    expect(
      canBuildTower(forest, defended, state.leaders['p0']!, { x: 2, y: 0 }),
    ).toBe('featureAlreadyDefended');
  });

  it('may be raised on any land tile, whatever the terrain', () => {
    const state = game(CORRIDOR);
    const sites = getLegalTowerSites(CORRIDOR, {}, state.leaders['p0']!);
    expect(sites).toHaveLength(3);
  });

  it('costs 2 Wood + 1 Metal and pays +1 Prestige', () => {
    const state = game(forest);
    const { state: after, events } = applyMove(state, {
      type: 'buildTower',
      player: 'p0',
      at: { x: 1, y: 0 },
    });

    expect(after.buildings['1,0']).toEqual({ type: 'tower', owner: 'p0' });
    expect(after.leaders['p0']!.resources.wood).toBe(7);
    expect(after.leaders['p0']!.resources.metal).toBe(8);
    expect(after.leaders['p0']!.prestige).toBe(1);
    expect(events).toContainEqual({
      type: 'prestigeGained',
      player: 'p0',
      amount: 1,
      source: 'tower',
    });
  });

  it('never triggers a harvest payout', () => {
    /* A Tower is not a harvesting building, so expanding its feature pays
       nobody but the placer. GDD §16. */
    const state = game(forest, {
      buildings: { '1,0': { type: 'tower', owner: 'p1' } },
      turnStep: 'place',
      drawnTile: { terrain: 'forest', river: 'none' },
    });
    const before = state.leaders['p1']!.resources.wood;
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: 'p0',
      at: { x: 3, y: 0 },
      rotation: 0,
    });

    expect(after.leaders['p1']!.resources.wood).toBe(before);
    expect(events.some((e) => e.type === 'harvestTriggered')).toBe(false);
  });
});

describe('Tower support dice (GDD §16)', () => {
  const forest: Board = { '1,0': land('forest'), '2,0': land('forest') };
  const tower = { '1,0': { type: 'tower' as const, owner: 'p1' } };

  /** Find a seed whose Tower die hits, so the reward path is testable. */
  function attackWithTower(hosts: Host[]): {
    state: GameState;
    events: ReturnType<typeof applyMove>['events'];
  } {
    for (let i = 0; i < 60; i++) {
      const base = game(forest, { buildings: tower, hosts });
      const state: GameState = { ...base, rng: { seed: `t${i}`, s: i * 7919 + 13 } };
      const result = applyMove(state, { type: 'attack', player: 'p0' });
      const support = result.events.find((e) => e.type === 'towerSupport');
      if (support && support.type === 'towerSupport' && support.hit) return result;
    }
    throw new Error('no seed produced a Tower hit');
  }

  it('contributes a die only when the Tower’s feature is occupied', () => {
    /* The Host is outside the Forest, so the Tower has nothing to shoot at. */
    const away = game({ ...forest, '3,0': land('desert') }, {
      buildings: tower,
      hosts: [ophanim('h1', 3, 0)],
    });
    const quiet = applyMove(away, { type: 'attack', player: 'p0' });
    expect(quiet.events.some((e) => e.type === 'towerSupport')).toBe(false);

    /* Move the Host into the Forest and the Tower speaks up. */
    const inside = game(forest, { buildings: tower, hosts: [ophanim('h1', 2, 0)] });
    const loud = applyMove(inside, { type: 'attack', player: 'p0' });
    expect(loud.events.some((e) => e.type === 'towerSupport')).toBe(true);
  });

  it('resolves before the Army dice', () => {
    const state = game(forest, { buildings: tower, hosts: [ophanim('h1', 2, 0)] });
    const { events } = applyMove(state, { type: 'attack', player: 'p0' });
    const support = events.findIndex((e) => e.type === 'towerSupport');
    const army = events.findIndex((e) => e.type === 'attackRolled');
    expect(support).toBeGreaterThanOrEqual(0);
    expect(support).toBeLessThan(army);
  });

  it('pays the Tower’s owner for a successful hit, not the attacker', () => {
    const { events } = attackWithTower([ophanim('h1', 2, 0), ophanim('h2', 2, 0)]);
    /* p1 owns the Tower; p0 is attacking. */
    expect(events).toContainEqual({
      type: 'prestigeGained',
      player: 'p1',
      amount: 1,
      source: 'tower',
    });
  });

  it('also pays the attacker the normal kill Prestige when the die kills', () => {
    const { state, events } = attackWithTower([ophanim('h1', 2, 0), ophanim('h2', 2, 0)]);
    const killed = events.filter((e) => e.type === 'hostKilled');
    expect(killed.length).toBeGreaterThan(0);
    expect(state.leaders['p0']!.prestige).toBeGreaterThan(0);
  });

  it('can break a Seraph’s Shield rather than killing it', () => {
    const { state, events } = attackWithTower([seraph('s1', 2, 0)]);
    const broke = events.some((e) => e.type === 'hostHit' && e.shieldBroken);
    const killed = events.some((e) => e.type === 'hostKilled');
    expect(broke || killed).toBe(true);
    if (broke) expect(state.hosts.find((h) => h.id === 's1')!.shieldUp).toBe(false);
  });

  it('is communal: any Leader’s Attack benefits from it', () => {
    const state = game(forest, {
      buildings: tower,
      hosts: [ophanim('h1', 2, 0)],
      currentPlayerIndex: 1,
      firstPlayerIndex: 1,
    });
    /* p1 owns the Tower, but p0 could use it just as well; here p1 attacks. */
    const { events } = applyMove(state, { type: 'attack', player: 'p1' });
    expect(events.some((e) => e.type === 'towerSupport')).toBe(true);
  });
});
