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

/**
 * Painted tile art, served from public/tiles. The flat TERRAIN_FILL colours
 * above stay as the fallback painted underneath, so the board still reads
 * correctly if an image has not loaded yet.
 */
export const TERRAIN_IMAGE: Record<TerrainType, string> = {
  farmland: '/tiles/farmland.webp',
  forest: '/tiles/forest.webp',
  hills: '/tiles/hills.webp',
  mountain: '/tiles/mountain.webp',
  desert: '/tiles/desert.webp',
  lake: '/tiles/lake.webp',
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

/** One colour per seat, used for building ownership on the board. */
export const LEADER_COLOUR = ['#b5452f', '#2f6fb5', '#6a8f2f', '#8a4fb5'] as const;

/**
 * ART_DIRECTION.md: buildings must sit clearly on top of terrain rather than
 * becoming terrain, so each is a chunky owner-coloured badge with an initial.
 */
export const BUILDING_GLYPH = {
  sawmill: 'S',
  farmstead: 'F',
  brickworks: 'B',
  mine: 'M',
  tower: 'T',
  monument: 'M',
} as const;

export const BUILDING_LABEL = {
  sawmill: 'Sawmill',
  farmstead: 'Farmstead',
  brickworks: 'Brickworks',
  mine: 'Mine',
  tower: 'Tower',
  monument: 'Monument',
} as const;

/** ART_DIRECTION.md: Walls look temporary — a palisade, not castle masonry. */
export const WALL_STROKE = '#6b4a2f';

/** ART_DIRECTION.md: bright gold and ivory divine ornament. */
export const HEAVEN_GOLD = '#d9a441';
export const HEAVEN_IVORY = '#fff6e0';
export const SERAPH_CORE = '#ffd9a0';
export const BEACON_LIGHT = '#f0c860';

export const HOST_LABEL = {
  ophanim: 'Ophanim Host',
  seraph: 'Seraph',
  zealot: 'Zealot',
  flier: 'Throne',
  herald: 'Herald',
  colossus: 'Colossus',
  swarm: 'Swarm',
  warded: 'Warded',
} as const;
