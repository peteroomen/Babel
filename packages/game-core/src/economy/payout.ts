import { TERRAIN_RESOURCE, type ResourceType } from '@babel-game/game-data';
import { coordKey, neighbours, type Coord, type Rotation } from '../map/edges.js';
import { tileAt, type Board } from '../map/placement.js';
import { isFeatureOccupied } from '../features/index.js';
import { occupiedKeys } from '../heaven/hosts.js';
import type { Host, TileDraw } from '../state/types.js';

export type Payout = { readonly resource: ResourceType; readonly amount: number } | null;

/**
 * GDD §6: base payout = 1 + the number of orthogonally adjacent tiles of the
 * same terrain.
 *
 * Note this counts *adjacent* tiles, not the size of the connected feature —
 * an isolated Forest pays 1 even if a large Forest sits two squares away.
 * Desert and Lake pay nothing.
 */
export function basePayout(board: Board, at: Coord, draw: TileDraw): Payout {
  const resource = TERRAIN_RESOURCE[draw.terrain];
  if (!resource) return null;

  const matching = neighbours(at).filter(
    (n) => tileAt(board, n)?.terrain === draw.terrain,
  ).length;

  return { resource, amount: 1 + matching };
}

/**
 * The payout a placement actually yields, after occupation.
 *
 * GDD §10: placing into an occupied feature gives no normal resource payout.
 * The feature is judged *after* the tile lands, so a tile joining an occupied
 * feature is suppressed, and a placement that merges a clean feature into an
 * occupied one is suppressed too.
 */
export function placementPayout(
  boardAfterPlacement: Board,
  occupiedTiles: readonly string[],
  at: Coord,
  draw: TileDraw,
): Payout {
  const base = basePayout(boardAfterPlacement, at, draw);
  if (!base) return null;
  if (isFeatureOccupied(boardAfterPlacement, occupiedTiles, at)) return null;
  return base;
}

/**
 * What a placement *would* pay, without committing it.
 *
 * The UI shows a projected payout before the player confirms (AGENT_HANDOFF,
 * prototype UX requirements). It lives here so the preview and the real
 * transition cannot disagree: both run the same rule over the same
 * hypothetical board.
 */
export function previewPlacement(
  state: { readonly board: Board; readonly hosts: readonly Host[] },
  at: Coord,
  draw: TileDraw,
  rotation: Rotation,
): Payout {
  const board: Board = {
    ...state.board,
    [coordKey(at)]: { ...draw, rotation },
  };
  return placementPayout(board, occupiedKeys(state.hosts), at, draw);
}
