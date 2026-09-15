import { COMBAT_DIE_BONUS, HOSTS } from '@babel-game/game-data';
import { rollD6, type RngState } from '../rng/index.js';
import type { Host } from '../state/types.js';

export type AttackRoll = {
  readonly rolls: number[];
  readonly successes: number;
};

/**
 * Roll an Army. GDD §15: each die is resolved independently as d6 + 2 against
 * the Host Defence, and each success deals exactly one hit.
 */
export function rollAttack(
  rng: RngState,
  dice: number,
  defence: number,
): { result: AttackRoll; rng: RngState } {
  const rolls: number[] = [];
  let state = rng;
  for (let i = 0; i < dice; i++) {
    const [roll, next] = rollD6(state);
    state = next;
    rolls.push(roll);
  }
  const successes = rolls.filter((roll) => roll + COMBAT_DIE_BONUS >= defence).length;
  return { result: { rolls, successes }, rng: state };
}

/** How many more hits this Host can take before it dies. */
export const hitsRemaining = (host: Host): number =>
  HOSTS[host.kind].hits - (HOSTS[host.kind].shield && !host.shieldUp ? 1 : 0);

export type HitOutcome = {
  readonly host: Host | null;
  readonly shieldBroken: boolean;
  readonly killed: boolean;
};

/**
 * Apply one hit. GDD §14: a Seraph's first successful hit removes its Shield
 * and the second kills it; a removed Shield stays removed between turns.
 */
export function applyHit(host: Host): HitOutcome {
  if (HOSTS[host.kind].shield && host.shieldUp) {
    return { host: { ...host, shieldUp: false }, shieldBroken: true, killed: false };
  }
  return { host: null, shieldBroken: false, killed: true };
}

/** Whether an assignment of successful dice is spendable as described. */
export function validateAssignments(
  hosts: readonly Host[],
  assignments: Readonly<Record<string, number>>,
  successes: number,
): string | null {
  let total = 0;
  for (const [id, count] of Object.entries(assignments)) {
    if (count < 0 || !Number.isInteger(count)) return 'hit counts must be whole numbers';
    const host = hosts.find((h) => h.id === id);
    if (!host) return `unknown Host ${id}`;
    /* A die can hit only one Host, and overkill is wasted rather than illegal. */
    if (count > hitsRemaining(host)) return `too many hits assigned to ${id}`;
    total += count;
  }
  if (total > successes) return 'more hits assigned than dice succeeded';
  return null;
}
