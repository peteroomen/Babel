import type { ResourceType, TerrainType } from './terrain.js';

/**
 * Harvesting buildings. GDD §9.
 *
 * Each sits on one terrain type and pays that terrain's resource when another
 * Leader expands the connected feature it stands in.
 */
export const BUILDING_TYPES = ['sawmill', 'farmstead', 'brickworks', 'mine'] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

/** Towers are defensive rather than harvesting. GDD §16. Built in Milestone 4. */
export const TOWER = 'tower' as const;

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
