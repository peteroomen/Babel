import type { TerrainType } from './terrain.js';

/**
 * River geometry. GDD §7 lists straight, bend, T-junction, Mountain source and
 * Lake terminator as the base shapes.
 *
 * Shapes are defined in a base orientation and rotated at placement time, so
 * one shape covers all four of its rotations.
 */
export const RIVER_SHAPES = ['none', 'straight', 'bend', 'tee', 'source'] as const;
export type RiverShape = (typeof RIVER_SHAPES)[number];

/**
 * Which edges carry river in the base orientation, before rotation.
 * A `source` touches one edge: the river begins on this tile and flows off it.
 */
export const RIVER_SHAPE_EDGES: Record<RiverShape, readonly ('n' | 'e' | 's' | 'w')[]> = {
  none: [],
  straight: ['n', 's'],
  bend: ['n', 'e'],
  tee: ['n', 'e', 'w'],
  source: ['n'],
};

/**
 * Per-terrain river frequency. GDD §22 fixes the totals: about 23% of
 * Farmland/Forest tiles carry river geometry, and about 10% of Mountains are
 * sources. GDD §7 adds that river variants appear primarily on Farmland and
 * Forest, and that some Mountains are sources.
 *
 * The *split* between straight / bend / tee inside that 23% is not specified
 * anywhere in canon. The 9 / 9 / 5 below is authored to spec per RD-003 and is
 * TUNEABLE: straights and bends are equally common, and the T-junction is the
 * rarer piece because it constrains three of its four edges and is therefore
 * the hardest to place legally.
 */
export const RIVER_WEIGHTS: Record<TerrainType, Record<RiverShape, number>> = {
  farmland: { none: 77, straight: 9, bend: 9, tee: 5, source: 0 },
  forest: { none: 77, straight: 9, bend: 9, tee: 5, source: 0 },
  hills: { none: 100, straight: 0, bend: 0, tee: 0, source: 0 },
  mountain: { none: 90, straight: 0, bend: 0, tee: 0, source: 10 },
  desert: { none: 100, straight: 0, bend: 0, tee: 0, source: 0 },
  lake: { none: 100, straight: 0, bend: 0, tee: 0, source: 0 },
};
