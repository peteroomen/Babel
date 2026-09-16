import { TERRAIN_WEIGHTS, type ResourceType, type TerrainType } from './terrain.js';

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
   * How many resource cards a Barter discards. GDD §8 says three.
   *
   * The cheaper lever on Barter frequency than changing what it accepts: the
   * model shows three quarters of all Barters are a Leader converting into
   * Brick for Babel, and a fourth card taxes that directly.
   */
  readonly barterCost: number;
  /**
   * What each Army die costs to roll. `null` in canon, where Attack is free.
   *
   * Free Attack is the reason a Leader can rationally never invest: Muster,
   * Towers and Schemes all need Metal, the scarcest resource on the board,
   * while swinging costs nothing. A price per die makes the Army something you
   * feed rather than something you simply have.
   *
   * Which resource matters more than the amount. Food is what Babel is built
   * from, so charging dice in Food puts survival and the win condition in
   * direct competition for the same scarce thing — and in the moment survival
   * always wins, so the Tower never goes up. Wood is the resource every Leader
   * ends the game drowning in.
   *
   * A Leader chooses how many dice to commit, up to their Army and their purse,
   * and cannot Attack at all without enough for one.
   */
  readonly attackDieCost: {
    readonly resource: ResourceType;
    readonly amount: number;
    /**
     * Charge once per Attack rather than once per die.
     *
     * A per-die price turns out to be the wrong shape whatever resource it is
     * charged in: Attack is taken on roughly two turns in five with two to four
     * dice, so per-die roughly doubles what a Leader spends across the game and
     * the table starves. A flat price still makes Attack cost something without
     * scaling with the Army a Leader has been encouraged to build.
     */
    readonly flat?: boolean;
  } | null;
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

/** Canon v0.1: mixed Barter at three cards, free Attack, no Reserve, no Lake. */
export const CANON_RULES: RuleSet = {
  barterMode: 'mixed',
  barterCost: 3,
  attackDieCost: null,
  reserveSlots: 0,
  terrainWeights: TERRAIN_WEIGHTS,
};

/** At most this many Reserve slots. A guard, not a design statement. */
export const MAX_RESERVE_SLOTS = 4;
