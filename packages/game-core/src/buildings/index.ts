import {
  BUILDINGS,
  BUILDING_FOR_TERRAIN,
  MONUMENT,
  TOWER,
  TOWER_COST,
  type BuildingType,
  type ResourceType,
} from '@babel-game/game-data';
import { getConnectedFeature } from '../features/index.js';
import { getConnectedDryFeature } from '../features/banks.js';
import { dryRegions } from '../heaven/banks.js';
import { coordKey, type Coord } from '../map/edges.js';
import { tileAt, type Board } from '../map/placement.js';
import type { Building, LeaderState, PlayerId } from '../state/types.js';

export type Buildings = Readonly<Record<string, Building>>;

export const buildingAt = (buildings: Buildings, at: Coord): Building | undefined =>
  buildings[coordKey(at)];

/** Can this Leader afford the cost? */
export function canAfford(
  leader: LeaderState,
  cost: Partial<Record<ResourceType, number>>,
): boolean {
  return Object.entries(cost).every(
    ([resource, amount]) => leader.resources[resource as ResourceType] >= (amount ?? 0),
  );
}

export function paySpecific(
  leader: LeaderState,
  cost: Partial<Record<ResourceType, number>>,
): LeaderState['resources'] {
  const resources = { ...leader.resources };
  for (const [resource, amount] of Object.entries(cost)) {
    resources[resource as ResourceType] -= amount ?? 0;
  }
  return resources;
}

/** Every building standing in the connected feature that contains `at`. */
export function buildingsInFeature(
  board: Board,
  buildings: Buildings,
  at: Coord,
): { key: string; building: Building }[] {
  return getConnectedFeature(board, at)
    .flatMap((key) => {
      const building = buildings[key];
      return building ? [{ key, building }] : [];
    });
}

/** Bank-aware counterpart used only by the resource experiment. */
export function buildingsInDryFeature(
  board: Board,
  buildings: Buildings,
  at: Coord,
  region = 0,
): { key: string; building: Building }[] {
  return getConnectedDryFeature(board, { ...at, region }).flatMap((node) => {
    const building = buildings[coordKey(node)];
    return building && (building.region ?? 0) === (node.region ?? 0)
      ? [{ key: coordKey(node), building }]
      : [];
  });
}

export type BuildRejection =
  | 'noTile'
  | 'terrainMismatch'
  | 'tileOccupiedByBuilding'
  | 'alreadyOwnsInFeature'
  | 'bankRequired'
  | 'cannotAfford';

/**
 * Whether a Leader may build a harvesting building here. GDD §9:
 *
 * - the terrain must match the building;
 * - there is normally one building per land tile (§3);
 * - a player may own at most one harvesting building of a given type in the
 *   same connected feature, though different players may each invest in it.
 */
export function canBuildHarvester(
  board: Board,
  buildings: Buildings,
  leader: LeaderState,
  at: Coord,
  type: BuildingType,
  bankMode?: 'hosts' | 'resources',
  region?: number,
): BuildRejection | null {
  const tile = tileAt(board, at);
  if (!tile) return 'noTile';
  if (BUILDINGS[type].terrain !== tile.terrain) return 'terrainMismatch';
  if (buildingAt(buildings, at)) return 'tileOccupiedByBuilding';

  const selected = bankMode === 'resources' ? (region ?? 0) : undefined;
  if (bankMode === 'resources' && dryRegions(board, at).length > 1 && region === undefined) return 'bankRequired';
  if (bankMode === 'resources' && !dryRegions(board, at).some((candidate) => (candidate.region ?? 0) === selected)) {
    return 'noTile';
  }
  const owned = (bankMode === 'resources'
    ? buildingsInDryFeature(board, buildings, at, selected)
    : buildingsInFeature(board, buildings, at)).some(
    ({ building }) => building.owner === leader.id && building.type === type,
  );
  if (owned) return 'alreadyOwnsInFeature';

  if (!canAfford(leader, BUILDINGS[type].cost)) return 'cannotAfford';
  return null;
}

