import {
  BROAD_PIECE_COST,
  CANON_RULES,
  V04_RULES,
  CANON_WALLS,
  LEGACY_V01_RULES,
  MONUMENT_RULE,
  TERMINATOR_RIVER_WEIGHTS,
  TERRAIN_WEIGHTS,
  V03_RULES,
  type RuleSet,
} from '@babel-game/game-data';

/**
 * The variants IMPLEMENTATION_PLAN.md Milestone 6 asks to compare.
 *
 * `control` is canon v0.1 and is the line every other variant is read against.
 * Nothing here forks the rules: each is a RuleSet handed to `setupGame`.
 */
export type Variant = {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly rules: RuleSet;
};

const withRules = (id: string, label: string, note: string, rules: Partial<RuleSet>): Variant => ({
  id,
  label,
  note,
  rules: { ...CANON_RULES, ...rules },
});

export const VARIANTS: readonly Variant[] = [
  withRules('control', 'Control', 'Canon v0.6: the live rules', {}),
  { id: 'v01', label: 'v0.1', note: 'The pre-Milestone-6 baseline', rules: LEGACY_V01_RULES },
  withRules('same-kind', 'Same-kind Barter', 'Blind draw, 3 of one resource', {
    barterMode: 'sameKind',
  }),
  withRules('reserve1', 'Reserve 1 + same-kind', 'One face-up slot', {
    barterMode: 'sameKind',
    reserveSlots: 1,
  }),
  withRules('reserve2', 'Reserve 2 + same-kind', 'Two face-up slots', {
    barterMode: 'sameKind',
    reserveSlots: 2,
  }),
];

/**
 * Second round of candidates, run against the same control.
 *
 * Each moves one lever, so a difference can be attributed. `attack-food` is the
 * answer to the structural observation in the first baseline — Attack is free
 * while Metal gates every way of investing — and `barter-4` is the cheaper lever
 * on Barter frequency than changing what Barter accepts.
 */
export const LEVER_VARIANTS: readonly Variant[] = [
  withRules('control', 'Control', 'Canon v0.1', {}),
  withRules('attack-food', 'Attack: 1 Food/die', 'Dice cost Babel\'s own resource', {
    attackDieCost: { resource: 'food', amount: 1 },
  }),
  withRules('attack-wood', 'Attack: 1 Wood/die', 'Dice cost the surplus resource', {
    attackDieCost: { resource: 'wood', amount: 1 },
  }),
  withRules('attack-flat', 'Attack: 1 Food flat', 'Once per Attack, any Army size', {
    attackDieCost: { resource: 'food', amount: 1, flat: true },
  }),
  withRules('barter-4', 'Barter costs 4', 'Any 4 cards, not 3', { barterCost: 4 }),
  withRules('same-kind-4', 'Same-kind, 4 cards', 'Four of one resource', {
    barterMode: 'sameKind',
    barterCost: 4,
  }),
  withRules('combined', 'Flat Food + same-kind 4', 'Both levers, calibrated', {
    attackDieCost: { resource: 'food', amount: 1, flat: true },
    barterMode: 'sameKind',
    barterCost: 4,
  }),
];

/**
 * The one candidate the lever round put ahead of canon, for a longer run.
 *
 * +16 points on the win rate at n=25 is under two standard errors, so it needs
 * more seeds before it can become canon.
 */
export const CONFIRM_VARIANTS: readonly Variant[] = [
  withRules('control', 'Control', 'Canon v0.1', {}),
  withRules('same-kind-4', 'Same-kind, 4 cards', 'Four of one resource', {
    barterMode: 'sameKind',
    barterCost: 4,
  }),
];

/**
 * Babel cost curves.
 *
 * Three quarters of every Barter is a Leader converting into Brick for Babel,
 * so the cost curve is what is really driving Barter frequency. Canon asks for
 * Brick and Food only — 2, 4 and 6 Brick by Stage — and Brick comes from one
 * terrain.
 *
 * Every candidate below holds the *total* resources per piece at canon's 3, 5
 * and 8, so these test the mix rather than the price. They run on canon Barter
 * so the two changes do not confound.
 */
export const BABEL_VARIANTS: readonly Variant[] = [
  withRules('control', 'Control', 'Brick 2/4/6 + Food', {}),
  withRules('layered', 'Layered', 'Brick spine, one ally per Stage', {
    babelPieceCost: {
      /* Foundations of earth and straw; the ascent needs scaffolding; the
         siege needs iron. */
      1: { brick: 2, food: 1 },
      2: { brick: 3, wood: 2 },
      3: { brick: 4, metal: 3, food: 1 },
    },
  }),
  withRules('broad', 'Broad', 'Every Stage wants three resources', {
    babelPieceCost: BROAD_PIECE_COST,
  }),
  withRules('metal-spine', 'Metal spine', 'Brick early, Metal late', {
    babelPieceCost: {
      /* Brick held flat and Metal carrying the top of the Tower: the "instead
         of Brick" reading, and a hard test since Metal is the scarcest thing
         on the board. */
      1: { brick: 2, food: 1 },
      2: { brick: 2, wood: 3 },
      3: { brick: 2, metal: 4, food: 2 },
    },
  }),
];

