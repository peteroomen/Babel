import { TERRAIN_RESOURCE, type ResourceType, type RuleSet } from '@babel-game/game-data';
import { coordKey, neighbours, type Coord, type Rotation } from '../map/edges.js';
import { tileAt, type Board } from '../map/placement.js';
import { isFeatureOccupied } from '../features/index.js';
import { isDryFeatureOccupied, placementDryFeatureGroups } from '../features/banks.js';
import { regionTransitions } from '../heaven/banks.js';
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

/** Bank experiment payout: collect both banks of a river tile once, while a
 * Host suppresses only the bank-feature it actually occupies. */
export function bankPlacementPayout(
  boardAfterPlacement: Board,
  hosts: readonly Host[],
  at: Coord,
  draw: TileDraw,
): Payout {
  const resource = TERRAIN_RESOURCE[draw.terrain];
  if (!resource) return null;
  const groups = placementDryFeatureGroups(boardAfterPlacement, at);
  const cleanGroups = groups.filter((group) => !isDryFeatureOccupied(boardAfterPlacement, group, hosts));
  if (cleanGroups.length === 0) return null;
  const connectedNeighbours = new Set<string>();
  for (const group of cleanGroups) {
    const origins = group.filter((node) => coordKey(node) === coordKey(at));
    for (const origin of origins) {
      for (const next of regionTransitions(boardAfterPlacement, origin)) {
        if (neighbours(at).some((neighbor) => coordKey(neighbor) === coordKey(next)) &&
          boardAfterPlacement[coordKey(next)]?.terrain === draw.terrain) {
          connectedNeighbours.add(coordKey(next));
        }
      }
    }
  }
  const matching = connectedNeighbours.size;
  return { resource, amount: 1 + matching };
}

export const bankPlacementBasePayout = bankPlacementPayout;

/**
 * What a placement *would* pay, without committing it.
 *
 * The UI shows a projected payout before the player confirms (AGENT_HANDOFF,
 * prototype UX requirements). It lives here so the preview and the real
 * transition cannot disagree: both run the same rule over the same
 * hypothetical board.
 */
export function previewPlacement(
  state: { readonly board: Board; readonly hosts: readonly Host[]; readonly rules?: Pick<RuleSet, 'bankMode'> },
  at: Coord,
  draw: TileDraw,
  rotation: Rotation,
): Payout {
  const board: Board = {
    ...state.board,
    [coordKey(at)]: { ...draw, rotation },
  };
  return state.rules?.bankMode === 'resources'
    ? bankPlacementPayout(board, state.hosts, at, draw)
    : placementPayout(board, occupiedKeys(state.hosts), at, draw);
}
