import { describe, expect, it } from 'vitest';
import { CANON_RULES, ROLLED_HEAVEN } from '@babel-game/game-data';
import { heavenArrivalsForRound, resolveHeavenPhase, setupGame } from '../src/index.js';

const cadence = {
  ...ROLLED_HEAVEN!,
  cadenceByStage: [[1, 0, 2], [2, 1], [0, 3, 1]] as const,
};

describe('experimental rolled-Heaven cadence', () => {
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
    expect(heavenArrivalsForRound(ROLLED_HEAVEN, 2, 1, 0, 1)).toBe(1);
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
