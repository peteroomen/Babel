import { BABEL_COORD } from '../state/babel.js';
import type { PlacedTile, TileDraw } from '../state/types.js';
import {
  EDGES,
  OPPOSITE,
  ROTATIONS,
  coordKey,
  hasRiverOn,
  neighbour,
  neighbours,
  type Coord,
  type Edge,
  type Rotation,
} from './edges.js';

export type Board = Readonly<Record<string, PlacedTile>>;

export const tileAt = (board: Board, at: Coord): PlacedTile | undefined =>
  board[coordKey(at)];

export const isBabel = (at: Coord): boolean => at.x === BABEL_COORD.x && at.y === BABEL_COORD.y;

/** GDD §6: adjacent to the existing board, or to Babel. */
export function isAdjacentToBoard(board: Board, at: Coord): boolean {
  return neighbours(at).some((n) => Boolean(tileAt(board, n)) || isBabel(n));
}

/**
 * River-edge legality, per RD-001.
 *
 * GDD §7 states the rule one-directionally ("if a river edge touches an
 * existing tile, that edge must meet another river edge"). We enforce it
 * symmetrically: across any edge shared with a placed tile, both sides carry
 * river or neither does. A plain edge may therefore not dead-end an existing
 * river.
 *
 * Edges facing empty space are unconstrained, which is what lets a river
 * "point into unexplored space". Edges facing Babel are likewise unconstrained:
 * Babel is not a land tile, and GDD §5's fixed start tile already runs its
 * river straight into it.
 */
export function riversMatch(
  board: Board,
  at: Coord,
  draw: TileDraw,
  rotation: Rotation,
): boolean {
  return EDGES.every((edge) => {
    const other = tileAt(board, neighbour(at, edge));
    if (!other) return true;
    const mine = hasRiverOn(draw.river, rotation, edge);
    const theirs = hasRiverOn(other.river, other.rotation, OPPOSITE[edge]);
    return mine === theirs;
  });
}

export function isLegalPlacement(
  board: Board,
  at: Coord,
  draw: TileDraw,
  rotation: Rotation,
): boolean {
  if (tileAt(board, at) || isBabel(at)) return false;
  if (!isAdjacentToBoard(board, at)) return false;
  return riversMatch(board, at, draw, rotation);
}

/** Which rotations of this tile would be legal at this square. */
export function legalRotations(board: Board, at: Coord, draw: TileDraw): Rotation[] {
  if (tileAt(board, at) || isBabel(at)) return [];
  if (!isAdjacentToBoard(board, at)) return [];
  const legal = ROTATIONS.filter((r) => riversMatch(board, at, draw, r));
  /* A riverless tile is identical in all four rotations; offer it once. */
  return draw.river === 'none' ? legal.slice(0, 1) : legal;
}

/** Every empty square touching the board or Babel. */
export function frontier(board: Board): Coord[] {
  const seen = new Set<string>();
  const out: Coord[] = [];
  const consider = (c: Coord) => {
    const key = coordKey(c);
    if (seen.has(key) || board[key] || isBabel(c)) return;
    seen.add(key);
    out.push(c);
  };
  for (const key of Object.keys(board)) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    neighbours({ x, y }).forEach(consider);
  }
  neighbours(BABEL_COORD).forEach(consider);
  return out;
}

export type PlacementOption = { readonly at: Coord; readonly rotations: Rotation[] };

/**
 * The single source of truth for placement legality. GDD §6 / TECH_ARCHITECTURE:
 * the UI renders from this rather than reimplementing adjacency and river rules.
 */
export function getLegalTilePlacements(board: Board, draw: TileDraw): PlacementOption[] {
  return frontier(board)
    .map((at) => ({ at, rotations: legalRotations(board, at, draw) }))
    .filter((option) => option.rotations.length > 0);
}

/** RD-002: a tile with nowhere legal to go is discarded and redrawn. */
export function hasAnyLegalPlacement(board: Board, draw: TileDraw): boolean {
  return frontier(board).some((at) => legalRotations(board, at, draw).length > 0);
}

export type { Coord, Edge, Rotation };
