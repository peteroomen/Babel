import { describe, expect, it } from 'vitest';
import { setupGame, type GameEvent, type GameState } from '@babel-game/game-core';
import { volleyOf } from '../src/index.js';

/** A game sitting on an Attack that has rolled and not yet been spent. */
function waiting(log: readonly GameEvent[], rolls: readonly number[], successes: number): GameState {
  const base = setupGame(['Ada', 'Peter'], 'volley');
  return {
    ...base,
    pendingAttack: { player: base.order[0]!, rolls, defence: 4, successes },
    log: [...base.log, ...log],
  };
}

const rolled = (rolls: readonly number[], successes: number): GameEvent => ({
  type: 'attackRolled',
  player: 'p0',
  rolls,
  defence: 4,
  successes,
  paid: null,
});

const tower = (roll: number, hit: boolean): GameEvent => ({
  type: 'towerSupport',
  owner: 'p1',
  at: { x: 1, y: 1 },
  roll,
  defence: 4,
  hit,
  targetId: 'h1',
});

describe('the volley', () => {
  it('says which faces beat the bar, not just how many', () => {
    /* d6 + 2 against Defence 4: a 1 falls short, a 2 is exactly enough. */
    const volley = volleyOf(waiting([rolled([1, 2, 5], 2)], [1, 2, 5], 2))!;

    expect(volley.army).toEqual([
      { roll: 1, hit: false },
      { roll: 2, hit: true },
      { roll: 5, hit: true },
    ]);
    expect(volley.successes).toBe(2);
  });

  it('picks up the Tower dice that fired before the Army', () => {
    const volley = volleyOf(
      waiting([tower(6, true), tower(1, false), rolled([3], 1)], [3], 1),
    )!;

    expect(volley.towers.map((shot) => [shot.roll, shot.hit])).toEqual([
      [6, true],
      [1, false],
    ]);
    expect(volley.towers[0]!.targetId).toBe('h1');
  });

  it('does not reach back into a previous Attack', () => {
    const volley = volleyOf(
      waiting(
        [
          tower(6, true),
          rolled([6], 1),
          { type: 'actionTaken', player: 'p0', action: 'attack' },
          { type: 'turnEnded', player: 'p0' },
          rolled([3], 1),
        ],
        [3],
        1,
      ),
    )!;

    expect(volley.towers).toEqual([]);
    expect(volley.army).toEqual([{ roll: 3, hit: true }]);
  });

  it('is nothing at all when no Attack is waiting', () => {
    expect(volleyOf(setupGame(['Ada', 'Peter'], 'volley'))).toBeNull();
  });
});
