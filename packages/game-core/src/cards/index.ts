import {
  CONFUSION,
  SCHEMES,
  confusionCardsForStage,
  type ActionCategory,
  type ConfusionId,
  type SchemeId,
  type Stage,
} from '@babel-game/game-data';
import { shuffle, type RngState } from '../rng/index.js';
import type { GameState, PlayerId } from '../state/types.js';

/**
 * Draw one card, reshuffling the discard pile when the draw pile runs out.
 * GDD §18 and §19 both say the same thing: when the pile empties, reshuffle.
 */
export function drawCard<T>(
  deck: readonly T[],
  discard: readonly T[],
  rng: RngState,
): { card: T | null; deck: T[]; discard: T[]; rng: RngState } {
  if (deck.length > 0) {
    const [card, ...rest] = deck;
    return { card: card as T, deck: rest, discard: [...discard], rng };
  }
  if (discard.length === 0) return { card: null, deck: [], discard: [], rng };

  const [reshuffled, next] = shuffle(rng, discard);
  const [card, ...rest] = reshuffled;
  return { card: card as T, deck: rest, discard: [], rng: next };
}

/** GDD §19: new Confusion cards are shuffled into what remains of the deck. */
export function addStageConfusion(
  deck: readonly ConfusionId[],
  stage: Stage,
  rng: RngState,
): { deck: ConfusionId[]; rng: RngState; added: ConfusionId[] } {
  const added = confusionCardsForStage(stage);
  if (added.length === 0) return { deck: [...deck], rng, added };
  const [shuffled, next] = shuffle(rng, [...deck, ...added]);
  return { deck: shuffled, rng: next, added };
}

/** The Confusion in force right now, or null if there is none or it was cancelled. */
export function activeConfusion(state: GameState): ConfusionId | null {
  if (!state.confusion.card) return null;
  return state.confusion.cancelledBy ? null : state.confusion.card;
}

export const confusionIs = (state: GameState, id: ConfusionId): boolean =>
  activeConfusion(state) === id;

/**
 * Fractured Command. GDD §19: each action may be chosen by only one Leader per
 * round.
 *
 * RD-013: Passing is exempt. Canon lists Pass among the actions, but a Leader
 * who can afford nothing and whose remaining categories are all taken would
 * have no legal move at all, which would deadlock the round.
 */
export function isActionBlockedByConfusion(
  state: GameState,
  player: PlayerId,
  category: ActionCategory,
): boolean {
  if (category === 'pass') return false;

  if (category === 'babel' && confusionIs(state, 'stalled-works')) return true;
  if (category === 'attack' && confusionIs(state, 'broken-swords')) return true;

  if (confusionIs(state, 'fractured-command')) {
    const taken = state.actionsThisRound[category];
    if (taken && taken !== player) return true;
  }

  return false;
}

export { CONFUSION, SCHEMES };
export type { ConfusionId, SchemeId, ActionCategory };
