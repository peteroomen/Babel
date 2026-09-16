import { CANON_RULES } from '@babel-game/game-data';
import { BABEL_COORD } from '../state/babel.js';
import { coordKey, neighbours, type Coord } from '../map/edges.js';
import { tileAt, type Board } from '../map/placement.js';
import type { PlacedTile } from '../state/types.js';

/**
 * GDD §7: a Heavenly Host cannot enter a river or Lake tile. Rivers therefore
 * permanently shape the invasion map, which is the whole point of them.
 *
 * Which *terrain* blocks is a ruleset question — canon says Lake — so that a
 * variant can make another terrain defensive without forking the pathfinder.
 * A river on a tile blocks regardless of its terrain.
 */
export function isPassable(
  tile: PlacedTile | undefined,
  impassable: readonly string[] = CANON_RULES.impassableTerrain,
): boolean {
  if (!tile) return false;
  if (impassable.includes(tile.terrain)) return false;
  return tile.river === 'none';
}

export const isPassableAt = (
  board: Board,
  at: Coord,
  impassable: readonly string[] = CANON_RULES.impassableTerrain,
): boolean => isPassable(tileAt(board, at), impassable);

/**
 * Distance in tiles from every passable square to Babel, by breadth-first
 * search outward from Babel itself.
 *
 * Babel is not a land tile, so it seeds the search at distance 0 and its
 * passable neighbours sit at 1. Squares with no legal land route are absent
 * from the result, which is what makes Beacon legality checkable.
 */
export function distancesToBabel(
  board: Board,
  impassable: readonly string[] = CANON_RULES.impassableTerrain,
): Record<string, number> {
  const distance: Record<string, number> = { [coordKey(BABEL_COORD)]: 0 };
  let frontier: Coord[] = [BABEL_COORD];
  let step = 0;

  while (frontier.length > 0) {
    step += 1;
    const next: Coord[] = [];
    for (const current of frontier) {
      for (const candidate of neighbours(current)) {
        const key = coordKey(candidate);
        if (key in distance) continue;
        if (!isPassableAt(board, candidate, impassable)) continue;
        distance[key] = step;
        next.push(candidate);
      }
    }
    frontier = next;
  }

  return distance;
}

export const hasRouteToBabel = (
  board: Board,
  at: Coord,
  impassable: readonly string[] = CANON_RULES.impassableTerrain,
): boolean => coordKey(at) in distancesToBabel(board, impassable);

/**
 * Where a Host standing at `at` may step next.
 *
 * GDD §14: a Host follows a shortest legal land route to Babel, so every legal
 * step strictly decreases its distance. Where several equally short routes
 * exist this returns more than one square and the players choose between them.
 * Returns an empty list when the Host is stranded or already at Babel.
 */
export function stepOptions(
  board: Board,
  at: Coord,
  distance?: Record<string, number>,
  impassable: readonly string[] = CANON_RULES.impassableTerrain,
): Coord[] {
  distance ??= distancesToBabel(board, impassable);
  const here = distance[coordKey(at)];
  if (here === undefined || here === 0) return [];
  return neighbours(at)
    .filter((candidate) => distance[coordKey(candidate)] === here - 1)
    /* Stable ordering, so a default plan is reproducible. */
    .sort((a, b) => coordKey(a).localeCompare(coordKey(b)));
}
