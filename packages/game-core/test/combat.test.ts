import { describe, expect, it } from 'vitest';
import { HOSTS, type HostKind } from '@babel-game/game-data';
import {
  applyHit,
  applyMove,
  createRng,
  hitsRemaining,
  compareHostIds,
  effectiveHostDefence,
  hostDefence,
  rollAttack,
  setupGame,
  validateAssignments,
  type GameState,
  type Host,
} from '../src/index.js';

const ophanim = (id: string): Host => ({
  id,
  kind: 'ophanim',
  at: { x: 1, y: 0 },
  shieldUp: false,
});
const seraph = (id: string, shieldUp = true): Host => ({
  id,
  kind: 'seraph',
  at: { x: 1, y: 0 },
  shieldUp,
});

/** A Leader ready to act, with Hosts on the board to shoot at. */
function armed(hosts: Host[], army = 3, over: Partial<GameState> = {}): GameState {
  const base = setupGame(['Ada', 'Peter'], 'combat');
  return {
    ...base,
    /* Neutralise Confusion so this suite tests one rule at a time. */
    confusion: { card: null, cancelledBy: null },
    board: { '1,0': { terrain: 'desert', river: 'none', rotation: 0 } },
    hosts,
    turnStep: 'action',
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    drawnTile: null,
    leaders: {
      ...base.leaders,
      p0: {
        ...base.leaders['p0']!,
        army,
        resources: { food: 5, wood: 5, brick: 5, metal: 5 },
      },
    },
    ...over,
  };
}

describe('Host Defence (GDD §4)', () => {
  it('rises with Stage and with player count', () => {
    expect(hostDefence(2, 1)).toBe(4);
    expect(hostDefence(2, 3)).toBe(6);
    expect(hostDefence(3, 1)).toBe(5);
    expect(hostDefence(4, 3)).toBe(7);
  });
});

describe('rolling an Attack (GDD §15)', () => {
  it('rolls one die per Army die', () => {
    const { result } = rollAttack(createRng('a'), 4, 5);
    expect(result.rolls).toHaveLength(4);
    expect(result.rolls.every((r) => r >= 1 && r <= 6)).toBe(true);
  });

  it('counts a success as d6 + 2 meeting the Defence', () => {
    const { result } = rollAttack(createRng('a'), 6, 5);
    /* Every die of 3 or more clears Defence 5. */
    expect(result.successes).toBe(result.rolls.filter((r) => r + 2 >= 5).length);
  });

  it('always leaves a natural 6 hitting, however high the Defence', () => {
    /* A Defence of 9 is out of d6 + 2's reach by arithmetic, and a Host that no
       roll can touch is a bug rather than a hard Host — Stage III plus a kind's
       +2 gets there. A natural 6 is the floor. */
    const { result } = rollAttack(createRng('a'), 60, 99);
    expect(result.successes).toBe(result.rolls.filter((r) => r === 6).length);
    expect(result.successes).toBeGreaterThan(0);
  });

  it('is reproducible from its seed', () => {
    expect(rollAttack(createRng('same'), 5, 5).result).toEqual(
      rollAttack(createRng('same'), 5, 5).result,
    );
  });
});

describe('hits and Shields (GDD §14)', () => {
  it('kills an Ophanim with one hit', () => {
    expect(hitsRemaining(ophanim('h1'))).toBe(1);
    expect(applyHit(ophanim('h1'))).toMatchObject({ killed: true, host: null });
  });

  it('needs two hits for a Seraph, the first breaking its Shield', () => {
    const fresh = seraph('h1');
    expect(hitsRemaining(fresh)).toBe(2);

    const first = applyHit(fresh);
    expect(first).toMatchObject({ killed: false, shieldBroken: true });
    expect(first.host!.shieldUp).toBe(false);

    expect(applyHit(first.host!)).toMatchObject({ killed: true });
  });

  it('leaves a broken Shield broken between turns', () => {
    const broken = seraph('h1', false);
    expect(hitsRemaining(broken)).toBe(1);
    expect(applyHit(broken)).toMatchObject({ killed: true });
  });

  it.each(Object.keys(HOSTS) as HostKind[])('persists damage for %s until its specified hits', (kind) => {
    let host: Host = { id: 'h', kind, at: { x: 1, y: 0 }, shieldUp: HOSTS[kind].shield };
    const total = HOSTS[kind].hits;
    expect(hitsRemaining(host)).toBe(total);
    for (let hit = 1; hit <= total; hit++) {
      const outcome = applyHit(host);
      if (hit === total) {
        expect(outcome.killed).toBe(true);
        expect(outcome.host).toBeNull();
      } else {
        expect(outcome.killed).toBe(false);
        host = outcome.host!;
        expect(hitsRemaining(host)).toBe(total - hit);
      }
    }
  });

  it('orders numeric Host ids naturally', () => {
    expect(['h10', 'h2', 'h1'].sort(compareHostIds)).toEqual(['h1', 'h2', 'h10']);
  });
});

