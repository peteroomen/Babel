import type { ResourceType } from './terrain.js';

/** GDD §2 and §12. Babel always has three Stages. */
export type Stage = 1 | 2 | 3;
export const STAGES: readonly Stage[] = [1, 2, 3];

/** GDD §0: light flavour labels, no rules attached. */
export const STAGE_LABEL: Record<Stage, string> = {
  1: 'Foundation of Defiance',
  2: 'The Great Ascent',
  3: 'The Siege of Heaven',
};

/** Cost of one complete Babel piece. GDD §12, TUNEABLE. */
export const BABEL_PIECE_COST: Record<Stage, Partial<Record<ResourceType, number>>> = {
  1: { brick: 2, food: 1 },
  2: { brick: 4, food: 1 },
  3: { brick: 6, food: 2 },
};

/** Prestige for adding a piece, by the Stage it was built in. GDD §12. */
export const BABEL_PIECE_PRESTIGE: Record<Stage, number> = { 1: 2, 2: 3, 3: 4 };

/** GDD §8: discard any 3 resource cards to gain 1 of your choice. */
export const BARTER_COST = 3;
