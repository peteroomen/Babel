import {
  BABEL_PIECE_COST,
  BABEL_PIECE_PRESTIGE,
  SCALING,
  type LeaderCount,
  type Stage,
} from '@babel-game/game-data';
import { canAfford } from '../buildings/index.js';
import type { BabelState, LeaderState } from '../state/types.js';

export const piecesPerStage = (leaderCount: number): number =>
  SCALING[leaderCount as LeaderCount].piecesPerStage;

/** Total pieces needed to finish Babel. GDD §4: three Stages of equal size. */
export const totalPieces = (leaderCount: number): number => piecesPerStage(leaderCount) * 3;

export const pieceCost = (stage: Stage) => BABEL_PIECE_COST[stage];
export const piecePrestige = (stage: Stage) => BABEL_PIECE_PRESTIGE[stage];

export function canBuildBabel(leader: LeaderState, stage: Stage): boolean {
  return canAfford(leader, pieceCost(stage));
}

/**
 * The Stage after adding a piece. GDD §12: reaching the end of a Stage
 * escalates Heaven permanently, and escalation never reverses if Heaven later
 * knocks Babel back below the threshold — so this only ever increases.
 */
export function stageAfterPiece(
  babel: BabelState,
  currentStage: Stage,
  leaderCount: number,
): Stage {
  const perStage = piecesPerStage(leaderCount);
  const reached = Math.min(3, Math.floor(babel.stack.length / perStage) + 1) as Stage;
  return Math.max(currentStage, reached) as Stage;
}

/** GDD §2: completing the final piece of Babel wins the game for humanity. */
export function isBabelComplete(babel: BabelState, leaderCount: number): boolean {
  return babel.stack.length >= totalPieces(leaderCount);
}

/** How many pieces remain before the next permanent escalation. */
export function piecesToNextEscalation(
  babel: BabelState,
  currentStage: Stage,
  leaderCount: number,
): number | null {
  if (currentStage >= 3) return null;
  const threshold = piecesPerStage(leaderCount) * currentStage;
  return Math.max(0, threshold - babel.stack.length);
}
