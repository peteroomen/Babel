import { describe, expect, it } from 'vitest';
import { getConnectedFeature, isFeatureOccupied, type Board } from '../src/index.js';

const plain = (terrain: Board[string]['terrain']) =>
  ({ terrain, river: 'none', rotation: 0 }) as const;

/**
 *   x→   4      5      6      7
 * y=4  forest forest   .    forest
 * y=5    .    forest hills    .
 * y=6  forest   .       .     .
 *
 * The forest at 7,4 and 4,6 are separate features; 4,6 touches nothing.
 */
const BOARD: Board = {
  '4,4': plain('forest'),
  '5,4': plain('forest'),
  '5,5': plain('forest'),
  '6,5': plain('hills'),
  '7,4': plain('forest'),
  '4,6': plain('forest'),
};

describe('connected features', () => {
  it('walks orthogonally connected tiles of the same terrain', () => {
    expect(getConnectedFeature(BOARD, { x: 4, y: 4 })).toEqual(['4,4', '5,4', '5,5']);
  });

  it('does not connect diagonally', () => {
    /* 7,4 is diagonal from 6,5 and two squares from 5,4. */
    expect(getConnectedFeature(BOARD, { x: 7, y: 4 })).toEqual(['7,4']);
  });

  it('does not cross a terrain boundary', () => {
    expect(getConnectedFeature(BOARD, { x: 6, y: 5 })).toEqual(['6,5']);
  });

  it('returns an isolated tile as a feature of one', () => {
    expect(getConnectedFeature(BOARD, { x: 4, y: 6 })).toEqual(['4,6']);
  });

  it('returns nothing for an empty square', () => {
    expect(getConnectedFeature(BOARD, { x: 9, y: 9 })).toEqual([]);
  });

  it('is symmetric from any member of the feature', () => {
    const fromOne = getConnectedFeature(BOARD, { x: 4, y: 4 });
    const fromAnother = getConnectedFeature(BOARD, { x: 5, y: 5 });
    expect(fromOne).toEqual(fromAnother);
  });

  it('GDD §6: river overlays do not split terrain connectivity', () => {
    const withRiver: Board = {
      '0,-1': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '0,-2': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '1,-2': { terrain: 'farmland', river: 'none', rotation: 0 },
    };
    expect(getConnectedFeature(withRiver, { x: 0, y: -1 })).toEqual([
      '0,-1',
      '0,-2',
      '1,-2',
    ]);
  });

  it('merges two features when a tile bridges them', () => {
    const before: Board = { '5,0': plain('forest'), '7,0': plain('forest') };
    expect(getConnectedFeature(before, { x: 5, y: 0 })).toEqual(['5,0']);

    const after: Board = { ...before, '6,0': plain('forest') };
    expect(getConnectedFeature(after, { x: 5, y: 0 })).toEqual(['5,0', '6,0', '7,0']);
  });
});

describe('occupation (GDD §10)', () => {
  it('reports nothing occupied when no Host is on the board', () => {
    expect(isFeatureOccupied(BOARD, [], { x: 4, y: 4 })).toBe(false);
  });

  it('occupies the whole feature from a Host on any one of its tiles', () => {
    const hosts = ['5,5'];
    expect(isFeatureOccupied(BOARD, hosts, { x: 4, y: 4 })).toBe(true);
    expect(isFeatureOccupied(BOARD, hosts, { x: 5, y: 4 })).toBe(true);
    expect(isFeatureOccupied(BOARD, hosts, { x: 5, y: 5 })).toBe(true);
  });

  it('leaves neighbouring features of other terrain alone', () => {
    expect(isFeatureOccupied(BOARD, ['5,5'], { x: 6, y: 5 })).toBe(false);
  });

  it('leaves a disconnected feature of the same terrain alone', () => {
    expect(isFeatureOccupied(BOARD, ['5,5'], { x: 7, y: 4 })).toBe(false);
  });
});
