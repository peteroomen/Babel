import { describe, expect, it } from 'vitest';
import { bankAnchor } from './Board';

const tile = (river: 'straight' | 'bend' | 'tee' | 'source', rotation: 0 | 1 | 2 | 3) => ({
  terrain: 'farmland' as const,
  river,
  rotation,
});

describe('bank board anchors', () => {
  it('separates both banks on every rotated river shape', () => {
    for (const river of ['straight', 'bend', 'tee'] as const) {
      for (const rotation of [0, 1, 2, 3] as const) {
        const first = bankAnchor(tile(river, rotation), 0);
        const second = bankAnchor(tile(river, rotation), 1);
        const separation = Math.hypot(first.x - second.x, first.y - second.y);
        expect(first).not.toEqual(second);
        /* Beacon target circles use an 11.5px radius, so the two bank targets
           must remain visibly and touch-wise separate on a phone viewport. */
        expect(separation).toBeGreaterThan(23);
      }
    }
  });

  it('keeps a one-bank source centered instead of placing its marker in the river', () => {
    expect(bankAnchor(tile('source', 0), 0)).toEqual({ x: 32, y: 32 });
  });
});
