import { describe, expect, it } from 'vitest';
import { createRng, drawTile, type TileDraw } from '../src/index.js';

/** Draw a large sample so the observed mix can be compared with GDD §22. */
function sample(n: number, seed = 'bag'): TileDraw[] {
  let rng = createRng(seed);
  return Array.from({ length: n }, () => {
    const [draw, next] = drawTile(rng);
    rng = next;
    return draw;
  });
}

const SIZE = 40000;
const draws = sample(SIZE);
const pct = (predicate: (t: TileDraw) => boolean) =>
  (draws.filter(predicate).length / SIZE) * 100;

/**
 * These are sampling assertions, so they need a tolerance wider than the noise
 * floor rather than `toBeCloseTo`, whose ±0.5 is tighter than the standard
 * error and fails on a correct bag. At n = 40000 the standard error on a ~24%
 * share is about 0.21pp, so ±1.0pp is roughly 4.5 sigma. River frequency is
 * measured within a terrain subsample of ~9600, where the standard error is
 * about 0.43pp, so that one gets ±1.5pp.
 */
function expectShare(actual: number, expected: number, tolerance: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('tile bag matches GDD §22', () => {
  it.each([
    ['farmland', 24],
    ['forest', 24],
    ['hills', 22],
    ['mountain', 16],
    ['desert', 14],
  ])('draws %s at about %i%%', (terrain, expected) => {
    expectShare(pct((t) => t.terrain === terrain), expected, 1.0);
  });

  it('never draws a Lake while it sits at weight 0 (RD-004)', () => {
    expect(draws.some((t) => t.terrain === 'lake')).toBe(false);
  });

  it('gives about 23% of Farmland and Forest river geometry', () => {
    for (const terrain of ['farmland', 'forest'] as const) {
      const ofTerrain = draws.filter((t) => t.terrain === terrain);
      const withRiver = ofTerrain.filter((t) => t.river !== 'none').length;
      expectShare((withRiver / ofTerrain.length) * 100, 23, 1.5);
    }
  });

  it('makes about 10% of Mountains river sources', () => {
    const mountains = draws.filter((t) => t.terrain === 'mountain');
    const sources = mountains.filter((t) => t.river === 'source').length;
    expectShare((sources / mountains.length) * 100, 10, 1.5);
  });

  it('keeps rivers off Hills and Desert', () => {
    expect(
      draws.some((t) => (t.terrain === 'hills' || t.terrain === 'desert') && t.river !== 'none'),
    ).toBe(false);
  });

  it('only ever sources on Mountains', () => {
    expect(draws.some((t) => t.river === 'source' && t.terrain !== 'mountain')).toBe(false);
  });

  it('is reproducible from its seed', () => {
    expect(sample(50, 'x')).toEqual(sample(50, 'x'));
    expect(sample(50, 'x')).not.toEqual(sample(50, 'y'));
  });
});