/**
 * The two leading candidates, alone and together.
 *
 * Both beat canon on their own; whether they stack is a separate question,
 * since a game can be improved past the point of being interesting.
 */
export const STACK_VARIANTS: readonly Variant[] = [
  withRules('control', 'Control', 'Canon v0.1', {}),
  withRules('same-kind-4', 'Same-kind 4', 'Barter: four of one', {
    barterMode: 'sameKind',
    barterCost: 4,
  }),
  withRules('broad', 'Broad Babel', 'Every Stage wants three resources', {
    babelPieceCost: BROAD_PIECE_COST,
  }),
  withRules('both', 'Both', 'Broad Babel + same-kind 4', {
    barterMode: 'sameKind',
    barterCost: 4,
    babelPieceCost: BROAD_PIECE_COST,
  }),
];

/**
 * Round four: geography, and somewhere to spend.
 *
 * Terminators are treated as settled rather than as a candidate — 37% of rivers
 * came out one tile long and 22% of frontier squares were locked to a tile type
 * only 14% of draws supply, which is a defect, not a balance question. So every
 * variant past `control` carries them, and `terminators` measures what fixing
 * that alone is worth.
 */
const withTerminators = (
  id: string,
  label: string,
  note: string,
  rules: Partial<RuleSet>,
): Variant =>
  withRules(id, label, note, { riverWeights: TERMINATOR_RIVER_WEIGHTS, ...rules });

export const GEO_VARIANTS: readonly Variant[] = [
  withRules('control', 'Control', 'Canon v0.1', {}),
  withTerminators('terminators', 'Terminators', 'River ends can be capped', {}),
  withTerminators('desert-wall', 'Desert blocks', 'Hosts cannot cross Desert', {
    impassableTerrain: ['lake', 'desert'],
  }),
  withTerminators('desert-half', 'Desert halved', 'Desert 7%, no rule change', {
    terrainWeights: { ...TERRAIN_WEIGHTS, desert: 7, farmland: 27, forest: 27 },
  }),
  withTerminators('river-extend', 'Rivers must extend', 'A river tile must join water', {
    riverMustExtend: true,
  }),
];

/** Round four, part two: the personal Prestige sink. */
export const SINK_VARIANTS: readonly Variant[] = [
  withTerminators('terminators', 'Terminators only', 'The new baseline', {}),
  withTerminators('monument', 'Monument', '2 of each resource for 3 Prestige', {
    monument: MONUMENT_RULE,
  }),
  withTerminators('monument-desert', 'Monument + Desert blocks', 'Both round-four keepers', {
    monument: MONUMENT_RULE,
    impassableTerrain: ['lake', 'desert'],
  }),
];

/**
 * Lake candidates for the §22 open question, run separately: they move the
 * terrain distribution itself, so mixing them into the Barter/Reserve
 * comparison would confound two changes at once.
 *
 * Weight is taken off Desert, the other terrain that pays nothing, so the
 * yielding terrains keep their share of the bag and only the flavour of the
 * dead ground changes.
 */
export const LAKE_VARIANTS: readonly Variant[] = [0, 4, 8].map((lake) =>
  withRules(
    `lake${lake}`,
    `Lake ${lake}%`,
    lake === 0 ? 'Canon: Lake never drawn' : `Lake ${lake}, Desert ${14 - lake}`,
    {
      reserveSlots: 1,
      barterMode: 'sameKind',
      terrainWeights: { ...TERRAIN_WEIGHTS, lake, desert: 14 - lake },
    },
  ),
);

/**
 * Round seven, question one: does lengthening Babel's river deserve Prestige?
 *
 * The river is currently geography and nothing else — it decides where Heaven
 * can walk, and a Leader who is not being invaded has no reason to care which
 * way the water runs. Paying for it puts a second reason on the placement
 * decision, and the two reasons disagree often enough to be a choice.
 *
 * The arms separate the two readings of "longer". `any` pays for any tile that
 * joins Babel's water, which includes thickening it next to the Foundation;
 * `reach` pays only when the river's furthest point gets further away, which is
 * the rule as a person would say it aloud. The rest are the price.
 */
const fromV03 = (id: string, label: string, note: string, rules: Partial<RuleSet>): Variant => ({
  id,
  label,
  note,
  /* Pinned to v0.3 rather than to `CANON_RULES`, because these sets are the
     evidence for v0.4: read against the new canon they would be comparing two
     candidates to a control that already carries one of them. */
  rules: { ...V03_RULES, ...rules },
});

