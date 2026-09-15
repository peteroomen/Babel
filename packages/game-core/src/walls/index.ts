import { coordKey, neighbours, type Coord } from '../map/edges.js';
import { tileAt, type Board } from '../map/placement.js';

/**
 * A Wall sits on the edge between two adjacent land tiles. GDD §17.
 *
 * Stored with its two squares in a fixed order so the same physical edge always
 * has the same identity, whichever side a Host approaches it from.
 */
export type WallEdge = { readonly a: Coord; readonly b: Coord };

export function wallKey(a: Coord, b: Coord): string {
  const [first, second] = [coordKey(a), coordKey(b)].sort();
  return `${first}|${second}`;
}

export const wallEdgeKey = (wall: WallEdge): string => wallKey(wall.a, wall.b);

/** Put an edge into its canonical orientation. */
export function canonicalWall(a: Coord, b: Coord): WallEdge {
  return coordKey(a) <= coordKey(b) ? { a, b } : { a: b, b: a };
}

export const hasWallBetween = (
  walls: readonly WallEdge[],
  a: Coord,
  b: Coord,
): boolean => walls.some((wall) => wallEdgeKey(wall) === wallKey(a, b));

export const removeWallBetween = (
  walls: readonly WallEdge[],
  a: Coord,
  b: Coord,
): WallEdge[] => walls.filter((wall) => wallEdgeKey(wall) !== wallKey(a, b));

/**
 * Every edge a Wall could legally be built on. GDD §17: on edges between
 * adjacent land tiles, and not where a Wall already stands.
 */
export function getLegalWallEdges(board: Board, walls: readonly WallEdge[]): WallEdge[] {
  const seen = new Set(walls.map(wallEdgeKey));
  const out: WallEdge[] = [];

  for (const key of Object.keys(board)) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    const at = { x, y };
    for (const other of neighbours(at)) {
      if (!tileAt(board, other)) continue;
      const wall = canonicalWall(at, other);
      const id = wallEdgeKey(wall);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(wall);
    }
  }

  return out.sort((l, r) => wallEdgeKey(l).localeCompare(wallEdgeKey(r)));
}
