import { describe, expect, it } from 'vitest';
import {
  getLegalTilePlacements,
  hasAnyLegalPlacement,
  isLegalPlacement,
  legalRotations,
  riverEdgesOf,
  rotateEdge,
  type Board,
  type TileDraw,
} from '../src/index.js';

const NONE: TileDraw = { terrain: 'forest', river: 'none' };
const STRAIGHT: TileDraw = { terrain: 'farmland', river: 'straight' };
const BEND: TileDraw = { terrain: 'farmland', river: 'bend' };
const TEE: TileDraw = { terrain: 'farmland', river: 'tee' };

/** One Farmland tile far from Babel, river running north-south. */
const RIVER_BOARD: Board = {
  '5,5': { terrain: 'farmland', river: 'straight', rotation: 0 },
};

/** GDD §5's opening board: the river Farmland immediately north of Babel. */
const START_BOARD: Board = {
  '0,-1': { terrain: 'farmland', river: 'straight', rotation: 0 },
};

describe('edge rotation', () => {
  it('rotates edges clockwise', () => {
    expect(rotateEdge('n', 1)).toBe('e');
    expect(rotateEdge('e', 1)).toBe('s');
    expect(rotateEdge('w', 1)).toBe('n');
    expect(rotateEdge('n', 0)).toBe('n');
  });

  it('derives river edges from shape and rotation', () => {
    expect(riverEdgesOf('straight', 0).sort()).toEqual(['n', 's']);
    expect(riverEdgesOf('straight', 1).sort()).toEqual(['e', 'w']);
    expect(riverEdgesOf('bend', 0).sort()).toEqual(['e', 'n']);
    expect(riverEdgesOf('bend', 2).sort()).toEqual(['s', 'w']);
    expect(riverEdgesOf('tee', 0).sort()).toEqual(['e', 'n', 'w']);
    expect(riverEdgesOf('source', 0)).toEqual(['n']);
    expect(riverEdgesOf('none', 3)).toEqual([]);
  });

  it('returns to the start after four quarter turns', () => {
    expect(riverEdgesOf('bend', 0).sort()).toEqual(
      riverEdgesOf('bend', ((0 + 4) % 4) as 0).sort(),
    );
  });
});

describe('adjacency', () => {
  it('allows a tile orthogonally adjacent to Babel', () => {
    expect(isLegalPlacement(START_BOARD, { x: 1, y: 0 }, NONE, 0)).toBe(true);
  });

  it('allows a tile orthogonally adjacent to an existing tile', () => {
    expect(isLegalPlacement(RIVER_BOARD, { x: 6, y: 5 }, NONE, 0)).toBe(true);
  });

  it('rejects a floating tile', () => {
    expect(isLegalPlacement(START_BOARD, { x: 9, y: 9 }, NONE, 0)).toBe(false);
  });

  it('rejects a diagonal-only placement', () => {
    expect(isLegalPlacement(RIVER_BOARD, { x: 6, y: 6 }, NONE, 0)).toBe(false);
  });

  it('rejects an occupied square and the Babel square itself', () => {
    expect(isLegalPlacement(RIVER_BOARD, { x: 5, y: 5 }, NONE, 0)).toBe(false);
    expect(isLegalPlacement(START_BOARD, { x: 0, y: 0 }, NONE, 0)).toBe(false);
  });
});

