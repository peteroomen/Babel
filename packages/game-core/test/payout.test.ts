import { describe, expect, it } from 'vitest';
import { basePayout, placementPayout, type Board, type TileDraw } from '../src/index.js';

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
