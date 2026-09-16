import { TERRAIN_WEIGHTS, type TerrainType } from './terrain.js';

/**
 * Rules that are under experiment rather than settled.
 *
 * IMPLEMENTATION_PLAN.md Milestone 6 proposes changes to resource agency and
 * asks for them to be harnessed rather than chosen by feel. A variant is
 * therefore configuration carried by the game state, not a fork of the rules:
 * `setupGame` takes a RuleSet, the state keeps it, and a replay from seed plus
 * command log reproduces exactly the variant it was recorded under.
 *
 * Everything here is TUNEABLE in the GDD's sense. `CANON_RULES` is canon v0.1
 * and is what the game uses unless a caller asks for something else.
 */

/**
 * How Barter converts resources.
 *
 * - `mixed` — canon v0.1, GDD §8: any three resource cards in any combination.
 * - `sameKind` — Milestone 6 candidate: exactly three of the *same* resource.
 *   Keeps Barter as an escape valve for a surplus stack while stopping it
 *   being the primary way to obtain a precise resource.
 */
export type BarterMode = 'mixed' | 'sameKind';

export type RuleSet = {
  readonly barterMode: BarterMode;
  /**
   * Face-up communal tiles beside the bag that a Leader may swap their blind
   * draw for, free and outside their action. 0 disables the Reserve entirely.
   */
  readonly reserveSlots: number;
  /**
   * Terrain draw weights. Carried here rather than read from the module so the
   * Lake question (§22: "Lake frequency has not yet been modelled") can be
   * harnessed as explicit, comparable numbers across variants.
   */
  readonly terrainWeights: Readonly<Record<TerrainType, number>>;
};

/** Canon v0.1: mixed Barter, no Reserve, Lake at weight 0. */
export const CANON_RULES: RuleSet = {
  barterMode: 'mixed',
  reserveSlots: 0,
  terrainWeights: TERRAIN_WEIGHTS,
};

/** At most this many Reserve slots. A guard, not a design statement. */
export const MAX_RESERVE_SLOTS = 4;
