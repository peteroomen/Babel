import { TERRAIN_WEIGHTS, type ResourceType, type TerrainType } from './terrain.js';
import { BABEL_PIECE_COST, type Stage } from './babel.js';
import {
  MONUMENT_COST,
  MONUMENT_PRESTIGE,
  WALL_COST,
  WALL_PRESTIGE,
  WALL_SEGMENTS,
} from './buildings.js';
import {
  ARRIVALS_BY_STAGE,
  BEACON_TIERS,
  COMBAT_DIE_BONUS,
  DEEP_BEACON_TIERS,
  SPAWN_TABLE,
  type BeaconTier,
  type SpawnEntry,
} from './heaven.js';
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
  /**
   * Barter does not consume the turn's action.
   *
   * The sharpest lever on the pile, because same-kind Barter is already an
   * incinerator: four cards in, one out, three destroyed. It is simply gated
   * behind the scarcest thing a Leader has, which is the action — and the
   * measured problem is that a Leader earns every turn and acts once. Free, it
   * runs every turn instead of occasionally. One per turn, so it cannot loop.
   */
  readonly barterIsFree: boolean;
  /**
   * How many Babel pieces one Build action may add.
   *
   * The other way at action scarcity: rather than giving a Leader more actions,
   * let one action consume proportionally more. A Leader sitting on a pile can
   * turn it into Tower in a single turn instead of dribbling it in over six.
   */
  readonly babelPiecesPerAction: number;
  /**
   * Food per Army die, paid every Heaven Phase. 0 for no upkeep.
   *
   * Muster is a one-off today — the Army is bought once and never costs
   * anything again — which is why Food is the resource least spent. Upkeep
   * turns a standing Army into a recurring bill, and Food is the thing there is
   * most of. A Leader that cannot pay loses a die.
   */
  readonly armyUpkeepFood: number;
  /**
   * Most of any single resource a Leader may hold at the end of their turn;
   * the excess spoils. null for no limit.
   *
   * Blunt, and included mainly as a control: it puts a ceiling on how much of
   * the pile is reachable at all, which tells us how much the gentler levers
   * are leaving on the table.
   */
  readonly resourceCap: number | null;
  /**
   * What each Beacon sends, by the order it was sited, or null for the uniform
   * spawn the GDD describes.
   *
   * The first Beacon keeps sending the Hosts the table already knows how to
   * fight; later ones open problems that the current answers do not cover — an
   * armoured Host that needs two hits and a better roll, and a flier that
   * ignores the rivers the whole defensive map is built on.
   */
  readonly beaconTiers: readonly BeaconTier[] | null;
  /**
   * What Heaven sends and how much of it, or null for GDD §13's one Host per
   * Beacon per round.
   *
   * `table` is rolled once per arrival and `arrivals` says how many arrive,
   * both keyed on Babel's Stage. Location still comes from the Beacons, which
   * players site — that part of §13 is the interesting decision and stays.
   */
  readonly heavenSpawn: {
    readonly table: Record<Stage, readonly SpawnEntry[]>;
    readonly arrivals: readonly [number, number, number];
    /** Optional repeating per-Phase arrival cycles for cadence experiments. */
    readonly cadenceByStage?: readonly [readonly number[], readonly number[], readonly number[]];
  } | null;
  /**
   * Added to every Host's Defence, by Stage.
   *
   * Per-Stage because a flat +1 is a cliff rather than a knob: Stage III already
   * asks for d6+2 against 7, so one more point takes a die from a third to a
   * sixth and the table simply cannot keep up.
   */
  readonly hostDefenceBonus: readonly [number, number, number];
  /** Extra Beacons beyond the scaling table, from the first Beacon onward. */
  readonly beaconBonus: number;
  /** GDD §15: each combat die is d6 plus this. Lower is harder. */
  readonly combatDieBonus: number;
  /** Babel pieces per Stage, or null to use the player-count scaling table. */
  readonly piecesPerStage: number | null;
  /**
   * Buying extra Attack dice with resources.
   *
   * The one shape of defensive spending that fits a combat system with no
   * range: dice are the only currency, so the pile buys more of them. Optional,
   * never a tax — the Attack-cost experiments showed that pricing what a table
   * must do every round starves it.
   */
  readonly munitions: {
    readonly cost: Partial<Record<ResourceType, number>>;
    readonly maxExtraDice: number;
  } | null;
  /**
   * Prestige for lengthening the river that feeds Babel.
   *
   * The river is currently pure geography: it shapes where Heaven can walk and
   * nothing else, so a Leader placing a river tile is either defending or
   * ignoring it. Paying Prestige for extending *Babel's own* river puts a
   * second, selfish reason on the same decision, and the two reasons do not
   * always point at the same square — which is the point. A Leader who takes
   * the river square gives up the payout the other square would have paid.
   *
   * `requireReach` decides what "longer" means. Without it any tile that joins
   * the Babel river scores, so a Leader can farm the same delta by thickening
   * it locally. With it, only a placement that pushes the river's furthest
   * point further from Babel scores, which is the rule as it reads aloud.
   *
   * `cap` bounds the whole strategy per Leader, since the supply of river tiles
   * is not bounded by anything else.
   */
  readonly riverPrestige: {
    readonly perTile: number;
    readonly requireReach: boolean;
    readonly cap: number | null;
    /**
     * Pay only when the river's reach crosses a multiple of this, instead of
     * paying for every extension. null for per-tile.
     *
     * The sharper shape of the same idea, and the one that actually creates a
     * decision: a milestone can only be claimed once and by one Leader, so the
     * tile that takes the river from four to five is worth fighting over in a
     * way that the fourth tile of an open-ended stipend never is. A placement
     * that drags a whole disconnected chain in can cross several at once, and
     * is paid for all of them.
     */
    readonly milestone: number | null;
  } | null;
  /**
   * The Wall action, or null to remove Walls from the game.
   *
   * Included as a lever rather than a constant because the question asked of
   * Walls is whether they earn their place at all: a subsystem that changes no
   * measurable thing when deleted is costing rules text for nothing.
   */
  readonly walls: {
    readonly cost: Partial<Record<ResourceType, number>>;
    readonly segments: number;
    readonly prestige: number;
  } | null;
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

