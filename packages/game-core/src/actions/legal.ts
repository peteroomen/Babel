import { BARTER_COST, RESOURCE_TYPES, type ResourceType } from '@babel-game/game-data';
import { canBuildBabel, pieceCost } from '../babel/index.js';
import { getLegalBuildSites, type BuildingType } from '../buildings/index.js';
import type { Coord } from '../map/edges.js';
import type { GameState, PlayerId } from '../state/types.js';

export type LegalAction =
  | { readonly type: 'pass' }
  | { readonly type: 'buildBabel'; readonly cost: Partial<Record<ResourceType, number>> }
  | {
      readonly type: 'buildHarvester';
      readonly sites: readonly { at: Coord; type: BuildingType }[];
    }
  | { readonly type: 'barter' };

/**
 * What this Leader may legally do right now.
 *
 * AGENT_HANDOFF: the UI renders from this rather than recreating action
 * prerequisites. Actions not yet implemented (Attack, Muster, Scheme, and
 * Walls under Build) arrive in later milestones and are absent rather than
 * disabled here.
 */
export function getLegalActions(state: GameState, playerId: PlayerId): LegalAction[] {
  const leader = state.leaders[playerId];
  if (!leader) return [];
  if (state.phase === 'gameOver') return [];
  if (state.pendingVote) return [];
  if (state.order[state.currentPlayerIndex] !== playerId) return [];
  if (state.turnStep !== 'action') return [];

  /* Pass is always available. GDD §11. */
  const actions: LegalAction[] = [{ type: 'pass' }];

  const sites = getLegalBuildSites(state.board, state.buildings, leader);
  if (sites.length > 0) actions.push({ type: 'buildHarvester', sites });

  if (!state.babel.foundationOccupied && canBuildBabel(leader, state.stage)) {
    actions.push({ type: 'buildBabel', cost: pieceCost(state.stage) });
  }

  /* GDD §8: Barter needs any three resource cards in any combination. */
  const held = RESOURCE_TYPES.reduce((sum, r) => sum + leader.resources[r], 0);
  if (held >= BARTER_COST) actions.push({ type: 'barter' });

  return actions;
}
