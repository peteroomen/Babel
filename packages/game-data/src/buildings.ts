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

/**
 * A Monument: Prestige for its owner and nothing else.
 *
 * The counterweight to Babel. Babel is shared — it is how humanity survives —
 * and a Monument is purely yours. It costs a broad bundle rather than a deep
 * one, so the whole economy feeds it, which is what gives a mature Leader
 * something to want other than the one resource Babel happens to need.
 */
export const MONUMENT = 'monument' as const;
export type MonumentType = typeof MONUMENT;

/** Anything a player can own on a tile. One structure per land tile (GDD §3). */
export type StructureType = BuildingType | TowerType | MonumentType;

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

/**
 * Milestone 6: a personal Prestige sink, one per connected feature like a
 * Tower, so the number a Leader can build scales with the map rather than
 * running out. TUNEABLE.
 */
export const MONUMENT_COST = { food: 2, wood: 2, brick: 2, metal: 2 } as const;
export const MONUMENT_PRESTIGE = 3;

/** GDD §17: one Build action spends 1 Wood and places two Wall segments. */
export const WALL_COST = { wood: 1 } as const;
export const WALL_SEGMENTS = 2;
export const WALL_PRESTIGE = 1;

/** Narrow a structure to a harvesting building. Towers and Monuments never harvest. */
export const isHarvester = (type: StructureType): type is BuildingType =>
  type !== TOWER && type !== MONUMENT;

/** What a structure costs to build. GDD §9, §16, and the Monument candidate. */
export const structureCost = (
  type: StructureType,
): Partial<Record<ResourceType, number>> =>
  type === TOWER ? TOWER_COST : type === MONUMENT ? MONUMENT_COST : BUILDINGS[type].cost;
