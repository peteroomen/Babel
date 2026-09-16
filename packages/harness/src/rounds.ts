import {
  CANON_RULES,
  MUNITIONS_RULE,
  TIERED_BEACONS,
  type RuleSet,
} from '@babel-game/game-data';
import type { Variant } from './variants.js';

/**
 * Round six runs each question as its own set rather than one big factorial.
 *
 * The levers here change different subsystems — the economy, the Tower's
 * height, what Heaven sends, what the table can buy — and mixing them would
 * measure the combination rather than the parts. Combinations come later, once
 * it is clear which parts are worth combining.
 */
const on = (id: string, label: string, note: string, rules: Partial<RuleSet>): Variant => ({
  id,
  label,
  note,
  rules: { ...CANON_RULES, ...rules },
});

/** Free Barter is taken as read; the question is what pays for it. */
const FREE = { barterIsFree: true } as const;

/**
 * Free Barter lands the table at 88-92% wins. These ask which difficulty knob
 * brings it back to a game you could lose — the target band is 60-70%.
 */
export const DIFFICULTY_VARIANTS: readonly Variant[] = [
  on('v0.2', 'v0.2 today', 'No free Barter', {}),
  on('free', 'Free Barter', 'The lever, unpaid for', FREE),
  on('def-i-ii', '+ Defence +1 to Stage II', 'Not Stage III, which is a cliff', { ...FREE, hostDefenceBonus: [1, 1, 0] }),
  on('def-early', '+ Defence +1 early', 'Stage I only', { ...FREE, hostDefenceBonus: [1, 0, 0] }),
  on('beacon+1', '+ one more Beacon', 'More Hosts, same toughness', {
    ...FREE,
    beaconBonus: 1,
  }),
  on('die-1', '+ dice are d6+1', 'The bonus cut from 2', { ...FREE, combatDieBonus: 1 }),
  on('beacon+1-def+1', '+ Beacon and Defence', 'Both, gently', {
    ...FREE,
    beaconBonus: 1,
    hostDefenceBonus: [1, 0, 0],
  }),
];

/** How tall should the Tower be? Fewer pieces per Stage is a shorter game. */
export const HEIGHT_VARIANTS: readonly Variant[] = [
  on('pieces5', '5 per Stage', 'v0.2 at 3 Leaders', {}),
  on('pieces4', '4 per Stage', '12 pieces total', { piecesPerStage: 4 }),
  on('pieces3', '3 per Stage', '9 pieces total', { piecesPerStage: 3 }),
  on('pieces2', '2 per Stage', '6 pieces total', { piecesPerStage: 2 }),
];

/**
 * Heaven with three kinds of gate, against the uniform spawn it replaces.
 *
 * Split so the two halves of the idea can be told apart: the tiers alone change
 * *what* arrives and also thin the total, because two of the three gates only
 * fire on alternate rounds.
 */
export const HEAVEN_VARIANTS: readonly Variant[] = [
  on('uniform', 'Uniform', 'Every Beacon sends an Ophanim, every round', {}),
  on('tiered', 'Three gates', 'Ophanim / Zealot / Throne, staggered', {
    beaconTiers: TIERED_BEACONS,
  }),
  on('tiered+1', 'Three gates, +1 Beacon', 'Same, with more gates open', {
    beaconTiers: TIERED_BEACONS,
    beaconBonus: 1,
  }),
  on('tiered-fast', 'Three gates, all every round', 'Tiers without the stagger', {
    beaconTiers: TIERED_BEACONS.map((tier) => ({ ...tier, everyNRounds: 1, offset: 0 })),
  }),
];

/** Can the table buy its way out of a harder Heaven? */
export const DEFENCE_VARIANTS: readonly Variant[] = [
  on('hard', 'Harder Heaven', 'Three gates, Defence +1', {
    beaconTiers: TIERED_BEACONS,
    hostDefenceBonus: [1, 0, 0],
  }),
  on('munitions', '+ Munitions', 'Buy up to 3 extra dice', {
    beaconTiers: TIERED_BEACONS,
    hostDefenceBonus: [1, 1, 0],
    munitions: MUNITIONS_RULE,
  }),
  on('die+1', '+ dice are d6+3', 'Better dice instead of more', {
    beaconTiers: TIERED_BEACONS,
    hostDefenceBonus: [1, 1, 0],
    combatDieBonus: 3,
  }),
  on('munitions-free', '+ Munitions and free Barter', 'The pile buys the defence', {
    beaconTiers: TIERED_BEACONS,
    hostDefenceBonus: [1, 1, 0],
    munitions: MUNITIONS_RULE,
    barterIsFree: true,
  }),
];
