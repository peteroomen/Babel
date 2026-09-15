import { coordKey, neighbours, type Coord } from '../map/edges.js';
import { tileAt, type Board } from '../map/placement.js';

/**
 * GDD §6: a feature is an orthogonally connected group of the same base
 * terrain. River overlays do not split terrain connectivity, so this walks
 * terrain only and ignores rivers entirely.
 *
 * Returns coordinate keys. Per TECH_ARCHITECTURE, feature membership is
 * recomputed rather than stored, so occupation and harvester logic cannot
 * drift apart.
 */
export function getConnectedFeature(board: Board, at: Coord): string[] {
  const origin = tileAt(board, at);
  if (!origin) return [];

  const seen = new Set<string>([coordKey(at)]);
  const queue: Coord[] = [at];
  const found: string[] = [];

  while (queue.length > 0) {
    const current = queue.pop() as Coord;
    found.push(coordKey(current));
    for (const next of neighbours(current)) {
      const key = coordKey(next);
      if (seen.has(key)) continue;
      const tile = board[key];
      if (!tile || tile.terrain !== origin.terrain) continue;
      seen.add(key);
      queue.push(next);
    }
  }

  return found.sort();
}

/**
 * GDD §10: if any Host occupies any tile of a connected feature, the whole
 * feature is occupied and its economy shuts down.
 *
 * Hosts arrive in Milestone 3. Until then `occupiedTiles` is the seam they
 * will populate, so the suppression rule can be built and tested now.
 */
export function isFeatureOccupied(
  board: Board,
  occupiedTiles: readonly string[],
  at: Coord,
): boolean {
  if (occupiedTiles.length === 0) return false;
  const occupied = new Set(occupiedTiles);
  return getConnectedFeature(board, at).some((key) => occupied.has(key));
}
