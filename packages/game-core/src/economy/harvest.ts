import { BUILDINGS, isHarvester, type ResourceType } from '@babel-game/game-data';
import { buildingsInFeature, type Buildings } from '../buildings/index.js';
import { isFeatureOccupied } from '../features/index.js';
import type { Coord } from '../map/edges.js';
import type { Board } from '../map/placement.js';
import type { PlayerId, TileDraw } from '../state/types.js';
import { basePayout } from './payout.js';

export type HarvestTrigger = {
  /** Foreign owners paid, each receiving the placement's base payout. */
  readonly owners: readonly PlayerId[];
  readonly resource: ResourceType;
  readonly amount: number;
  /** GDD §9: +1 to the placer, once, however many foreign buildings fired. */
  readonly placerBonus: number;
};

/**
 * The foreign expansion trigger. GDD §9.
 *
 * When a Leader places a tile expanding a feature that contains another
 * Leader's matching harvesting building, and the feature is not occupied:
 *
 * 1. the placing player gets their normal base payout (handled by the caller);
 * 2. each foreign building owner gets that same base payout in the matching
 *    resource;
 * 3. if any foreign building triggered, the placer gains +1 extra matching
 *    resource **in total** — it does not stack with the number of owners.
 *
 * Your own building never triggers from your own placement.
 *
 * RD-006: GDD §9 allows one harvesting building of a type per player per
 * connected feature, but a placement can merge two features in which the same
 * Leader holds one each. Canon does not say what happens. We pay that owner
 * once, since the rule's intent is one trigger per player per feature.
 */
export function resolveHarvest(
  boardAfterPlacement: Board,
  buildings: Buildings,
  occupiedTiles: readonly string[],
  at: Coord,
  draw: TileDraw,
  placer: PlayerId,
): HarvestTrigger | null {
  const base = basePayout(boardAfterPlacement, at, draw);
  if (!base) return null;

  /* GDD §10: an occupied feature's harvesting buildings do not trigger. */
  if (isFeatureOccupied(boardAfterPlacement, occupiedTiles, at)) return null;

  const owners = new Set<PlayerId>();
  for (const { building } of buildingsInFeature(boardAfterPlacement, buildings, at)) {
    if (building.owner === placer) continue;
    /* GDD §16: a Tower is defensive, so it never pays out. */
    if (!isHarvester(building.type)) continue;
    if (BUILDINGS[building.type].resource !== base.resource) continue;
    owners.add(building.owner);
  }

  if (owners.size === 0) return null;

  return {
    owners: [...owners],
    resource: base.resource,
    amount: base.amount,
    placerBonus: 1,
  };
}
