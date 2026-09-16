import {
  SCHEME_COST,
  MAX_ARMY,
  MUSTER_COST,
  RESOURCE_TYPES,
  TOWER_COST,
  WALL_COST,
  WALL_SEGMENTS,
  type ResourceType,
} from '@babel-game/game-data';
import { canBuildBabel, pieceCost, piecesPerStage } from '../babel/index.js';
import {
  canAfford,
  paySpecific,
  getLegalBuildSites,
  getLegalMonumentSites,
  getLegalTowerSites,
  type BuildingType,
} from '../buildings/index.js';
import { getLegalWallEdges, type WallEdge } from '../walls/index.js';
import { isActionBlockedByConfusion } from '../cards/index.js';
import { hostDefence } from '../heaven/beacons.js';
import { isFoundationOccupied } from '../heaven/hosts.js';
import type { Coord } from '../map/edges.js';
import type { GameState, PlayerId } from '../state/types.js';

/**
 * How many Army dice a Leader can pay for. With no price — canon — the whole
 * Army rolls, which is the rule a die price generalises.
 */
export function affordableDice(
  leader: { readonly army: number; readonly resources: Readonly<Record<ResourceType, number>> },
  price: GameState['rules']['attackDieCost'],
): number {
  if (!price || price.amount <= 0) return leader.army;
  const held = leader.resources[price.resource];
  if (price.flat) return held >= price.amount ? leader.army : 0;
  return Math.min(leader.army, Math.floor(held / price.amount));
}

