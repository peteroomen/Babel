import { describe, expect, it } from 'vitest';
import {
  applyHit,
  applyMove,
  createRng,
  hitsRemaining,
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

  it('cannot succeed against a Defence beyond d6 + 2', () => {
    const { result } = rollAttack(createRng('a'), 20, 9);
    expect(result.successes).toBe(0);
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
