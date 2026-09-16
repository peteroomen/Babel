import {
  BROAD_PIECE_COST,
  CANON_RULES,
  TERRAIN_WEIGHTS,
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
  withRules('control', 'Control', 'Canon v0.1: blind draw, mixed Barter', {}),
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
