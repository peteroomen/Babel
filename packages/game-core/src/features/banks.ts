import { coordKey, type Coord, type RegionCoord } from '../map/edges.js';
import { tileAt, type Board } from '../map/placement.js';
import { dryRegions, regionKey, regionTransitions } from '../heaven/banks.js';
import type { Host } from '../state/types.js';

/** Region-aware terrain feature. A physical river tile can occur in two
 * features, but callers may union them and dedupe physical tile keys. */
export function getConnectedDryFeature(board: Board, at: RegionCoord): RegionCoord[] {
  const origin = tileAt(board, at);
  if (!origin) return [];
  const start = dryRegions(board, at).find((candidate) => (candidate.region ?? 0) === (at.region ?? 0));
  if (!start) return [];
  const seen = new Set<string>([regionKey(start)]);
  const queue: RegionCoord[] = [start];
  const found: RegionCoord[] = [];
  while (queue.length) {
    const current = queue.pop() as RegionCoord;
    found.push(current);
    for (const next of regionTransitions(board, current)) {
      const tile = tileAt(board, next);
      if (!tile || tile.terrain !== origin.terrain || coordKey(next) === coordKey({ x: 0, y: 0 })) continue;
      const key = regionKey(next);
      if (!seen.has(key)) { seen.add(key); queue.push(next); }
    }
  }
  return found;
}

export function placementDryFeatures(board: Board, at: Coord): RegionCoord[] {
  const tile = tileAt(board, at);
  if (!tile) return [];
  /* River collection reaches both banks; a dry tile has one region. */
  const regions = dryRegions(board, at);
  const all = regions.flatMap((region) => getConnectedDryFeature(board, region));
  const seen = new Set<string>();
  return all.filter((node) => {
    const key = regionKey(node);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function placementDryFeatureGroups(board: Board, at: Coord): RegionCoord[][] {
  const tile = tileAt(board, at);
  if (!tile) return [];
  const seen = new Set<string>();
  return dryRegions(board, at).flatMap((region) => {
    const group = getConnectedDryFeature(board, region);
    const identity = group.map(regionKey).sort().join('|');
    if (seen.has(identity)) return [];
    seen.add(identity);
    return [group];
  });
}

export function physicalFeatureKeys(features: readonly RegionCoord[]): string[] {
  return [...new Set(features.map(coordKey))].sort();
}

export function isDryFeatureOccupied(
  board: Board,
  features: readonly RegionCoord[],
  hosts: readonly Host[],
): boolean {
  const keys = new Set(features.map(regionKey));
  return hosts.some((host) => keys.has(regionKey({ ...host.at, region: host.region ?? 0 })));
}
