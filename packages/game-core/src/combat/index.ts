import { COMBAT_DIE_BONUS, HOSTS } from '@babel-game/game-data';
import { rollD6, type RngState } from '../rng/index.js';
import { getConnectedFeature } from '../features/index.js';
import { coordKey } from '../map/edges.js';
import { hostDefence } from '../heaven/beacons.js';
import type { GameState, Host } from '../state/types.js';

export type AttackRoll = {
  readonly rolls: number[];
  readonly successes: number;
};

/**
 * Roll an Army. GDD §15: each die is resolved independently as d6 + 2 against
 * the Host Defence, and each success deals exactly one hit.
 */
/**
 * Whether one die beats a Defence.
 *
 * A natural 6 always hits. Without that rule a Defence of 9 — Stage III's 7
 * plus a kind's +2 — is unreachable by d6+2 at all, and a Host that cannot be
 * killed by any roll is not a hard Host, it is a bug. The sweep found exactly
 * that: Colossus and Warded were unkillable at Stage III and the win rate went
 * to zero. It is also the convention a person at a table would assume.
 */
export const dieHits = (roll: number, defence: number, bonus: number): boolean =>
  roll === 6 || roll + bonus >= defence;

export function rollAttack(
  rng: RngState,
  dice: number,
  defence: number,
  bonus: number = COMBAT_DIE_BONUS,
): { result: AttackRoll; rng: RngState } {
  const rolls: number[] = [];
  let state = rng;
  for (let i = 0; i < dice; i++) {
    const [roll, next] = rollD6(state);
    state = next;
    rolls.push(roll);
  }
  const successes = rolls.filter((roll) => dieHits(roll, defence, bonus)).length;
  return { result: { rolls, successes }, rng: state };
}

/** How many more hits this Host can take before it dies. */
export const hitsRemaining = (host: Host): number =>
  Math.max(
    0,
    HOSTS[host.kind].hits -
      (typeof host.damage === 'number'
        ? host.damage
        : HOSTS[host.kind].shield && !host.shieldUp
          ? 1
          : 0),
  );

/**
 * Effective Defence for a Host, including additive Herald auras from other
 * Hosts in the same connected feature. This is the sole aura calculation used
 * by combat, AI and the UI.
 */
export function effectiveHostDefence(state: GameState, host: Host): number {
  const feature = new Set(getConnectedFeature(state.board, host.at));
  const aura = state.hosts
    .filter((other) => other.id !== host.id && HOSTS[other.kind].aura > 0)
    .filter((other) => feature.has(coordKey(other.at)))
    .reduce((sum, other) => sum + HOSTS[other.kind].aura, 0);
  return hostDefence(state.order.length, state.stage, state.rules, host.kind) + aura;
}

/** Numeric ordering keeps h2 ahead of h10 while retaining a stable fallback. */
export function compareHostIds(a: string, b: string): number {
  const am = /^h(\d+)$/.exec(a);
  const bm = /^h(\d+)$/.exec(b);
  if (am && bm) return Number(am[1]) - Number(bm[1]);
  return a.localeCompare(b);
}

export type TowerSupportGroup = {
  readonly feature: string;
  readonly towers: readonly string[];
};

/** Occupied features where at least one non-Warded Host can receive support. */
export function getTowerSupportGroups(state: GameState): TowerSupportGroup[] {
  const groups = new Map<string, string[]>();
  for (const [key, building] of Object.entries(state.buildings)) {
    if (building.type !== 'tower') continue;
    const [x, y] = key.split(',').map(Number) as [number, number];
    const members = getConnectedFeature(state.board, { x, y });
    const eligible = state.hosts.some(
      (host) => members.includes(coordKey(host.at)) && !HOSTS[host.kind].wardedFromTowers,
    );
    if (!eligible) continue;
    const feature = [...members].sort().join('|');
    groups.set(feature, [...(groups.get(feature) ?? []), key]);
  }
  return [...groups.entries()].map(([feature, towers]) => ({ feature, towers }));
}

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
  const spec = HOSTS[host.kind];
  const damage =
    typeof host.damage === 'number'
      ? host.damage
      : spec.shield && !host.shieldUp
        ? 1
        : 0;
  const shieldBroken = spec.shield && host.shieldUp;
  if (damage + 1 >= spec.hits) {
    return { host: null, shieldBroken: false, killed: true };
  }
  return {
    host: { ...host, damage: damage + 1, shieldUp: shieldBroken ? false : host.shieldUp },
    shieldBroken,
    killed: false,
  };
}

/**
 * How many of these rolls beat a given Defence.
 *
 * Once Host kinds have their own Defence, "successes" is no longer a single
 * number: a roll that kills an Ophanim may bounce off a Zealot.
 */
export const rollsBeating = (
  rolls: readonly number[],
  defence: number,
  bonus: number,
): number => rolls.filter((roll) => dieHits(roll, defence, bonus)).length;

/**
 * Whether an assignment of dice to Hosts is spendable as described.
 *
 * With one Defence for everything this was a sum. With per-kind Defence it is a
 * matching problem: a die that only just beat the easiest target cannot be
 * spent on the hardest. Sorting the targets hardest-first and checking each
 * running total against the dice good enough to reach that far is Hall's
 * condition, and it is exact — every die good enough for a hard target is also
 * good enough for an easy one, so the thresholds nest.
 */
export function validateAssignments(
  hosts: readonly Host[],
  assignments: Readonly<Record<string, number>>,
  successes: number,
  /* Omitted under a single Defence, where the sum is all that matters. */
  scored?: {
    readonly rolls: readonly number[];
    readonly bonus: number;
    readonly defenceOf: (host: Host) => number;
  },
): string | null {
  let total = 0;
  const assigned: { host: Host; count: number }[] = [];
  for (const [id, count] of Object.entries(assignments)) {
    if (count < 0 || !Number.isInteger(count)) return 'hit counts must be whole numbers';
    const host = hosts.find((h) => h.id === id);
    if (!host) return `unknown Host ${id}`;
    /* A die can hit only one Host, and overkill is wasted rather than illegal. */
    if (count > hitsRemaining(host)) return `too many hits assigned to ${id}`;
    total += count;
    assigned.push({ host, count });
  }
  if (total > successes) return 'more hits assigned than dice succeeded';

  if (scored) {
    const byHardest = [...assigned].sort(
      (a, b) => scored.defenceOf(b.host) - scored.defenceOf(a.host),
    );
    let needed = 0;
    for (const { host, count } of byHardest) {
      needed += count;
      const good = rollsBeating(scored.rolls, scored.defenceOf(host), scored.bonus);
      if (needed > good) {
        return `not enough dice beat Defence ${scored.defenceOf(host)} to hit ${host.id}`;
      }
    }
  }
  return null;
}
