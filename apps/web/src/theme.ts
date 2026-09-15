import type { TerrainType } from '@babel-game/game-data';

/**
 * ART_DIRECTION.md: at gameplay scale, terrain identity beats illustration
 * detail. These are flat, high-contrast fills chosen to stay distinguishable
 * when buildings, Walls, Beacons and Hosts start sitting on top of them.
 */
export const TERRAIN_FILL: Record<TerrainType, string> = {
  farmland: '#e3bc5f',
  forest: '#5f8f4e',
  hills: '#c07850',
  mountain: '#8d939c',
  desert: '#ecdcb4',
  lake: '#6aa9d6',
};

export const TERRAIN_LABEL: Record<TerrainType, string> = {
  farmland: 'Farmland',
  forest: 'Forest',
  hills: 'Hills',
  mountain: 'Mountain',
  desert: 'Desert',
  lake: 'Lake',
};

export const RESOURCE_LABEL = {
  food: 'Food',
  wood: 'Wood',
  brick: 'Brick',
  metal: 'Metal',
} as const;

/** ART_DIRECTION.md: rivers read as a strong continuous graphic line. */
export const RIVER_STROKE = '#2f7fb0';
export const INK = '#2b2622';
