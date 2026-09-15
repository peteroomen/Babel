import type { ResourceType, TerrainType } from './terrain.js';

/**
 * Harvesting buildings. GDD §9.
 *
 * Each sits on one terrain type and pays that terrain's resource when another
 * Leader expands the connected feature it stands in.
 */
export const BUILDING_TYPES = ['sawmill', 'farmstead', 'brickworks', 'mine'] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

/** Towers are defensive rather than harvesting. GDD §16. */
export const TOWER = 'tower' as const;
export type TowerType = typeof TOWER;

/** Anything a player can own on a tile. One structure per land tile (GDD §3). */
export type StructureType = BuildingType | TowerType;

export type BuildingSpec = {
  readonly terrain: TerrainType;
  readonly resource: ResourceType;
  /** TUNEABLE per GDD §9. */
  readonly cost: Partial<Record<ResourceType, number>>;
  readonly label: string;
};

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
  sawmill: { terrain: 'forest', resource: 'wood', cost: { wood: 2 }, label: 'Sawmill' },
  farmstead: {
    terrain: 'farmland',
    resource: 'food',
    cost: { wood: 1, food: 1 },
    label: 'Farmstead',
  },
  brickworks: {
    terrain: 'hills',
    resource: 'brick',
    cost: { wood: 1, brick: 1 },
    label: 'Brickworks',
  },
  mine: { terrain: 'mountain', resource: 'metal', cost: { wood: 1, metal: 1 }, label: 'Mine' },
};

/** The harvesting building a given terrain accepts, if any. */
export const BUILDING_FOR_TERRAIN: Partial<Record<TerrainType, BuildingType>> = {
  forest: 'sawmill',
  farmland: 'farmstead',
  hills: 'brickworks',
  mountain: 'mine',
};

/** GDD §9: constructing a harvesting building gives +1 Prestige. */
export const BUILDING_PRESTIGE = 1;

/**
 * Defensive structures. GDD §16 and §17.
 *
 * A Tower does not fire during Heaven's turn: it contributes a targeted support
 * die when any player takes an Attack action, which is what keeps action
 * scarcity intact while still rewarding prepared ground.
 */
export const TOWER_COST = { wood: 2, metal: 1 } as const;
export const TOWER_PRESTIGE = 1;

/** GDD §17: one Build action spends 1 Wood and places two Wall segments. */
export const WALL_COST = { wood: 1 } as const;
export const WALL_SEGMENTS = 2;
export const WALL_PRESTIGE = 1;

/** Narrow a structure to a harvesting building. Towers never harvest. */
export const isHarvester = (type: StructureType): type is BuildingType =>
  type !== TOWER;

/** What a structure costs to build. GDD §9 and §16. */
export const structureCost = (
  type: StructureType,
): Partial<Record<ResourceType, number>> =>
  type === TOWER ? TOWER_COST : BUILDINGS[type].cost;
