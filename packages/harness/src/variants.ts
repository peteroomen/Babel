import { CANON_RULES, TERRAIN_WEIGHTS, type RuleSet } from '@babel-game/game-data';

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
