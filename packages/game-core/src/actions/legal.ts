import {
  BARTER_COST,
  MAX_ARMY,
  MUSTER_COST,
  RESOURCE_TYPES,
  TOWER_COST,
  WALL_COST,
  WALL_SEGMENTS,
  type ResourceType,
} from '@babel-game/game-data';
import { canBuildBabel, pieceCost } from '../babel/index.js';
import {
  canAfford,
  getLegalBuildSites,
  getLegalTowerSites,
  type BuildingType,
} from '../buildings/index.js';
import { getLegalWallEdges, type WallEdge } from '../walls/index.js';
import { hostDefence } from '../heaven/beacons.js';
import { isFoundationOccupied } from '../heaven/hosts.js';
import type { Coord } from '../map/edges.js';
import type { GameState, PlayerId } from '../state/types.js';

export type LegalAction =
  | { readonly type: 'pass' }
  | { readonly type: 'buildBabel'; readonly cost: Partial<Record<ResourceType, number>> }
  | {
      readonly type: 'buildHarvester';
      readonly sites: readonly { at: Coord; type: BuildingType }[];
    }
  | { readonly type: 'barter' }
  | { readonly type: 'buildTower'; readonly sites: readonly Coord[] }
  | {
      readonly type: 'buildWalls';
      readonly edges: readonly WallEdge[];
      /** How many segments this action places. GDD §17, capped by the board. */
      readonly segments: number;
    }
  | { readonly type: 'muster'; readonly army: number }
  | { readonly type: 'attack'; readonly dice: number; readonly defence: number };

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
  if (state.phase === 'gameOver' || state.phase === 'heaven') return [];
  if (state.pendingVote || state.pendingBeacon || state.pendingAttack) return [];
  if (state.order[state.currentPlayerIndex] !== playerId) return [];
  if (state.turnStep !== 'action') return [];

  /* Pass is always available. GDD §11. */
  const actions: LegalAction[] = [{ type: 'pass' }];

  const sites = getLegalBuildSites(state.board, state.buildings, leader);
  if (sites.length > 0) actions.push({ type: 'buildHarvester', sites });

  /* GDD §16: one Tower per connected feature, on any land tile. */
  if (canAfford(leader, TOWER_COST)) {
    const towerSites = getLegalTowerSites(state.board, state.buildings, leader);
    if (towerSites.length > 0) actions.push({ type: 'buildTower', sites: towerSites });
  }

  /* GDD §17: 1 Wood places two Wall segments on edges between land tiles. */
  if (canAfford(leader, WALL_COST)) {
    const edges = getLegalWallEdges(state.board, state.walls);
    if (edges.length > 0) {
      actions.push({
        type: 'buildWalls',
        edges,
        segments: Math.min(WALL_SEGMENTS, edges.length),
      });
    }
  }

  if (!isFoundationOccupied(state.hosts) && canBuildBabel(leader, state.stage)) {
    actions.push({ type: 'buildBabel', cost: pieceCost(state.stage) });
  }

  /* GDD §15: Attack is pointless with nothing on the board to shoot at. */
  if (state.hosts.length > 0) {
    actions.push({
      type: 'attack',
      dice: leader.army,
      defence: hostDefence(state.order.length, state.stage),
    });
  }

  if (leader.army < MAX_ARMY && canAfford(leader, MUSTER_COST)) {
    actions.push({ type: 'muster', army: leader.army + 1 });
  }

  /* GDD §8: Barter needs any three resource cards in any combination. */
  const held = RESOURCE_TYPES.reduce((sum, r) => sum + leader.resources[r], 0);
  if (held >= BARTER_COST) actions.push({ type: 'barter' });

  return actions;
}