/** Every square where this Leader could legally build something right now. */
export function getLegalBuildSites(
  board: Board,
  buildings: Buildings,
  leader: LeaderState,
  bankMode?: 'hosts' | 'resources',
): { at: Coord; type: BuildingType; region?: number }[] {
  return Object.keys(board).flatMap((key) => {
    const [x, y] = key.split(',').map(Number) as [number, number];
    const at = { x, y };
    const type = BUILDING_FOR_TERRAIN[tileAt(board, at)!.terrain];
    if (!type) return [];
    if (bankMode === 'resources') {
      return dryRegions(board, at).filter((region) => canBuildHarvester(
        board, buildings, leader, at, type, bankMode, region.region,
      ) === null).map((region) => ({ at, type, region: region.region }));
    }
    return canBuildHarvester(board, buildings, leader, at, type) === null ? [{ at, type }] : [];
  });
}

/**
 * Whether a Leader may raise a Tower here. GDD §16: at most one Tower may
 * defend a connected terrain feature, and GDD §3 allows one structure per tile.
 * Unlike harvesters, a Tower does not care what the terrain is.
 */
export function canBuildTower(
  board: Board,
  buildings: Buildings,
  leader: LeaderState,
  at: Coord,
): BuildRejection | 'featureAlreadyDefended' | null {
  if (!tileAt(board, at)) return 'noTile';
  if (buildingAt(buildings, at)) return 'tileOccupiedByBuilding';

  const defended = buildingsInFeature(board, buildings, at).some(
    ({ building }) => building.type === TOWER,
  );
  if (defended) return 'featureAlreadyDefended';

  if (!canAfford(leader, TOWER_COST)) return 'cannotAfford';
  return null;
}

/** Every square where this Leader could raise a Tower right now. */
export function getLegalTowerSites(
  board: Board,
  buildings: Buildings,
  leader: LeaderState,
): Coord[] {
  return Object.keys(board)
    .map((key) => {
      const [x, y] = key.split(',').map(Number) as [number, number];
      return { x, y };
    })
    .filter((at) => canBuildTower(board, buildings, leader, at) === null);
}

/**
 * Whether a Leader may raise a Monument here.
 *
 * One per connected feature, like a Tower, so the number a Leader can build
 * scales with the map rather than running out — which is the whole point, since
 * a Monument exists to give a mature economy somewhere to spend. Unlike a
 * Tower, a Monument of a *different* owner does not block yours: two rivals may
 * each raise one in the same feature and compete on Prestige there.
 */
export function canBuildMonument(
  board: Board,
  buildings: Buildings,
  leader: LeaderState,
  at: Coord,
  cost: Partial<Record<ResourceType, number>>,
): BuildRejection | 'featureAlreadyMonumented' | null {
  if (!tileAt(board, at)) return 'noTile';
  if (buildingAt(buildings, at)) return 'tileOccupiedByBuilding';

  const mine = buildingsInFeature(board, buildings, at).some(
    ({ building }) => building.type === MONUMENT && building.owner === leader.id,
  );
  if (mine) return 'featureAlreadyMonumented';

  if (!canAfford(leader, cost)) return 'cannotAfford';
  return null;
}

/** Every square where this Leader could raise a Monument right now. */
export function getLegalMonumentSites(
  board: Board,
  buildings: Buildings,
  leader: LeaderState,
  cost: Partial<Record<ResourceType, number>>,
): Coord[] {
  return Object.keys(board)
    .map((key) => {
      const [x, y] = key.split(',').map(Number) as [number, number];
      return { x, y };
    })
    .filter((at) => canBuildMonument(board, buildings, leader, at, cost) === null);
}

export { BUILDINGS, BUILDING_FOR_TERRAIN, MONUMENT, TOWER };
export type { BuildingType };
