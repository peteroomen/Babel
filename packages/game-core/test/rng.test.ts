import { describe, expect, it } from 'vitest';
import { createRng, nextInt, rollD6, shuffle, weightedPick } from '../src/rng/index.js';

describe('seeded rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng('babel');
    const b = createRng('babel');
    expect(nextInt(a, 100)[0]).toBe(nextInt(b, 100)[0]);
  });

  it('diverges between seeds', () => {
    const draw = (seed: string) => {
      let rng = createRng(seed);
      return Array.from({ length: 10 }, () => {
        const [v, next] = nextInt(rng, 1000);
        rng = next;
        return v;
      });
    };
    expect(draw('one')).not.toEqual(draw('two'));
  });

  it('does not mutate the state it is given', () => {
    const rng = createRng('babel');
    const before = { ...rng };
    nextInt(rng, 6);
    expect(rng).toEqual(before);
  });

  it('survives a JSON round trip mid-sequence', () => {
    let rng = createRng('babel');
    for (let i = 0; i < 5; i++) rng = nextInt(rng, 6)[1];
    const revived = JSON.parse(JSON.stringify(rng));
    expect(nextInt(revived, 1000)[0]).toBe(nextInt(rng, 1000)[0]);
  });

  it('rolls d6 strictly within 1..6', () => {
    let rng = createRng('dice');
    for (let i = 0; i < 500; i++) {
      const [roll, next] = rollD6(rng);
      rng = next;
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
    }
  });

  it('never picks a zero-weight option', () => {
    let rng = createRng('weights');
    for (let i = 0; i < 300; i++) {
      const [pick, next] = weightedPick(rng, { a: 5, b: 0 });
      rng = next;
      expect(pick).toBe('a');
    }
  });

  it('shuffles without mutating or losing items', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const [out] = shuffle(createRng('s'), items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(items);
  });
});
