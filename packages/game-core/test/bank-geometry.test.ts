import { describe, expect, it } from 'vitest';
import { RIVER_SHAPES, type RiverShape } from '@babel-game/game-data';
import {
  EDGES,
  OPPOSITE,
  ROTATIONS,
  coordKey,
  neighbour,
  riverEdgesOf,
  rotateEdge,
  type Edge,
  type Rotation,
} from '../src/map/edges.js';
import type { Board } from '../src/map/placement.js';
import type { PlacedTile } from '../src/state/types.js';
import {
  bankDistancesToBabel,
  bankStepOptions,
  dryRegionCount,
  dryRegions,
  edgeRegions,
  regionKey,
  regionTransitions,
  tileRegionCount,
} from '../src/heaven/banks.js';

type BankPair = readonly [number, number];

/**
 * The independent oracle for the dry corners of each shape.  Region 0 is the
 * inside of a bend, west of an unrotated north/south straight, and the
 * north-east corner of an unrotated tee.  These labels describe the physical
 * corners; they are deliberately not read from BASE in banks.ts.
 */
const EXPECTED_EDGES: Record<RiverShape, Record<Edge, BankPair>> = {
  none: { n: [0, 0], e: [0, 0], s: [0, 0], w: [0, 0] },
  source: { n: [0, 0], e: [0, 0], s: [0, 0], w: [0, 0] },
  straight: { n: [0, 1], e: [1, 1], s: [1, 0], w: [0, 0] },
  bend: { n: [1, 0], e: [0, 1], s: [1, 1], w: [1, 1] },
  tee: { n: [2, 0], e: [0, 1], s: [1, 1], w: [1, 2] },
};

const EXPECTED_COUNTS: Record<RiverShape, number> = {
  none: 1,
  source: 1,
  straight: 2,
  bend: 2,
  tee: 3,
};

const expectedEdgeRegions = (shape: RiverShape, rotation: Rotation, edge: Edge): BankPair =>
  EXPECTED_EDGES[shape][EDGES[(EDGES.indexOf(edge) - rotation + 4) % 4] as Edge];

const tile = (
  river: RiverShape,
  rotation: Rotation,
  terrain: PlacedTile['terrain'] = 'farmland',
): PlacedTile => ({ terrain, river, rotation });

const nodeAt = (x: number, y: number, region: number) => ({ x, y, region });

const targetRegions = (
  shape: RiverShape,
  rotation: Rotation,
  edge: Edge,
  otherShape: RiverShape,
  otherRotation: Rotation,
  region: number,
): number[] => {
  const here = expectedEdgeRegions(shape, rotation, edge);
  const there = expectedEdgeRegions(otherShape, otherRotation, OPPOSITE[edge]);
  return here
    .flatMap((bank, side) => (bank === region ? [there[1 - side]!] : []))
    .filter((candidate, index, all) => all.indexOf(candidate) === index)
    .sort((a, b) => a - b);
};

const transitionsTo = (board: Board, from: { x: number; y: number; region: number }, at: { x: number; y: number }) =>
  regionTransitions(board, from)
    .filter((next) => coordKey(next) === coordKey(at))
    .map((next) => next.region ?? 0)
    .sort((a, b) => a - b);

