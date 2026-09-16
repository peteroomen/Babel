import { TERRAIN_WEIGHTS, type ResourceType, type TerrainType } from './terrain.js';
import { BABEL_PIECE_COST, type Stage } from './babel.js';
import { MONUMENT_COST, MONUMENT_PRESTIGE } from './buildings.js';
import { RIVER_WEIGHTS, type RiverShape } from './rivers.js';

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
   * What one Babel piece costs, by Stage.
   *
   * The model shows three quarters of all Barters are a Leader converting into
   * Brick, which makes this curve — not Barter's own rules — the thing actually
   * driving Barter frequency. Brick comes only from Hills, and canon asks for
   * 2, 4 and 6 of it.
   */
  readonly babelPieceCost: Record<Stage, Partial<Record<ResourceType, number>>>;
  /**
   * River geometry frequency, per terrain.
   *
   * The lever on a measured failure: 37% of rivers end up a single tile and 35%
   * of river edges point at empty ground, because a placed river tile has about
   * two river edges and each one *demands* another river tile at a square that
   * only 14% of draws can fill. Raising the share of one-edge shapes — sources,
   * which cap an end as readily as they start one — lets those squares close.
   */
  readonly riverWeights: Record<string, Record<RiverShape, number>>;
  /**
   * Terrain a Heavenly Host cannot cross. GDD §7 gives Lake; a river on a tile
   * blocks it regardless of terrain.
   *
   * Adding Desert here turns 14% of the board from a tile that does nothing
   * into a defensive choice — and gives the Reserve swap something to be for,
   * since swapping in a Desert stops being a non-move.
   */
  readonly impassableTerrain: readonly string[];
  /**
   * A river tile must connect to river already on the board.
   *
   * Eliminates the isolated single-tile river outright. Costs discards: a river
   * tile with nowhere to connect is redrawn under RD-002.
   */
  readonly riverMustExtend: boolean;
  /** The personal Prestige sink, or null for canon where none exists. */
  readonly monument: {
    readonly cost: Partial<Record<ResourceType, number>>;
    readonly prestige: number;
  } | null;
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
  babelPieceCost: BABEL_PIECE_COST,
  riverWeights: RIVER_WEIGHTS,
  impassableTerrain: ['lake'],
  riverMustExtend: false,
  monument: null,
  reserveSlots: 0,
  terrainWeights: TERRAIN_WEIGHTS,
};

/** At most this many Reserve slots. A guard, not a design statement. */
export const MAX_RESERVE_SLOTS = 4;

/**
 * An alternative Babel cost curve where every Stage wants three resources.
 *
 * Same total per piece as canon — 3, 5 and 8 — but spread, so a Leader's income
 * is useful to Babel whatever terrain they are sitting on instead of everyone
 * competing for the one terrain that yields Brick. It also gives Metal a sink,
 * which canon never does.
 */
export const BROAD_PIECE_COST: RuleSet['babelPieceCost'] = {
  1: { brick: 1, wood: 1, food: 1 },
  2: { brick: 2, wood: 2, metal: 1 },
  3: { brick: 3, wood: 2, metal: 2, food: 1 },
};

/**
 * River weights with enough one-edge shapes to cap a river end.
 *
 * `source` touches a single edge, so it works as a mouth as readily as a
 * spring: placed against a floating end it closes the river instead of
 * extending the demand. Canon has sources only on Mountain at 10%, which is far
 * too few to close the ends that straights, bends and tees keep opening.
 */
export const TERMINATOR_RIVER_WEIGHTS: RuleSet['riverWeights'] = {
  /* The total share of tiles carrying river is held at canon's 23%. Only the
     *mix* moves: roughly half the river tiles are now one-edge caps.

     Getting this wrong the first time is instructive. Raising the source share
     while also raising the total river share (77 -> 70 none) made rivers more
     numerous and *shorter* — mean chain fell from 2.73 to 2.24 — because two
     sources facing each other is a two-tile puddle, not a river, and the extra
     straights and bends opened as many demands as the caps closed. */
  farmland: { none: 77, straight: 5, bend: 5, tee: 2, source: 11 },
  forest: { none: 77, straight: 5, bend: 5, tee: 2, source: 11 },
  hills: { none: 100, straight: 0, bend: 0, tee: 0, source: 0 },
  mountain: { none: 90, straight: 0, bend: 0, tee: 0, source: 10 },
  desert: { none: 100, straight: 0, bend: 0, tee: 0, source: 0 },
  lake: { none: 100, straight: 0, bend: 0, tee: 0, source: 0 },
};

/** The Monument as modelled: a broad bundle for 3 Prestige. */
export const MONUMENT_RULE: RuleSet['monument'] = {
  cost: MONUMENT_COST,
  prestige: MONUMENT_PRESTIGE,
};
