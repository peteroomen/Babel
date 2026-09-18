import { RIVER_SHAPE_EDGES, type RiverShape } from '@babel-game/game-data';

/** Screen-space orientation: north is -y, so the board grows downward on +y. */
export const EDGES = ['n', 'e', 's', 'w'] as const;
export type Edge = (typeof EDGES)[number];

/** Quarter turns clockwise. GDD §6: a tile may be rotated freely before placement. */
export const ROTATIONS = [0, 1, 2, 3] as const;
export type Rotation = (typeof ROTATIONS)[number];

export type Coord = { readonly x: number; readonly y: number };

/** A coordinate plus an optional dry-region selector for bank experiments. */
export type RegionCoord = Coord & { readonly region?: number };

export const coordKey = (c: Coord): string => `${c.x},${c.y}`;

export const OPPOSITE: Record<Edge, Edge> = { n: 's', e: 'w', s: 'n', w: 'e' };

/** The neighbour that lies across a given edge. */
export const STEP: Record<Edge, Coord> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};

export const neighbour = (at: Coord, edge: Edge): Coord => ({
  x: at.x + STEP[edge].x,
  y: at.y + STEP[edge].y,
});

export const neighbours = (at: Coord): Coord[] => EDGES.map((e) => neighbour(at, e));

/** Rotate one edge clockwise by `rotation` quarter turns. */
export function rotateEdge(edge: Edge, rotation: Rotation): Edge {
  return EDGES[(EDGES.indexOf(edge) + rotation) % 4] as Edge;
}

/** The edges a shape's river touches once rotated into place. */
export function riverEdgesOf(shape: RiverShape, rotation: Rotation): Edge[] {
  return RIVER_SHAPE_EDGES[shape].map((edge) => rotateEdge(edge, rotation));
}

export function hasRiverOn(shape: RiverShape, rotation: Rotation, edge: Edge): boolean {
  return riverEdgesOf(shape, rotation).includes(edge);
}
