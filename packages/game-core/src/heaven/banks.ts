import { RIVER_SHAPE_EDGES, type RiverShape } from '@babel-game/game-data';
import {
  EDGES,
  OPPOSITE,
  coordKey,
  neighbour,
  riverEdgesOf,
  rotateEdge,
  type Coord,
  type Edge,
  type RegionCoord,
  type Rotation,
} from '../map/edges.js';
import { BABEL_COORD } from '../state/babel.js';
import { tileAt, type Board } from '../map/placement.js';

export type { RegionCoord } from '../map/edges.js';

const DISTANCE_CACHE = new WeakMap<object, Record<string, number>>();

/** A coordinate key that cannot collide between two banks of one tile. */
export const regionKey = (at: RegionCoord): string => `${coordKey(at)}@${at.region ?? 0}`;

/* Components of the dry land around an unrotated river. An edge's pair is
   left/right when looking out through that edge. */
const BASE: Record<RiverShape, { count: number; edges: Record<Edge, readonly [number, number]> }> = {
  none: { count: 1, edges: { n: [0, 0], e: [0, 0], s: [0, 0], w: [0, 0] } },
  source: { count: 1, edges: { n: [0, 0], e: [0, 0], s: [0, 0], w: [0, 0] } },
  straight: { count: 2, edges: { n: [0, 1], e: [1, 1], s: [1, 0], w: [0, 0] } },
  bend: { count: 2, edges: { n: [1, 0], e: [0, 1], s: [1, 1], w: [1, 1] } },
  tee: { count: 3, edges: { n: [2, 0], e: [0, 1], s: [1, 1], w: [1, 2] } },
};

export function dryRegionCount(shape: RiverShape): number { return BASE[shape].count; }

function unrotate(edge: Edge, rotation: Rotation): Edge {
  return EDGES[(EDGES.indexOf(edge) - rotation + 4) % 4] as Edge;
}

/** The two half-edge banks exposed by a river edge, or one repeated region. */
export function edgeRegions(shape: RiverShape, rotation: Rotation, edge: Edge): readonly [number, number] {
  const base = BASE[shape].edges[unrotate(edge, rotation)];
  return base;
}

export function tileRegionCount(board: Board, at: Coord): number {
  const tile = tileAt(board, at);
  if (!tile || tile.terrain === 'lake') return 0;
  return dryRegionCount(tile.river);
}

export function normalizeRegion(board: Board, at: RegionCoord): RegionCoord {
  const count = tileRegionCount(board, at);
  if (count <= 1) return { x: at.x, y: at.y, region: 0 };
  if (at.region === undefined || at.region < 0 || at.region >= count) {
    throw new Error(`a bank is required for ${coordKey(at)} (expected 0-${count - 1})`);
  }
  return { x: at.x, y: at.y, region: at.region };
}

/** Region nodes connected across one board edge without crossing water. */
export function regionTransitions(board: Board, from: RegionCoord): RegionCoord[] {
  const tile = tileAt(board, from);
  if (coordKey(from) === coordKey(BABEL_COORD)) return [];
  if (!tile || tile.terrain === 'lake') return [];
  return transitionsFromTile(board, from, tile);
}

/** False Prophet may redirect a Host away from Babel; ordinary shortest-route
 * traversal deliberately treats Babel as a terminal and never uses this. */
export function babelDepartures(board: Board): RegionCoord[] {
  const result: RegionCoord[] = [];
    for (const edge of EDGES) {
      const next = neighbour(BABEL_COORD, edge);
      const across = tileAt(board, next);
      if (!across || across.terrain === 'lake') continue;
      const edgePair = edgeRegions(across.river, across.rotation, OPPOSITE[edge]);
      const river = riverEdgesOf(across.river, across.rotation).includes(OPPOSITE[edge]);
      if (river) {
        for (const region of new Set(edgePair)) result.push({ ...next, region });
      } else result.push({ ...next, region: edgePair[0] });
    }
    return result;
}

function transitionsFromTile(board: Board, from: RegionCoord, tile: NonNullable<ReturnType<typeof tileAt>>): RegionCoord[] {
  const region = from.region ?? 0;
  const result: RegionCoord[] = [];
  for (const edge of EDGES) {
    const next = neighbour(from, edge);
    const across = tileAt(board, next);
    if (!across) {
      if (coordKey(next) === coordKey(BABEL_COORD) && edgeRegions(tile.river, tile.rotation, edge).includes(region)) {
        result.push({ ...BABEL_COORD, region: 0 });
      }
      continue;
    }
    if (across.terrain === 'lake') continue;
    const riverHere = riverEdgesOf(tile.river, tile.rotation).includes(edge);
    const riverThere = riverEdgesOf(across.river, across.rotation).includes(OPPOSITE[edge]);
    const here = edgeRegions(tile.river, tile.rotation, edge);
    const there = edgeRegions(across.river, across.rotation, OPPOSITE[edge]);
    if (riverHere !== riverThere) continue;
    if (!riverHere) {
      if (here[0] === region) result.push({ ...next, region: there[0] });
      continue;
    }
    /* Preserve the side of the water. The outward left bank meets the
       inward right bank on the opposite tile, hence the reversed index. */
    const sides = here[0] === here[1]
      ? (here[0] === region ? [...new Set(there)] : [])
      : (() => {
          const side = here.indexOf(region);
          return side >= 0 ? [there[1 - side] ?? 0] : [];
        })();
    for (const destination of sides) result.push({ ...next, region: destination });
  }
  return result;
}

/** Distances on the bank graph. Babel is a terminal, not a transit tile. */
export function bankDistancesToBabel(board: Board): Record<string, number> {
  const cached = DISTANCE_CACHE.get(board as object);
  if (cached) return cached;
  const distance: Record<string, number> = { [regionKey(BABEL_COORD)]: 0 };
  const frontier: RegionCoord[] = [];
  for (const key of Object.keys(board)) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    const at = { x, y };
    for (let region = 0; region < tileRegionCount(board, at); region++) {
      const node = { ...at, region };
      if (regionTransitions(board, node).some((n) => coordKey(n) === coordKey(BABEL_COORD))) {
        distance[regionKey(node)] = 1;
        frontier.push(node);
      }
    }
  }
  while (frontier.length) {
    const current = frontier.shift() as RegionCoord;
    const nextDistance = (distance[regionKey(current)] ?? 0) + 1;
    for (const next of regionTransitions(board, current)) {
      if (coordKey(next) === coordKey(BABEL_COORD)) continue;
      const key = regionKey(next);
      if (key in distance) continue;
      distance[key] = nextDistance;
      frontier.push(next);
    }
  }
  DISTANCE_CACHE.set(board as object, distance);
  return distance;
}

export function bankStepOptions(board: Board, at: RegionCoord, distance = bankDistancesToBabel(board)): RegionCoord[] {
  const here = distance[regionKey(at)];
  if (here === undefined || here === 0) return [];
  return regionTransitions(board, at)
    .filter((next) => distance[regionKey(next)] === here - 1 || coordKey(next) === coordKey(BABEL_COORD))
    .sort((a, b) => regionKey(a).localeCompare(regionKey(b)));
}

/** Regions of a placed tile; useful for legal bank choices in UI/AI. */
export function dryRegions(board: Board, at: Coord): RegionCoord[] {
  return Array.from({ length: tileRegionCount(board, at) }, (_, region) => ({ ...at, region }));
}

export function isBankAware(shape: RiverShape): boolean {
  return RIVER_SHAPE_EDGES[shape].length > 0;
}
