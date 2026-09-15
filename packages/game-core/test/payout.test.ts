import { describe, expect, it } from 'vitest';
import {
  basePayout,
  placementPayout,
  previewPlacement,
  type Board,
  type TileDraw,
} from '../src/index.js';

const plain = (terrain: Board[string]['terrain']) =>
  ({ terrain, river: 'none', rotation: 0 }) as const;

const forest: TileDraw = { terrain: 'forest', river: 'none' };
const hills: TileDraw = { terrain: 'hills', river: 'none' };
const desert: TileDraw = { terrain: 'desert', river: 'none' };

describe('base payout (GDD §6)', () => {
  it('pays 1 for an isolated tile', () => {
    const board: Board = { '5,5': plain('forest') };
    expect(basePayout(board, { x: 5, y: 5 }, forest)).toEqual({
      resource: 'wood',
      amount: 1,
    });
  });

  it('pays 3 for a Forest touching two Forests', () => {
    const board: Board = {
      '5,5': plain('forest'),
      '4,5': plain('forest'),
      '6,5': plain('forest'),
    };
    expect(basePayout(board, { x: 5, y: 5 }, forest)).toEqual({
      resource: 'wood',
      amount: 3,
    });
  });

  it('pays 4 Brick for Hills touching three Hills', () => {
    const board: Board = {
      '5,5': plain('hills'),
      '4,5': plain('hills'),
      '6,5': plain('hills'),
      '5,4': plain('hills'),
    };
    expect(basePayout(board, { x: 5, y: 5 }, hills)).toEqual({
      resource: 'brick',
      amount: 4,
    });
  });

  it('counts adjacent tiles, not the size of the feature', () => {
    /* A line of four Forests; the tile at the end touches only one. */
    const board: Board = {
      '5,5': plain('forest'),
      '6,5': plain('forest'),
      '7,5': plain('forest'),
      '8,5': plain('forest'),
    };
    expect(basePayout(board, { x: 5, y: 5 }, forest)).toEqual({
      resource: 'wood',
      amount: 2,
    });
  });

  it('ignores adjacent tiles of a different terrain', () => {
    const board: Board = {
      '5,5': plain('forest'),
      '4,5': plain('hills'),
      '6,5': plain('mountain'),
    };
    expect(basePayout(board, { x: 5, y: 5 }, forest)).toEqual({
      resource: 'wood',
      amount: 1,
    });
  });

  it('does not count diagonals', () => {
    const board: Board = { '5,5': plain('forest'), '6,6': plain('forest') };
    expect(basePayout(board, { x: 5, y: 5 }, forest)).toEqual({
      resource: 'wood',
      amount: 1,
    });
  });

  it('pays nothing for Desert', () => {
    const board: Board = { '5,5': plain('desert'), '4,5': plain('desert') };
    expect(basePayout(board, { x: 5, y: 5 }, desert)).toBeNull();
  });

  it('caps at 5 when surrounded on all four sides', () => {
    const board: Board = {
      '5,5': plain('forest'),
      '4,5': plain('forest'),
      '6,5': plain('forest'),
      '5,4': plain('forest'),
      '5,6': plain('forest'),
    };
    expect(basePayout(board, { x: 5, y: 5 }, forest)).toEqual({
      resource: 'wood',
      amount: 5,
    });
  });
});

describe('occupation suppresses payout (GDD §10)', () => {
  const board: Board = {
    '5,5': plain('forest'),
    '4,5': plain('forest'),
    '6,5': plain('forest'),
  };

  it('pays normally when the feature is clear', () => {
    expect(placementPayout(board, [], { x: 5, y: 5 }, forest)).toEqual({
      resource: 'wood',
      amount: 3,
    });
  });

  it('pays nothing when a Host stands anywhere in the feature', () => {
    expect(placementPayout(board, ['4,5'], { x: 5, y: 5 }, forest)).toBeNull();
  });

  it('judges occupation after the tile lands, so a merge into an occupied feature is suppressed', () => {
    /* Two Forest features; the right-hand one is occupied. The new tile at 6,5
       bridges them, which makes the merged feature occupied. */
    const merged: Board = {
      '5,5': plain('forest'),
      '6,5': plain('forest'),
      '7,5': plain('forest'),
    };
    expect(placementPayout(merged, ['7,5'], { x: 6, y: 5 }, forest)).toBeNull();
  });

  it('is unaffected by a Host in a different feature', () => {
    expect(placementPayout(board, ['9,9'], { x: 5, y: 5 }, forest)).toEqual({
      resource: 'wood',
      amount: 3,
    });
  });
});

describe('river tiles are ordinary resource terrain (GDD §6, §3)', () => {
  const plainFarm = { terrain: 'farmland', river: 'none', rotation: 0 } as const;
  const riverFarm = { terrain: 'farmland', river: 'straight', rotation: 0 } as const;
  const farmDraw: TileDraw = { terrain: 'farmland', river: 'straight' };

  it('pays for a river tile just like a plain one', () => {
    const board: Board = { '5,5': riverFarm };
    expect(basePayout(board, { x: 5, y: 5 }, farmDraw)).toEqual({
      resource: 'food',
      amount: 1,
    });
  });

  it('counts adjacent river tiles towards the payout', () => {
    /* A river is an overlay on terrain, not a terrain of its own, so a
       Farmland carrying a river is still Farmland for adjacency. */
    const board: Board = { '4,5': riverFarm, '5,5': plainFarm, '6,5': riverFarm };
    expect(basePayout(board, { x: 5, y: 5 }, { terrain: 'farmland', river: 'none' })).toEqual({
      resource: 'food',
      amount: 3,
    });
  });

  it('keeps the projected payout identical to what is actually paid', () => {
    const board: Board = { '4,5': riverFarm, '6,5': plainFarm };
    const projected = previewPlacement({ board, hosts: [] }, { x: 5, y: 5 }, farmDraw, 0);
    const after: Board = { ...board, '5,5': riverFarm };
    expect(projected).toEqual(placementPayout(after, [], { x: 5, y: 5 }, farmDraw));
    expect(projected).toEqual({ resource: 'food', amount: 3 });
  });
});