export type LegalAction =
  | { readonly type: 'pass' }
  | {
      readonly type: 'buildBabel';
      readonly cost: Partial<Record<ResourceType, number>>;
      /** How many pieces this one action would add, at current holdings. */
      readonly pieces: number;
    }
  | {
      readonly type: 'buildHarvester';
      readonly sites: readonly { at: Coord; type: BuildingType }[];
    }
  | {
      readonly type: 'barter';
      /** Resources this Leader currently holds enough of to spend. */
      readonly spendable: readonly ResourceType[];
      /** How many cards this Barter discards, under the rules in force. */
      readonly cost: number;
      /** True when Barter does not consume the turn's action. */
      readonly free: boolean;
    }
  | { readonly type: 'buildTower'; readonly sites: readonly Coord[] }
  | {
      readonly type: 'buildMonument';
      readonly sites: readonly Coord[];
      readonly cost: Partial<Record<ResourceType, number>>;
      readonly prestige: number;
    }
  | {
      readonly type: 'buildWalls';
      readonly edges: readonly WallEdge[];
      /** How many segments this action places. GDD §17, capped by the board. */
      readonly segments: number;
    }
  | { readonly type: 'muster'; readonly army: number }
  | { readonly type: 'buyScheme' }
  | {
      readonly type: 'attack';
      /** Dice this Leader can actually roll: their Army, capped by the Food. */
      readonly dice: number;
      readonly defence: number;
      /** What this Attack will cost. Null under canon rules, where it is free. */
      readonly cost: { readonly resource: ResourceType; readonly amount: number } | null;
    };

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
  if (state.phase === 'confusion') return [];
  if (state.pendingVote || state.pendingBeacon || state.pendingAttack) return [];
  if (state.bonusWindow) return [];
  if (state.order[state.currentPlayerIndex] !== playerId) return [];
  if (state.turnStep !== 'action') return [];

  /* Pass is always available. GDD §11, and RD-013 keeps it exempt from
     Fractured Command so a round can never deadlock. */
  const actions: LegalAction[] = [{ type: 'pass' }];
  const blocked = (category: Parameters<typeof isActionBlockedByConfusion>[2]) =>
    isActionBlockedByConfusion(state, playerId, category);

  const canBuild = !blocked('build');
  const sites = canBuild ? getLegalBuildSites(state.board, state.buildings, leader) : [];
  if (sites.length > 0) actions.push({ type: 'buildHarvester', sites });

  /* GDD §16: one Tower per connected feature, on any land tile. */
  if (canBuild && canAfford(leader, TOWER_COST)) {
    const towerSites = getLegalTowerSites(state.board, state.buildings, leader);
    if (towerSites.length > 0) actions.push({ type: 'buildTower', sites: towerSites });
  }

  /**
   * A Monument: Prestige for its owner and nothing for humanity.
   *
   * Deliberately competing with Babel for the same action, which is GDD §1's
   * second pillar made into a turn-by-turn choice — cooperate to survive,
   * compete to be remembered.
   */
  const monument = state.rules.monument;
  if (canBuild && monument && canAfford(leader, monument.cost)) {
    const sites = getLegalMonumentSites(state.board, state.buildings, leader, monument.cost);
    if (sites.length > 0) {
      actions.push({
        type: 'buildMonument',
        sites,
        cost: monument.cost,
        prestige: monument.prestige,
      });
    }
  }

  /* GDD §17: 1 Wood places two Wall segments on edges between land tiles. */
  if (canBuild && canAfford(leader, WALL_COST)) {
    const edges = getLegalWallEdges(state.board, state.walls);
    if (edges.length > 0) {
      actions.push({
        type: 'buildWalls',
        edges,
        segments: Math.min(WALL_SEGMENTS, edges.length),
      });
    }
  }

  if (
    !blocked('babel') &&
    !isFoundationOccupied(state.hosts) &&
    canBuildBabel(leader, state.stage, state.rules)
  ) {
    /* How far a single Build action would actually get, spending down the
       hand piece by piece at the price of the Stage each one lands in. */
    let pieces = 0;
    let hand = { ...leader.resources };
    let stage = state.stage;
    let stack = state.babel.stack.length;
    while (pieces < state.rules.babelPiecesPerAction) {
      const cost = pieceCost(stage, state.rules);
      if (!canAfford({ ...leader, resources: hand }, cost)) break;
      hand = paySpecific({ ...leader, resources: hand }, cost) as Record<ResourceType, number>;
      pieces += 1;
      stack += 1;
      stage = Math.min(
        3,
        Math.max(stage, Math.floor(stack / piecesPerStage(state.order.length, state.rules)) + 1),
      ) as typeof stage;
    }
    actions.push({
      type: 'buildBabel',
      cost: pieceCost(state.stage, state.rules),
      pieces: Math.max(1, pieces),
    });
  }

  /**
   * GDD §15: Attack is pointless with nothing on the board to shoot at.
   *
   * Where the rules put a price on Army dice, a Leader rolls as many as they
   * can pay for and cannot Attack at all with nothing to pay — otherwise a
   * penniless Leader could still Attack for zero dice purely to set the
   * Towers off, which is not an Attack.
   */
  if (!blocked('attack') && state.hosts.length > 0) {
    const price = state.rules.attackDieCost;
    const dice = affordableDice(leader, price);
    if (dice > 0) {
      actions.push({
        type: 'attack',
        dice,
        defence: hostDefence(state.order.length, state.stage, state.rules),
        cost: price
          ? { resource: price.resource, amount: price.flat ? price.amount : dice * price.amount }
          : null,
      });
    }
  }

  if (!blocked('muster') && leader.army < MAX_ARMY && canAfford(leader, MUSTER_COST)) {
    actions.push({ type: 'muster', army: leader.army + 1 });
  }

  /* GDD §18: the bonus action from Frenzied Works may not buy a Scheme. */
  if (
    !blocked('scheme') &&
    !state.inBonusAction &&
    canAfford(leader, SCHEME_COST) &&
    state.schemeDeck.length + state.schemeDiscard.length > 0
  ) {
    actions.push({ type: 'buyScheme' });
  }

  /**
   * GDD §8: Barter needs any three resource cards in any combination. Under the
   * Milestone 6 `sameKind` candidate it needs three of one resource instead, so
   * a Leader spread thin across four types can no longer convert at all — which
   * is the point of the candidate, and why the shortfall must be visible here
   * rather than discovered when the command is rejected.
   */
  if (!blocked('barter')) {
    const cost = state.rules.barterCost;
    const spendable =
      state.rules.barterMode === 'sameKind'
        ? RESOURCE_TYPES.filter((r) => leader.resources[r] >= cost)
        : RESOURCE_TYPES.filter((r) => leader.resources[r] > 0);
    const held = RESOURCE_TYPES.reduce((sum, r) => sum + leader.resources[r], 0);
    const enough =
      state.rules.barterMode === 'sameKind' ? spendable.length > 0 : held >= cost;
    const spent = state.rules.barterIsFree && state.freeBarterUsed;
    if (enough && !spent) {
      actions.push({ type: 'barter', spendable, cost, free: state.rules.barterIsFree });
    }
  }

  return actions;
}