export const RIVER_VARIANTS: readonly Variant[] = [
  fromV03('control', 'Control', 'Canon v0.3: the river pays nothing', {}),
  fromV03('river-any', 'Any join, +1', 'Any tile joining Babel’s river', {
    riverPrestige: { perTile: 1, requireReach: false, cap: null, milestone: null },
  }),
  fromV03('river-reach', 'Reach, +1', 'Only when the river runs further', {
    riverPrestige: { perTile: 1, requireReach: true, cap: null, milestone: null },
  }),
  fromV03('river-reach-2', 'Reach, +2', 'The same rule at twice the price', {
    riverPrestige: { perTile: 2, requireReach: true, cap: null, milestone: null },
  }),
  fromV03('river-capped', 'Reach, +1, cap 8', 'Bounded per Leader', {
    riverPrestige: { perTile: 1, requireReach: true, cap: 8, milestone: null },
  }),
];

/**
 * Round seven, question two: do Walls earn their rules text?
 *
 * `no-walls` is the null hypothesis — delete the action and see whether any
 * number moves. `walls-4` and `walls-cheap` ask the other question first, which
 * is whether Walls are ignored because they are pointless or because they are
 * simply too weak to be worth an action: four segments per action, and the same
 * two segments for no Wood at all.
 */
export const WALL_VARIANTS: readonly Variant[] = [
  fromV03('control', 'Control', 'v0.3: 1 Wood, 2 segments', { walls: CANON_WALLS }),
  fromV03('no-walls', 'No Walls', 'The action is removed — v0.4', { walls: null }),
  fromV03('walls-4', 'Four segments', '1 Wood, 4 segments', {
    walls: { cost: { wood: 1 }, segments: 4, prestige: 1 },
  }),
  fromV03('walls-cheap', 'Free Walls', 'No Wood, 2 segments', {
    walls: { cost: {}, segments: 2, prestige: 1 },
  }),
];


/**
 * The two river arms worth more seeds, against the control.
 *
 * Forty games puts roughly seven points of standard error on a win rate, which
 * is wider than any difference the first river round produced except the one at
 * +2 Prestige. Run this paired (`--paired`), so the control and the candidates
 * share their opening boards instead of being compared across unrelated maps.
 */
export const RIVER_CONFIRM_VARIANTS: readonly Variant[] = [
  fromV03('control', 'Control', 'Canon v0.3: the river pays nothing', {}),
  fromV03('river-reach', 'Reach, +1', 'Only when the river runs further', {
    riverPrestige: { perTile: 1, requireReach: true, cap: null, milestone: null },
  }),
  fromV03('river-reach-2', 'Reach, +2', 'The same rule at twice the price', {
    riverPrestige: { perTile: 2, requireReach: true, cap: null, milestone: null },
  }),
];

/** Walls against no Walls, with enough seeds to believe the gap. */
export const WALL_CONFIRM_VARIANTS: readonly Variant[] = [
  fromV03('control', 'Control', 'v0.3: 1 Wood, 2 segments', { walls: CANON_WALLS }),
  fromV03('no-walls', 'No Walls', 'The action is removed — v0.4', { walls: null }),
];


/**
 * Round seven, question one again: a milestone instead of a stipend.
 *
 * Per-tile Prestige is income — everyone who draws a river tile takes a point,
 * and nobody competes for it. A milestone is claimed: only one Leader can be
 * the one who takes the river from five tiles to six, so the placement is worth
 * taking a worse square for, which is the wrinkle the whole idea was for.
 *
 * The prices are set so the total on offer is roughly what `reach, +1` paid
 * out, which was about 5 Prestige across the table per game: a river reaching
 * six or seven tiles crosses a third-tile milestone twice.
 */
export const RIVER_MILESTONE_VARIANTS: readonly Variant[] = [
  fromV03('control', 'Control', 'Canon v0.3: the river pays nothing', {}),
  fromV03('river-reach', 'Reach, +1 each', 'Per tile: the stipend', {
    riverPrestige: { perTile: 1, requireReach: true, cap: null, milestone: null },
  }),
  fromV03('mile3', 'Every 3rd tile, +2', 'Claimed, not earned', {
    riverPrestige: { perTile: 2, requireReach: true, cap: null, milestone: 3 },
  }),
  fromV03('mile4', 'Every 4th tile, +3', 'Rarer and worth more', {
    riverPrestige: { perTile: 3, requireReach: true, cap: null, milestone: 4 },
  }),
];


/**
 * v0.4 as adopted, against the v0.3 it replaces.
 *
 * The two round-seven changes were measured one at a time and against a control
 * that carried neither. This is the pair a person actually chooses between:
 * every rule of v0.3, against every rule of v0.4. Run it paired.
 */
export const CANON_VARIANTS: readonly Variant[] = [
  { id: 'v03', label: 'v0.3', note: 'Walls in play, the river pays nothing', rules: V03_RULES },
  { id: 'v04', label: 'v0.4', note: 'No Walls, Babel’s river scores', rules: V04_RULES },
];