/**
 * The Babel cost curve as of v0.2: every Stage wants three resources.
 *
 * Same total per piece as v0.1 — 3, 5 and 8 — but spread, so a Leader's income
 * is useful to Babel whatever terrain they are sitting on instead of everyone
 * competing for the one terrain that yields Brick. It also gives Metal a sink,
 * which v0.1 never did.
 */
export const BROAD_PIECE_COST: Record<Stage, Partial<Record<ResourceType, number>>> = {
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

/** Walls exactly as GDD §17 prints them: 1 Wood, two segments, 1 Prestige. */
export const CANON_WALLS: RuleSet['walls'] = {
  cost: WALL_COST,
  segments: WALL_SEGMENTS,
  prestige: WALL_PRESTIGE,
};

/**
 * Canon v0.1, frozen.
 *
 * Kept so the harness can always show the delta against the baseline every
 * earlier round of modelling was measured from. Nothing plays under it by
 * default any more.
 */
export const LEGACY_V01_RULES: RuleSet = {
  barterMode: 'mixed',
  barterCost: 3,
  attackDieCost: null,
  babelPieceCost: BABEL_PIECE_COST,
  riverWeights: RIVER_WEIGHTS,
  impassableTerrain: ['lake'],
  riverMustExtend: false,
  beaconTiers: null,
  heavenSpawn: null,
  hostDefenceBonus: [0, 0, 0],
  beaconBonus: 0,
  combatDieBonus: COMBAT_DIE_BONUS,
  piecesPerStage: null,
  munitions: null,
  barterIsFree: false,
  babelPiecesPerAction: 1,
  armyUpkeepFood: 0,
  resourceCap: null,
  monument: null,
  riverPrestige: null,
  walls: CANON_WALLS,
  reserveSlots: 0,
  terrainWeights: TERRAIN_WEIGHTS,
};

/**
 * Canon v0.2 — the first pass of Milestone 6, kept for comparison.
 */
export const V02_RULES: RuleSet = {
  ...LEGACY_V01_RULES,
  barterMode: 'sameKind',
  barterCost: 4,
  babelPieceCost: BROAD_PIECE_COST,
};

/**
 * Canon v0.3 — what the game plays under now.
 *
 * On top of v0.2's broad Babel curve and same-kind Barter at four:
 *
 * - **Barter no longer costs the action.** Same-kind Barter at four destroys
 *   three resources every time it runs, so it was already the best sink in the
 *   game — it was just gated behind the only thing a Leader is short of. Free,
 *   it runs three times as often and the share of everything earned that is
 *   never spent falls from about a half to under a third.
 * - **Heaven is rolled from a table rather than spawning one Host per Beacon.**
 *   A d6 keyed to Babel's Stage says what arrives, the open Beacons say where,
 *   and a printed number per Stage says how many. That decouples the amount of
 *   Heaven from the player count, and lets Stage II and III introduce Hosts
 *   that the table's existing answers do not cover.
 *
 * Together: 67% shared wins over 30 games at 1.61 arrivals a round, against
 * 92% and 2.03 for v0.2. Fewer Hosts on the board and a game you can lose.
 *
 * Kept frozen, like v0.1 and v0.2, so round seven's two changes can always be
 * measured against the game they were proposed for.
 */
export const V03_RULES: RuleSet = {
  ...V02_RULES,
  barterIsFree: true,
  heavenSpawn: { table: SPAWN_TABLE, arrivals: ARRIVALS_BY_STAGE },
};

/**
 * Canon v0.4 — what the game plays under now.
 *
 * Round seven asked two questions about the same thing, which is what the
 * terrain is *for*, and answered both. See `docs/ROUND7_RIVER_AND_WALLS.md`.
 *
 * - **Babel's river pays Prestige.** GDD §5 runs a river into the Foundation
 *   and then gives nobody a reason to continue it, so under v0.3 that river
 *   ends a whole game 2.6 tiles long. Paying the Leader who carries it further
 *   upstream takes it to 6.4, for 2.4% of the Prestige on the table — about 1.8
 *   points a Leader in a game they score 60 to 80 in. The reward is small on
 *   purpose: the interesting part is that water is ground Heaven cannot walk,
 *   so a Leader extending the river is digging a moat as well as scoring.
 * - **Walls are gone.** A Wall bought one Host-move of delay, once, if a Host
 *   walked that exact edge — and never changed where Heaven walked, so it had
 *   to be that edge. At the standard table deleting them moved nothing outside
 *   noise. At a table with a wall-builder in it they were worse than inert:
 *   47.5% shared wins against 81.7% without, while paying the wall-builder 95.8
 *   Prestige for a game humanity lost. Walls and rivers are the same idea, and
 *   the river does it better — permanent, free, on a tile you were placing
 *   anyway, and now scoring.
 *
 * The rule the Wall *machinery* still serves is a variant: `walls: CANON_WALLS`
 * puts them back, which is what keeps the comparison above re-runnable.
 *
 * **v0.4 against v0.3, 160 paired seeds** (`npm run model -- --canon --paired`):
 * 76.9% shared wins against 75.6%, 38.9 rounds against 41.6, Babel's river 6.0
 * tiles against 2.6. The difficulty drift each change showed on its own does not
 * survive putting them together, because they pull opposite ways: the river
 * makes the ground harder for Heaven, and the Walls that went with it were the
 * other thing slowing Heaven down. Net, v0.4 is the same game three rounds
 * shorter, with a river in it.
 */
export const CANON_RULES: RuleSet = {
  ...V03_RULES,
  riverPrestige: { perTile: 1, requireReach: true, cap: null, milestone: null },
  walls: null,
};

/** At most this many Reserve slots. A guard, not a design statement. */
export const MAX_RESERVE_SLOTS = 4;

/** The Monument as modelled: a broad bundle for 3 Prestige. */
export const MONUMENT_RULE: RuleSet['monument'] = {
  cost: MONUMENT_COST,
  prestige: MONUMENT_PRESTIGE,
};

/**
 * A Babel curve that leans on Food.
 *
 * Food is the resource least spent under v0.2 — 57% of it is never used, and
 * nothing outside Muster, a Scheme and a point or two per piece asks for any.
 * Same totals per piece as v0.2 (3, 5, 8); only the mix moves toward Food.
 */
export const HUNGRY_PIECE_COST: Record<Stage, Partial<Record<ResourceType, number>>> = {
  1: { brick: 1, food: 2 },
  2: { brick: 2, wood: 1, food: 2 },
  3: { brick: 2, wood: 2, metal: 1, food: 3 },
};

/** Heaven with three kinds of gate, as modelled. */
export const TIERED_BEACONS = BEACON_TIERS;

/** Heaven with the harder roster: Herald, Colossus, Swarm, Warded. */
export const DEEP_BEACONS = DEEP_BEACON_TIERS;

/** The d6 spawn table at its default rate — what canon v0.3 plays. */
export const ROLLED_HEAVEN: RuleSet['heavenSpawn'] = CANON_RULES.heavenSpawn;

/** Two of one resource buys one more Attack die, up to three. */
export const MUNITIONS_RULE: RuleSet['munitions'] = {
  cost: { metal: 1, wood: 1 },
  maxExtraDice: 3,
};