describe('bank geometry', () => {
  it('keeps straight banks on their physical side in every rotation', () => {
    for (const rotation of ROTATIONS) {
      const at = { x: 10, y: 10 };
      const edge = rotateEdge('n', rotation);
      const other = neighbour(at, edge);
      const board: Board = {
        [coordKey(at)]: tile('straight', rotation),
        [coordKey(other)]: tile('straight', rotation),
      };

      for (const region of [0, 1]) {
        const label = `straight rotation ${rotation}, bank ${region}, ${edge} neighbour`;
        expect(transitionsTo(board, { ...at, region }, other), label).toEqual([region]);
        expect(
          transitionsTo(board, { ...other, region }, at),
          `${label}, reverse route`,
        ).toEqual([region]);
      }
    }
  });

  it('assigns bend inner and outer corners correctly for every rotation', () => {
    for (const rotation of ROTATIONS) {
      for (const edge of EDGES) {
        expect(
          edgeRegions('bend', rotation, edge),
          `bend rotation ${rotation}, edge ${edge}`,
        ).toEqual(expectedEdgeRegions('bend', rotation, edge));
      }
    }
  });

  it('exposes three dry regions around a tee in every rotation', () => {
    for (const rotation of ROTATIONS) {
      expect(dryRegionCount('tee'), `tee rotation ${rotation}`).toBe(3);
      for (const edge of EDGES) {
        expect(
          edgeRegions('tee', rotation, edge),
          `tee rotation ${rotation}, edge ${edge}`,
        ).toEqual(expectedEdgeRegions('tee', rotation, edge));
      }
    }
  });

  it('lets a one-ended source leave by either physical bank', () => {
    for (const rotation of ROTATIONS) {
      for (const edge of EDGES) {
        expect(
          edgeRegions('source', rotation, edge),
          `source rotation ${rotation}, edge ${edge}`,
        ).toEqual([0, 0]);
      }
    }

    const source = { x: 20, y: 20 };
    const next = neighbour(source, 'n');
    const board: Board = {
      [coordKey(source)]: tile('source', 0, 'mountain'),
      [coordKey(next)]: tile('straight', 0),
    };
    expect(transitionsTo(board, { ...source, region: 0 }, next), 'source north exit').toEqual([0, 1]);
  });

  it('keeps the transition graph undirected across every matching shape edge', () => {
    for (const shape of RIVER_SHAPES) {
      for (const rotation of ROTATIONS) {
        for (const otherShape of RIVER_SHAPES) {
          for (const otherRotation of ROTATIONS) {
            for (const edge of EDGES) {
              const riverHere = riverEdgesOf(shape, rotation).includes(edge);
              const riverThere = riverEdgesOf(otherShape, otherRotation).includes(OPPOSITE[edge]);
              if (riverHere !== riverThere) continue;

              const at = { x: 30, y: 30 };
              const other = neighbour(at, edge);
              const board: Board = {
                [coordKey(at)]: tile(shape, rotation),
                [coordKey(other)]: tile(otherShape, otherRotation),
              };
              for (let region = 0; region < EXPECTED_COUNTS[shape]; region++) {
                const label = `${shape} r${rotation} ${edge} -> ${otherShape} r${otherRotation}, bank ${region}`;
                const expected = targetRegions(
                  shape,
                  rotation,
                  edge,
                  otherShape,
                  otherRotation,
                  region,
                );
                expect(transitionsTo(board, { ...at, region }, other), label).toEqual(expected);
                for (const destination of expected) {
                  expect(
                    transitionsTo(board, { ...other, region: destination }, at),
                    `${label}, reverse bank ${destination}`,
                  ).toContain(region);
                }
              }
            }
          }
        }
      }
    }
  });

  it('maps a neighbour route through the physical half-edges of a bend', () => {
    const at = { x: 40, y: 40 };
    const other = neighbour(at, 'n');
    const board: Board = {
      [coordKey(at)]: tile('bend', 0),
      [coordKey(other)]: tile('bend', 2),
    };
    /* At A's north river edge, its outside bank is B's inside bank. */
    expect(transitionsTo(board, { ...at, region: 0 }, other)).toEqual([1]);
    expect(transitionsTo(board, { ...at, region: 1 }, other)).toEqual([0]);
    expect(transitionsTo(board, { ...other, region: 1 }, at)).toEqual([0]);
    expect(transitionsTo(board, { ...other, region: 0 }, at)).toEqual([1]);
  });
});

describe('bank routes to Babel', () => {
  it('marks only the bank physically touching Babel as reachable', () => {
    const board: Board = { '0,-1': tile('bend', 0) };
    const tileAtBabelEdge = { x: 0, y: -1 };
    expect(regionTransitions(board, nodeAt(0, -1, 0))).not.toContainEqual({ x: 0, y: 0, region: 0 });
    expect(regionTransitions(board, nodeAt(0, -1, 1))).toContainEqual({ x: 0, y: 0, region: 0 });

    const distance = bankDistancesToBabel(board);
    expect(distance[regionKey(nodeAt(tileAtBabelEdge.x, tileAtBabelEdge.y, 0))]).toBeUndefined();
    expect(distance[regionKey(nodeAt(tileAtBabelEdge.x, tileAtBabelEdge.y, 1))]).toBe(1);
  });

  it('does not make Babel a transit node for neighbouring regions', () => {
    const board: Board = {
      '0,-1': tile('bend', 0),
      '0,1': tile('bend', 2),
    };
    expect(regionTransitions(board, { x: 0, y: 0, region: 0 })).toEqual([]);
    expect(regionTransitions(board, nodeAt(0, -1, 1))).toEqual([{ x: 0, y: 0, region: 0 }]);
    expect(regionTransitions(board, nodeAt(0, 1, 1))).toEqual([{ x: 0, y: 0, region: 0 }]);
  });

  it('excludes Lakes from the bank graph in both directions', () => {
    const board: Board = {
      '2,1': tile('none', 0, 'lake'),
      '1,1': tile('none', 0, 'desert'),
    };
    expect(tileRegionCount(board, { x: 2, y: 1 })).toBe(0);
    expect(dryRegions(board, { x: 2, y: 1 })).toEqual([]);
    expect(regionTransitions(board, nodeAt(1, 1, 0))).toEqual([]);
    expect(regionTransitions(board, nodeAt(2, 1, 0))).toEqual([]);
  });

  it('routes both source banks over three straight desert tiles in four steps', () => {
    const board: Board = {
      '0,4': tile('source', 0, 'mountain'),
      '0,3': tile('straight', 0, 'desert'),
      '0,2': tile('straight', 0, 'desert'),
      '0,1': tile('straight', 0, 'desert'),
    };
    const source = nodeAt(0, 4, 0);
    const distance = bankDistancesToBabel(board);
    expect(distance[regionKey(source)]).toBe(4);
    expect(bankStepOptions(board, source, distance).map(regionKey).sort()).toEqual(
      [nodeAt(0, 3, 0), nodeAt(0, 3, 1)].map(regionKey).sort(),
    );
    for (const bank of [0, 1]) {
      expect(distance[regionKey(nodeAt(0, 3, bank))], `first straight bank ${bank}`).toBe(3);
      expect(distance[regionKey(nodeAt(0, 2, bank))], `second straight bank ${bank}`).toBe(2);
      expect(distance[regionKey(nodeAt(0, 1, bank))], `third straight bank ${bank}`).toBe(1);
    }
  });
});