describe('river edge legality (RD-001)', () => {
  /* The existing tile at 5,5 carries river on its north and south edges. */

  it('lets a river meet a river', () => {
    /* North of it: the new tile needs river on its south edge. */
    expect(isLegalPlacement(RIVER_BOARD, { x: 5, y: 4 }, STRAIGHT, 0)).toBe(true);
    expect(isLegalPlacement(RIVER_BOARD, { x: 5, y: 4 }, BEND, 2)).toBe(true);
  });

  it('forbids a plain edge dead-ending an existing river', () => {
    expect(isLegalPlacement(RIVER_BOARD, { x: 5, y: 4 }, NONE, 0)).toBe(false);
  });

  it('forbids a river running into a plain edge', () => {
    /* East of it: the existing east edge is plain, so a river there is illegal. */
    expect(isLegalPlacement(RIVER_BOARD, { x: 6, y: 5 }, STRAIGHT, 1)).toBe(false);
    expect(isLegalPlacement(RIVER_BOARD, { x: 6, y: 5 }, STRAIGHT, 0)).toBe(true);
  });

  it('leaves edges facing empty space unconstrained', () => {
    /* A source pointing north into nothing is fine placed east of the river. */
    expect(isLegalPlacement(RIVER_BOARD, { x: 6, y: 5 }, { ...STRAIGHT, river: 'source' }, 0)).toBe(
      true,
    );
  });

  it('leaves edges facing Babel unconstrained', () => {
    /* GDD §5 already runs the start tile's river straight into Babel. */
    for (const rotation of [0, 1, 2, 3] as const) {
      expect(isLegalPlacement(START_BOARD, { x: 0, y: 1 }, STRAIGHT, rotation)).toBe(true);
    }
  });

  it('checks every shared edge, not just one', () => {
    const board: Board = {
      /* River running east-west, so its east edge carries river. */
      '5,0': { terrain: 'farmland', river: 'straight', rotation: 1 },
      /* Plain tile above the target square. */
      '6,-1': { terrain: 'farmland', river: 'none', rotation: 0 },
    };
    /* At 6,0 the west edge must carry river and the north edge must not. */
    expect(isLegalPlacement(board, { x: 6, y: 0 }, STRAIGHT, 1)).toBe(true);
    /* A T-junction rivers its north edge, which the plain neighbour refuses. */
    expect(isLegalPlacement(board, { x: 6, y: 0 }, TEE, 0)).toBe(false);
  });
});

describe('rotation choices', () => {
  it('offers a riverless tile exactly one rotation', () => {
    expect(legalRotations(RIVER_BOARD, { x: 6, y: 5 }, NONE)).toEqual([0]);
  });

  it('offers only the rotations that actually fit', () => {
    const rotations = legalRotations(RIVER_BOARD, { x: 5, y: 4 }, STRAIGHT);
    expect(rotations).toEqual([0, 2]);
  });

  it('offers nothing where the tile cannot fit at all', () => {
    expect(legalRotations(RIVER_BOARD, { x: 5, y: 4 }, NONE)).toEqual([]);
  });
});

describe('legal placement enumeration', () => {
  it('covers the frontier including squares touching Babel', () => {
    const options = getLegalTilePlacements(START_BOARD, NONE);
    const keys = options.map((o) => `${o.at.x},${o.at.y}`).sort();
    /* Around Babel and around the start tile, minus the two occupied squares. */
    expect(keys).toEqual(['-1,-1', '-1,0', '0,1', '1,-1', '1,0']);
  });

  it('excludes squares where no rotation fits', () => {
    const options = getLegalTilePlacements(START_BOARD, NONE);
    /* 0,-2 faces the start tile's northward river, so a plain tile cannot go there. */
    expect(options.map((o) => `${o.at.x},${o.at.y}`)).not.toContain('0,-2');
  });

  it('agrees with hasAnyLegalPlacement', () => {
    expect(hasAnyLegalPlacement(START_BOARD, NONE)).toBe(true);
    expect(getLegalTilePlacements(START_BOARD, NONE).length).toBeGreaterThan(0);
  });

  it('finds no rotation for a tile pinched between two plain edges', () => {
    /* A T-junction rivers three of its four edges, so it has exactly one plain
       edge. A gap demanding two plain edges can never take one. */
    const pinched: Board = {
      '5,4': { terrain: 'farmland', river: 'none', rotation: 0 },
      '5,6': { terrain: 'farmland', river: 'none', rotation: 0 },
    };
    expect(legalRotations(pinched, { x: 5, y: 5 }, TEE)).toEqual([]);
    /* A straight river turned sideways keeps both of those edges plain. */
    expect(legalRotations(pinched, { x: 5, y: 5 }, STRAIGHT)).toEqual([1, 3]);
    /* And a plain tile is always welcome. */
    expect(legalRotations(pinched, { x: 5, y: 5 }, NONE)).toEqual([0]);
  });
});
