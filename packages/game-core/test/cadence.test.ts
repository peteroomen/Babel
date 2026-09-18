import { describe, expect, it } from 'vitest';
import {
  CANON_HEAVEN_CADENCE,
  CANON_RULES,
  V04_ROLLED_HEAVEN,
} from '@babel-game/game-data';
import { heavenArrivalsForRound, resolveHeavenPhase, setupGame } from '../src/index.js';

const cadence = {
  ...V04_ROLLED_HEAVEN!,
  cadenceByStage: [[1, 0, 2], [2, 1], [0, 3, 1]] as const,
};

describe('rolled-Heaven cadence', () => {
  it('uses the adopted count-specific cycles for the default rules', () => {
    expect(CANON_RULES.heavenSpawn?.cadenceByLeaderCount).toEqual(CANON_HEAVEN_CADENCE);

    /* All counts begin at one, but the first Beacon round is absolute. */
    const rounds = (count: number, stage: 1 | 2 | 3, from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) =>
        heavenArrivalsForRound(CANON_RULES.heavenSpawn, count, stage, from + i, 1),
      );
    expect(rounds(2, 1, 3, 5)).toEqual([1, 1, 1]);
    expect(rounds(2, 2, 3, 10)).toEqual([0, 1, 1, 1, 0, 1, 1, 1]);
    expect(rounds(2, 3, 3, 10)).toEqual([0, 1, 1, 1, 0, 1, 1, 1]);
    expect(rounds(3, 2, 2, 5)).toEqual([1, 2, 1, 2]);
    expect(rounds(3, 3, 2, 5)).toEqual([1, 2, 1, 2]);
    expect(rounds(4, 2, 2, 5)).toEqual([2, 2, 2, 2]);
    expect(rounds(4, 3, 2, 5)).toEqual([2, 2, 2, 2]);
  });

  it('gives explicit experiment cadence precedence over the canonical table', () => {
    const override = {
      ...CANON_RULES.heavenSpawn!,
      cadenceByStage: [[9], [8], [7]] as const,
    };
    expect(heavenArrivalsForRound(override, 2, 2, 3, 1)).toBe(8);
    expect(heavenArrivalsForRound(override, 4, 3, 2, 1)).toBe(7);
  });

  it('keeps frozen v0.4 arrivals as the legacy fallback', () => {
    expect(V04_ROLLED_HEAVEN?.cadenceByLeaderCount).toBeUndefined();
    expect(heavenArrivalsForRound(V04_ROLLED_HEAVEN, 2, 2, 1, 1)).toBe(2);
    expect(heavenArrivalsForRound(V04_ROLLED_HEAVEN, 4, 3, 99, 1)).toBe(2);
  });

  it('runs exact cycles from the scheduled first Beacon round', () => {
    expect(heavenArrivalsForRound(cadence, 2, 1, 2, 1)).toBe(0);
    expect(heavenArrivalsForRound(cadence, 2, 1, 3, 1)).toBe(1);
    expect(heavenArrivalsForRound(cadence, 2, 1, 4, 1)).toBe(0);
    expect(heavenArrivalsForRound(cadence, 2, 1, 5, 1)).toBe(2);
    expect(heavenArrivalsForRound(cadence, 2, 1, 8, 1)).toBe(2);
    /* Stage changes keep the absolute round offset; they do not restart a
       stage-local grace period. */
    expect(heavenArrivalsForRound(cadence, 2, 2, 3, 1)).toBe(2);
    expect(heavenArrivalsForRound(cadence, 2, 2, 4, 1)).toBe(1);
  });

  it('returns zero for zero rounds or no Beacons, and preserves legacy fallback', () => {
    expect(heavenArrivalsForRound(cadence, 3, 1, 0, 1)).toBe(0);
    expect(heavenArrivalsForRound(cadence, 3, 1, 2, 0)).toBe(0);
    expect(heavenArrivalsForRound(V04_ROLLED_HEAVEN, 2, 1, 0, 1)).toBe(1);
    expect(heavenArrivalsForRound(CANON_RULES.heavenSpawn, 2, 1, 3, 0)).toBe(0);
  });

  it('does not spawn without Beacons and is deterministic', () => {
    const base = setupGame(['Ada', 'Peter'], 'cadence');
    const state = { ...base, round: 3, rules: { ...base.rules, heavenSpawn: cadence }, beacons: [] };
    const first = resolveHeavenPhase(state);
    const second = resolveHeavenPhase(state);
    expect(first.state.hosts).toHaveLength(0);
    expect(first.state).toEqual(second.state);

    const withBeacon = {
      ...state,
      board: { ...state.board, '1,0': { terrain: 'desert' as const, river: 'none' as const, rotation: 0 as const } },
      beacons: [{ x: 1, y: 0 }],
      rng: { ...state.rng },
    };
    const spawnedA = resolveHeavenPhase(withBeacon);
    const spawnedB = resolveHeavenPhase(withBeacon);
    expect(spawnedA.events.filter((event) => event.type === 'hostSpawned')).toHaveLength(1);
    expect(spawnedA.state).toEqual(spawnedB.state);
  });
});
