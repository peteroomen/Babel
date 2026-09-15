/**
 * Terrain and the resources it yields. GDD §3 (Board layers), §6 (payout).
 */
export const TERRAIN_TYPES = [
  'farmland',
  'forest',
  'hills',
  'mountain',
  'desert',
  'lake',
] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];

export const RESOURCE_TYPES = ['food', 'wood', 'brick', 'metal'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** GDD §3. Desert and Lake yield nothing. */
export const TERRAIN_RESOURCE: Record<TerrainType, ResourceType | null> = {
  farmland: 'food',
  forest: 'wood',
  hills: 'brick',
  mountain: 'metal',
  desert: null,
  lake: null,
};

/**
 * Draw weights. GDD §22 gives these as percentages of a bag drawn *with
 * replacement* — a finite terrain deck is explicitly not a loss condition.
 *
 * Lake is specified as a terrain type (§3, §7) but §22 gives it no frequency
 * ("Lake frequency has not yet been modelled") and the five listed percentages
 * already sum to 100. It is therefore defined here at weight 0: present in the
 * type system and renderable, but never drawn until it is tuned.
 */
export const TERRAIN_WEIGHTS: Record<TerrainType, number> = {
  farmland: 24,
  forest: 24,
  hills: 22,
  mountain: 16,
  desert: 14,
  lake: 0,
};
