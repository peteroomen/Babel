import {
  BROAD_PIECE_COST,
  CANON_RULES,
  MONUMENT_RULE,
  TERMINATOR_RIVER_WEIGHTS,
  type RuleSet,
} from '@babel-game/game-data';
import type { Variant } from './variants.js';

/**
 * One lever, switched on or off.
 *
 * A factorial sweep runs every combination rather than a handful of authored
 * variants. That buys two things a head-to-head cannot: the *main effect* of
 * each lever is measured across every setting of the others rather than against
 * one arbitrary baseline, and interactions become visible — two changes that
 * each help but cancel each other are exactly what the earlier rounds kept
 * stumbling into.
 */
export type Factor = {
  readonly key: string;
  readonly label: string;
  readonly on: Partial<RuleSet>;
};

export const FACTORS: readonly Factor[] = [
  {
    key: 'B',
    label: 'Barter: four of one kind',
    on: { barterMode: 'sameKind', barterCost: 4 },
  },
  { key: 'P', label: 'Babel: broad cost curve', on: { babelPieceCost: BROAD_PIECE_COST } },
  { key: 'R', label: 'Rivers: terminators', on: { riverWeights: TERMINATOR_RIVER_WEIGHTS } },
  { key: 'D', label: 'Desert blocks Hosts', on: { impassableTerrain: ['lake', 'desert'] } },
  { key: 'M', label: 'Monument (Prestige sink)', on: { monument: MONUMENT_RULE } },
];

export const CELLS = 1 << FACTORS.length;

/** Whether a factor is switched on in this cell. */
export const isOn = (mask: number, index: number): boolean => (mask & (1 << index)) !== 0;

/** A readable name for a cell: the keys that are on, or "canon". */
export function cellId(mask: number): string {
  const on = FACTORS.filter((_, i) => isOn(mask, i)).map((f) => f.key);
  return on.length === 0 ? 'canon' : on.join('');
}

export function cellVariant(mask: number): Variant {
  const rules = FACTORS.reduce<RuleSet>(
    (acc, factor, i) => (isOn(mask, i) ? { ...acc, ...factor.on } : acc),
    CANON_RULES,
  );
  return {
    id: cellId(mask),
    label: cellId(mask),
    note: FACTORS.filter((_, i) => isOn(mask, i)).map((f) => f.label).join(' + ') || 'canon v0.1',
    rules,
  };
}
