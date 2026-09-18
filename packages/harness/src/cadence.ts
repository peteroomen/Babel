import { V04_ROLLED_HEAVEN, V04_RULES } from '@babel-game/game-data';
import type { Variant } from './variants.js';

type Cycle = readonly [readonly number[], readonly number[], readonly number[]];

const fixed = (stage1: readonly number[], stage2: readonly number[], stage3: readonly number[]): Cycle =>
  [stage1, stage2, stage3];

const cadenceVariant = (id: string, label: string, note: string, cycle: Cycle): Variant => ({
  id,
  label,
  note,
  rules: {
    ...V04_RULES,
    heavenSpawn: { ...V04_ROLLED_HEAVEN!, cadenceByStage: cycle },
  },
});

const one = (rate: number): readonly number[] => {
  if (rate === 0.75) return [0, 1, 1, 1];
  if (rate === 0.5) return [1, 0];
  if (rate === 2.25) return [2, 2, 2, 3];
  if (rate === 1.5) return [1, 2];
  if (rate === 2.5) return [2, 3];
  return [Math.round(rate)];
};

const candidate = (players: number, rates: readonly [number, number, number]): Variant =>
  rates[0] === 1 && rates[1] === 2 && rates[2] === 2
    ? {
        id: `p${players}-1-2-2`,
        label: `${players}p 1/2/2 canon`,
        note: 'Canon control; no cadence override. Historical balance stats predate repairs.',
        rules: V04_RULES,
      }
    : cadenceVariant(
        `p${players}-${rates.join('-')}`,
        `${players}p ${rates.join('/')}`,
        `Experimental Heaven cadence, mean arrivals ${rates.join('/')}; ${rates.some((rate) => rate === 0.75) ? 'a .75 stage starts with a quiet phase at its anchor; ' : ''}canon stats are historical.`,
        fixed(one(rates[0]), one(rates[1]), one(rates[2])),
      );

export const CADENCE_VARIANTS: Readonly<Record<number, readonly Variant[]>> = {
  2: [
    candidate(2, [1, 2, 2]),
    candidate(2, [1, 1, 1]),
    candidate(2, [1, 1, 1.5]),
    candidate(2, [1, 1.5, 1.5]),
    candidate(2, [0.75, 1, 1]),
    candidate(2, [1, 0.75, 1]),
    candidate(2, [1, 0.75, 0.75]),
    candidate(2, [1, 0.5, 1]),
  ],
  3: [
    candidate(3, [1, 2, 2]),
    candidate(3, [1, 1, 1]),
    candidate(3, [1, 1.5, 1.5]),
    candidate(3, [1, 1.5, 2]),
  ],
  4: [
    candidate(4, [1, 2, 2]),
    candidate(4, [1, 2.5, 2.5]),
    candidate(4, [1, 3, 3]),
    candidate(4, [1.5, 2.5, 2.5]),
    candidate(4, [1.5, 2, 2]),
    candidate(4, [1, 2.25, 2.25]),
    candidate(4, [1, 2, 2.5]),
  ],
};
