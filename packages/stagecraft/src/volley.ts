import { dieHits, type GameState, type PlayerId, type Coord } from '@babel-game/game-core';

/** One Tower's support die, as GDD §16 resolves it. */
export type TowerShot = {
  readonly owner: PlayerId;
  readonly at: Coord;
  readonly roll: number;
  readonly defence: number;
  readonly hit: boolean;
  readonly targetId: string | null;
};

/** One Army die, measured against the bar it had to clear. */
export type ArmyDie = {
  readonly roll: number;
  readonly hit: boolean;
};

/**
 * Everything an Attack rolled, while it is still waiting to be spent.
 *
 * `pendingAttack` carries the faces and a success count but not which faces
 * succeeded, and the Tower dice that fired first are not in it at all — they
 * are only in the log. This reassembles the whole volley so the screen can
 * show a player why three dice became one hit.
 */
export type Volley = {
  readonly player: PlayerId;
  readonly bonus: number;
  readonly defence: number;
  readonly successes: number;
  readonly army: readonly ArmyDie[];
  readonly towers: readonly TowerShot[];
  readonly paid: { readonly resource: string; readonly amount: number } | null;
};

/** Events the Attack command emits around its own roll, and nothing else. */
const VOLLEY_EVENTS = new Set([
  'towerSupport',
  'hostHit',
  'hostKilled',
  'hostSplit',
  'prestigeGained',
]);

/**
 * The Attack currently awaiting its hit assignment, or null.
 *
 * Read backwards from the end of the log: nothing can happen between the roll
 * and the assignment, so the volley is always the tail. Towers resolve before
 * Army dice, so they sit just behind `attackRolled`.
 */
export function volleyOf(state: GameState): Volley | null {
  const pending = state.pendingAttack;
  if (!pending) return null;

  const log = state.log;
  let index = -1;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i]!.type === 'attackRolled') {
      index = i;
      break;
    }
  }
  if (index === -1) return null;
  const rolled = log[index]!;
  if (rolled.type !== 'attackRolled') return null;

  const towers: TowerShot[] = [];
  for (let i = index - 1; i >= 0 && VOLLEY_EVENTS.has(log[i]!.type); i--) {
    const event = log[i]!;
    if (event.type === 'towerSupport') {
      towers.unshift({
        owner: event.owner,
        at: event.at,
        roll: event.roll,
        defence: event.defence,
        hit: event.hit,
        targetId: event.targetId,
      });
    }
  }

  const bonus = state.rules.combatDieBonus;
  return {
    player: pending.player,
    bonus,
    defence: pending.defence,
    successes: pending.successes,
    /* The same function the rules used to count them, rather than a second
       opinion about which faces were good enough. */
    army: pending.rolls.map((roll) => ({ roll, hit: dieHits(roll, pending.defence, bonus) })),
    towers,
    paid: rolled.paid,
  };
}