describe('effective Herald Defence', () => {
  it('protects only other Hosts in the same feature', () => {
    const state = armed([
      { id: 'herald', kind: 'herald', at: { x: 1, y: 0 }, shieldUp: false },
      { id: 'mob', kind: 'ophanim', at: { x: 1, y: 0 }, shieldUp: false },
    ]);
    expect(effectiveHostDefence(state, state.hosts[0]!)).toBe(4);
    expect(effectiveHostDefence(state, state.hosts[1]!)).toBe(6);
    expect(validateAssignments(state.hosts, { mob: 1 }, 1, {
      rolls: [3],
      bonus: 2,
      defenceOf: (host) => effectiveHostDefence(state, host),
    })).toMatch(/not enough dice/);
    const pending = {
      ...state,
      pendingAttack: { player: 'p0' as const, rolls: [3], defence: 4, successes: 1 },
    };
    expect(() => applyMove(pending, {
      type: 'assignHits', player: 'p0', assignments: { mob: 1 },
    })).toThrow(/not enough dice/);
  });
});

describe('Fractured Command attack bookkeeping', () => {
  it('records both empty and successful pending resolutions', () => {
    const empty = armed([ophanim('h1')], 1, {
      confusion: { card: 'fractured-command', cancelledBy: null },
      pendingAttack: { player: 'p0', rolls: [3], defence: 4, successes: 1 },
    });
    const afterEmpty = applyMove(empty, {
      type: 'assignHits', player: 'p0', assignments: {},
    }).state;
    expect(afterEmpty.actionsThisRound.attack).toBe('p0');

    const success = armed([ophanim('h1')], 1, {
      confusion: { card: 'fractured-command', cancelledBy: null },
      pendingAttack: { player: 'p0', rolls: [6], defence: 4, successes: 1 },
    });
    const afterSuccess = applyMove(success, {
      type: 'assignHits', player: 'p0', assignments: { h1: 1 },
    }).state;
    expect(afterSuccess.actionsThisRound.attack).toBe('p0');
    expect(() => applyMove({ ...afterSuccess, currentPlayerIndex: 1, turnStep: 'action', hosts: [ophanim('h2')] }, {
      type: 'attack', player: 'p1',
    })).toThrow(/Confusion forbids/);
  });

  it('opens the existing Frenzied Works window after assignment', () => {
    const state = armed([ophanim('h1')], 1, {
      pendingAttack: { player: 'p0', rolls: [3], defence: 4, successes: 1 },
      leaders: {
        ...armed([ophanim('h1')], 1).leaders,
        p0: { ...armed([ophanim('h1')], 1).leaders.p0!, schemeHand: ['frenzied-works'] },
      },
    });
    const after = applyMove(state, { type: 'assignHits', player: 'p0', assignments: {} }).state;
    expect(after.bonusWindow).toBe('p0');
  });
});

describe('assigning successful dice', () => {
  const hosts = [ophanim('h1'), seraph('h2')];

  it('accepts a spread across several Hosts', () => {
    expect(validateAssignments(hosts, { h1: 1, h2: 2 }, 3)).toBeNull();
  });

  it('refuses more hits than dice succeeded', () => {
    expect(validateAssignments(hosts, { h1: 1, h2: 2 }, 2)).toMatch(/more hits assigned/);
  });

  it('refuses to overkill a single Host', () => {
    expect(validateAssignments(hosts, { h1: 2 }, 3)).toMatch(/too many hits/);
  });

  it('refuses an unknown Host', () => {
    expect(validateAssignments(hosts, { ghost: 1 }, 3)).toMatch(/unknown Host/);
  });

  it('does not split a Swarm until its final hit or allow overkill', () => {
    const damaged: Host = {
      id: 'swarm', kind: 'swarm', at: { x: 1, y: 0 }, shieldUp: false, damage: 1,
    };
    expect(hitsRemaining(damaged)).toBe(1);
    expect(validateAssignments([damaged], { swarm: 2 }, 2)).toMatch(/too many hits/);
    const partial = applyHit({
      id: 'fresh', kind: 'swarm', at: { x: 1, y: 0 }, shieldUp: false,
    });
    expect(partial.killed).toBe(false);
    expect(partial.host?.damage).toBe(1);
  });
});

describe('the Attack action end to end', () => {
  it('rolls, then waits for the hits to be assigned', () => {
    const state = armed([ophanim('h1')], 5);
    const { state: rolled, events } = applyMove(state, { type: 'attack', player: 'p0' });

    const roll = events.find((e) => e.type === 'attackRolled');
    expect(roll).toBeDefined();
    if (rolled.pendingAttack) {
      /* The turn has not ended yet; assignment comes first. */
      expect(rolled.turnStep).toBe('action');
      expect(() => applyMove(rolled, { type: 'pass', player: 'p0' })).toThrow(
        /assign your hits/,
      );
    }
  });

  it('kills a Host and awards +1 Prestige per kill', () => {
    const state = armed([ophanim('h1'), ophanim('h2')], 5, { stage: 1 });
    const rolled = applyMove(state, { type: 'attack', player: 'p0' }).state;
    if (!rolled.pendingAttack) return; /* No successes this seed; nothing to assign. */

    const take = Math.min(2, rolled.pendingAttack.successes);
    const assignments: Record<string, number> = {};
    if (take >= 1) assignments['h1'] = 1;
    if (take >= 2) assignments['h2'] = 1;

    const { state: after, events } = applyMove(rolled, {
      type: 'assignHits',
      player: 'p0',
      assignments,
    });

    expect(after.hosts).toHaveLength(2 - take);
    expect(after.leaders['p0']!.prestige).toBe(take);
    expect(events.filter((e) => e.type === 'hostKilled')).toHaveLength(take);
  });

  it('refuses an Attack with no Hosts on the board', () => {
    const state = armed([], 3);
    expect(() => applyMove(state, { type: 'attack', player: 'p0' })).toThrow(/no Hosts/);
  });

  it('refuses someone else assigning your hits', () => {
    const state = armed([ophanim('h1')], 5);
    const rolled = applyMove(state, { type: 'attack', player: 'p0' }).state;
    if (!rolled.pendingAttack) return;
    expect(() =>
      applyMove(rolled, { type: 'assignHits', player: 'p1', assignments: { h1: 1 } }),
    ).toThrow(/not your Attack/);
  });

  it('applies Tower damage before the Army volley and removes a Herald aura', () => {
    let rolled: { state: GameState; events: ReturnType<typeof applyMove>['events'] } | null = null;
    for (let i = 0; i < 100 && !rolled; i++) {
      const candidate = armed([
        { id: 'h1', kind: 'herald', at: { x: 1, y: 0 }, shieldUp: false },
        { id: 'h2', kind: 'colossus', at: { x: 1, y: 0 }, shieldUp: false },
      ], 1, {
        buildings: { '1,0': { type: 'tower', owner: 'p0' } },
        rng: createRng(`tower-herald-${i}`),
      });
      const result = applyMove(candidate, { type: 'attack', player: 'p0' });
      if (result.events.some((event) => event.type === 'towerSupport' && event.hit) && result.state.pendingAttack) {
        rolled = result;
      }
    }
    expect(rolled).not.toBeNull();
    const result = rolled!;
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'towerSupport', targetId: 'h1', hit: true }));
    expect(result.state.hosts.some((host) => host.id === 'h1')).toBe(false);
    expect(result.state.hosts.find((host) => host.id === 'h2')?.damage).toBeUndefined();
    const attack = result.events.find((event) => event.type === 'attackRolled');
    expect(attack?.type === 'attackRolled' && attack.defence).toBe(6);
    if (result.state.pendingAttack && result.state.pendingAttack.successes > 0) {
      const after = applyMove(result.state, {
        type: 'assignHits', player: 'p0', assignments: { h2: 1 },
      }).state;
      expect(after.hosts.find((host) => host.id === 'h2')?.damage).toBe(1);
    }
  });

  it('uses one selected Tower in a merged feature and awards its owner', () => {
    let result: ReturnType<typeof applyMove> | null = null;
    for (let i = 0; i < 100 && !result; i++) {
      const candidate = armed([{ id: 'h1', kind: 'ophanim', at: { x: 2, y: 0 }, shieldUp: false }], 1, {
        board: {
          '1,0': { terrain: 'desert', river: 'none', rotation: 0 },
          '2,0': { terrain: 'desert', river: 'none', rotation: 0 },
        },
        buildings: {
          '1,0': { type: 'tower', owner: 'p0' },
          '2,0': { type: 'tower', owner: 'p1' },
        },
        rng: createRng(`merged-tower-${i}`),
      });
      const attempt = applyMove(candidate, {
        type: 'attack', player: 'p0', towerSupport: ['2,0'],
      });
      if (attempt.events.some((event) => event.type === 'towerSupport' && event.hit)) result = attempt;
    }
    expect(result).not.toBeNull();
    const supports = result!.events.filter((event) => event.type === 'towerSupport');
    expect(supports).toHaveLength(1);
    expect(supports[0]).toMatchObject({ owner: 'p1', targetId: 'h1', hit: true });
    expect(result!.state.leaders.p1!.prestige).toBe(1);
  });
});

describe('Muster (GDD §15)', () => {
  it('spends 1 Food + 1 Metal for one more die', () => {
    const state = armed([], 1);
    const { state: after, events } = applyMove(state, { type: 'muster', player: 'p0' });

    expect(after.leaders['p0']!.army).toBe(2);
    expect(after.leaders['p0']!.resources.food).toBe(4);
    expect(after.leaders['p0']!.resources.metal).toBe(4);
    expect(events).toContainEqual({ type: 'mustered', player: 'p0', army: 2 });
  });

  it('stops at the maximum of 5 dice', () => {
    const state = armed([], 5);
    expect(() => applyMove(state, { type: 'muster', player: 'p0' })).toThrow(/maximum/);
  });

  it('refuses when the Leader cannot pay', () => {
    const base = armed([], 1);
    const broke: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, resources: { food: 0, wood: 5, brick: 5, metal: 0 } },
      },
    };
    expect(() => applyMove(broke, { type: 'muster', player: 'p0' })).toThrow(/cannot afford/);
  });
});
