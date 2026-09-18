import {
  BUILDING_PRESTIGE,
  HOSTS,
  COMBAT_DIE_BONUS,
  COMBAT_PRESTIGE,
  MAX_ARMY,
  MUSTER_COST,
  RESOURCE_TYPES,
  MONUMENT,
  TOWER,
  TOWER_COST,
  TOWER_PRESTIGE,
  isHarvester,
  structureCost,
  type ResourceType,
} from '@babel-game/game-data';
import {
  SCHEMES,
  SCHEME_COST,
  type ActionCategory,
  type SchemeId,
} from '@babel-game/game-data';
import {
  activeConfusion,
  addStageConfusion,
  confusionIs,
  drawCard,
  isActionBlockedByConfusion,
} from '../cards/index.js';
import {
  applyHit,
  compareHostIds,
  dieHits,
  effectiveHostDefence,
  getTowerSupportGroups,
  rollAttack,
  validateAssignments,
} from '../combat/index.js';
import { affordableDice } from '../actions/legal.js';
import { getLegalBeaconSites, hostDefence } from '../heaven/beacons.js';
import { isPassableAt } from '../heaven/path.js';
import { beaconsOwed, openBeaconDecision, resolveHeavenPhase } from '../heaven/phase.js';
import { isFoundationOccupied, newHost, occupiedKeys } from '../heaven/hosts.js';
import {
  canBuildBabel,
  isBabelComplete,
  piecePrestige,
  pieceCost,
  stageAfterPiece,
} from '../babel/index.js';
import {
  canAfford,
  canBuildHarvester,
  canBuildMonument,
  canBuildTower,
  paySpecific,
} from '../buildings/index.js';
import { getConnectedFeature } from '../features/index.js';
import { rollD6 } from '../rng/index.js';
import { babelRiverReach, riverPrestigeEarned, riverPrestigeFor } from '../rivers/index.js';
import {
  canonicalWall,
  getLegalWallEdges,
  wallEdgeKey,
  type WallEdge,
} from '../walls/index.js';
import { resolveHarvest } from '../economy/harvest.js';
import { placementPayout } from '../economy/payout.js';
import { coordKey, neighbours, type Coord } from '../map/edges.js';
import { isLegalPlacement, type Board } from '../map/placement.js';
import { nextInt } from '../rng/index.js';
import { drawPlaceableTile, fillReserve } from './setup.js';
import type {
  ApplyResult,
  Command,
  GameEvent,
  GameState,
  LeaderState,
  PendingVote,
  PlayerId,
} from './types.js';

export function currentPlayer(state: GameState): PlayerId {
  return state.order[state.currentPlayerIndex] as PlayerId;
}

const leaderOf = (state: GameState, id: PlayerId): LeaderState =>
  state.leaders[id] as LeaderState;

/** Add resources to one Leader without touching the others. */
function credit(
  state: GameState,
  id: PlayerId,
  resource: ResourceType,
  amount: number,
): GameState['leaders'] {
  const leader = leaderOf(state, id);
  return {
    ...state.leaders,
    [id]: {
      ...leader,
      resources: { ...leader.resources, [resource]: leader.resources[resource] + amount },
    },
  };
}

/**
 * Resolve a completed vote. Majority wins; a tie is broken by a seeded coin
 * flip so the result is deterministic and replays identically. See RD-005.
 */
function resolveVote(
  state: GameState,
  vote: PendingVote,
): { state: GameState; events: GameEvent[] } {
  const tally = vote.options.map(
    (_, i) => Object.values(vote.votes).filter((v) => v === i).length,
  );
  const best = Math.max(...tally);
  const tied = tally.flatMap((count, i) => (count === best ? [i] : []));

  let rng = state.rng;
  let choice = tied[0] as number;
  const byCoinFlip = tied.length > 1;
  if (byCoinFlip) {
    const [pick, next] = nextInt(rng, tied.length);
    rng = next;
    choice = tied[pick] as number;
  }

  return {
    state: { ...state, rng, pendingVote: null },
    events: [
      {
        type: 'voteResolved',
        id: vote.id,
        choice: vote.options[choice] as string,
        byCoinFlip,
      },
    ],
  };
}

/**
 * Draw the next Leader's tile, discarding any that cannot be placed (RD-002),
 * and refresh the Reserve against the board as it now stands.
 *
 * Milestone 6 puts the Reserve check "at the start of a turn", which is here:
 * the tiles a Leader is offered are all checked against the same board, so a
 * Leader is never shown a slot they could not take.
 */
function drawFor(
  state: GameState,
  player: PlayerId,
): {
  draw: GameState['drawnTile'];
  reserve: GameState['reserve'];
  rng: GameState['rng'];
  events: GameEvent[];
} {
  const events: GameEvent[] = [];
  const { draw, rng, discarded } = drawPlaceableTile(state.board, state.rng, state.rules);
  for (const tile of discarded) {
    events.push({
      type: 'tileDiscarded',
      player,
      terrain: tile.terrain,
      river: tile.river,
      reason: 'noLegalPlacement',
    });
  }
  events.push({ type: 'tileDrawn', player, terrain: draw.terrain, river: draw.river });

  const refreshed = fillReserve(state.board, state.reserve, state.rules, rng);
  if (refreshed.dropped.length > 0) {
    events.push({ type: 'reserveRefreshed', tiles: refreshed.added, reason: 'dead' });
  }
  return { draw, reserve: refreshed.reserve, rng: refreshed.rng, events };
}

/**
 * Hand the turn on. GDD §11: when play would return to the First Player the
 * round is over and the Heaven Phase follows, which the table resolves
 * explicitly rather than it happening invisibly.
 */
/**
 * Discard anything a Leader holds over the cap.
 *
 * Deliberately at the end of the *turn* rather than the round, so the Leader
 * has just had their action and cannot claim they were never given a chance to
 * spend it.
 */
function spoil(state: GameState, player: PlayerId): { state: GameState; events: GameEvent[] } {
  const cap = state.rules.resourceCap;
  const leader = state.leaders[player];
  if (cap === null || !leader) return { state, events: [] };

  const resources = { ...leader.resources };
  const lost: Partial<Record<ResourceType, number>> = {};
  for (const resource of RESOURCE_TYPES) {
    if (resources[resource] > cap) {
      lost[resource] = resources[resource] - cap;
      resources[resource] = cap;
    }
  }
  if (Object.keys(lost).length === 0) return { state, events: [] };
  return {
    state: { ...state, leaders: { ...state.leaders, [player]: { ...leader, resources } } },
    events: [{ type: 'resourcesSpoiled', player, lost }],
  };
}

function endTurn(base: GameState): { state: GameState; events: GameEvent[] } {
  const spoiled = spoil(base, currentPlayer(base));
  const state = spoiled.state;
  const events: GameEvent[] = [
    ...spoiled.events,
    { type: 'turnEnded', player: currentPlayer(state) },
  ];
  const nextIndex = (state.currentPlayerIndex + 1) % state.order.length;

  if (nextIndex === state.firstPlayerIndex) {
    /* GDD §13: any Beacons owed are sited before Heaven spawns from them. */
    const opened = openBeaconDecision({
      ...state,
      phase: 'heaven',
      turnStep: 'action',
      drawnTile: null,
    });
    events.push(...opened.events);
    return { state: opened.state, events };
  }

  const nextPlayer = state.order[nextIndex] as PlayerId;
  const drawn = drawFor(state, nextPlayer);
  events.push(...drawn.events);

  return {
    state: {
      ...state,
      currentPlayerIndex: nextIndex,
      turnStep: 'place',
      drawnTile: drawn.draw,
      reserve: drawn.reserve,
      freeBarterUsed: false,
      rng: drawn.rng,
    },
    events,
  };
}

/**
 * Begin the next round. GDD §11: reveal one Confusion card, then play passes
 * clockwise from a new First Player.
 */
function advanceRound(state: GameState): { state: GameState; events: GameEvent[] } {
  const round = state.round + 1;
  const firstPlayerIndex = (state.firstPlayerIndex + 1) % state.order.length;
  const nextPlayer = state.order[firstPlayerIndex] as PlayerId;

  const events: GameEvent[] = [{ type: 'roundStarted', round }];

  /* The card that ruled the last round goes to the discard. GDD §19. */
  const discard = state.confusion.card
    ? [...state.confusionDiscard, state.confusion.card]
    : [...state.confusionDiscard];

  const reveal = drawCard(state.confusionDeck, discard, state.rng);
  if (reveal.card) events.push({ type: 'confusionRevealed', card: reveal.card });

  const drawn = drawFor({ ...state, rng: reveal.rng }, nextPlayer);
  events.push(...drawn.events);

  /**
   * GDD §18: Common Tongue is played "immediately after Confusion is revealed",
   * so the round pauses only when somebody actually holds one.
   */
  const someoneCanCancel =
    Boolean(reveal.card) &&
    state.order.some((id) => state.leaders[id]?.schemeHand.includes('common-tongue'));

  return {
    state: {
      ...state,
      round,
      firstPlayerIndex,
      currentPlayerIndex: firstPlayerIndex,
      phase: someoneCanCancel ? 'confusion' : 'turns',
      turnStep: 'place',
      drawnTile: drawn.draw,
      reserve: drawn.reserve,
      freeBarterUsed: false,
      rng: drawn.rng,
      confusion: { card: reveal.card, cancelledBy: null },
      confusionDeck: reveal.deck,
      confusionDiscard: reveal.discard,
      /* Fractured Command only constrains within a round. */
      actionsThisRound: {},
      bonusWindow: null,
      inBonusAction: false,
      falseProphet: null,
    },
    events,
  };
}

/** GDD §11 lists seven action categories; several commands share one. */
function categoryOf(type: Command['type']): ActionCategory | null {
  switch (type) {
    case 'buildHarvester':
    case 'buildTower':
    case 'buildMonument':
    case 'buildWalls':
      return 'build';
    case 'buildBabel':
      return 'babel';
    case 'attack':
    case 'assignHits':
      return 'attack';
    case 'muster':
      return 'muster';
    case 'buyScheme':
      return 'scheme';
    case 'barter':
      return 'barter';
    case 'pass':
      return 'pass';
    default:
      return null;
  }
}

/** Shared preconditions for the one action a Leader takes each turn. */
function requireActionPhase(
  state: GameState,
  player: PlayerId,
  category?: ActionCategory,
): void {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  if (state.phase === 'heaven') throw new Error('the Heaven Phase must be resolved');
  if (state.phase === 'confusion') throw new Error('the round has not begun');
  if (state.pendingVote) throw new Error('a vote is open');
  if (state.pendingBeacon) throw new Error('a Beacon must be placed');
  if (state.pendingAttack) throw new Error('assign your hits first');
  if (state.bonusWindow) throw new Error('play Frenzied Works or end your turn');
  if (player !== currentPlayer(state)) throw new Error('not your turn');
  if (state.turnStep !== 'action') throw new Error('place your tile first');

  if (category && isActionBlockedByConfusion(state, player, category)) {
    throw new Error(`Confusion forbids that action this round`);
  }
  /* GDD §18: the bonus action from Frenzied Works cannot buy a Scheme. */
  if (category === 'scheme' && state.inBonusAction) {
    throw new Error('the bonus action cannot buy a Scheme');
  }
}

/**
 * The single authoritative state transition. Pure: the same state plus the same
 * command always yields the same result, with all randomness drawn from the
 * serializable RNG carried in the state.
 */
export function applyMove(state: GameState, command: Command): ApplyResult {
  const events: GameEvent[] = [];
  const commit = (next: GameState): ApplyResult => ({
    state: { ...next, log: [...state.log, ...events] },
    events,
  });

  /** Log the action, then hand the turn on — unless a Scheme buys another. */
  const finishAction = (next: GameState, action: string): ApplyResult => {
    events.push({ type: 'actionTaken', player: command.player, action });

    /* GDD §19 Fractured Command needs to know who used which category. */
    const category = categoryOf(command.type);
    const withCategory: GameState = category
      ? {
          ...next,
          actionsThisRound: { ...next.actionsThisRound, [category]: command.player },
        }
      : next;

    /**
     * GDD §18 Frenzied Works is played *after* the normal action, so a Leader
     * holding one gets a window before the turn passes. Only they see it, so
     * nobody else pays a click for a card they do not hold.
     */
    const holder = withCategory.leaders[command.player];
    const canChain =
      !withCategory.inBonusAction &&
      Boolean(holder?.schemeHand.includes('frenzied-works'));
    if (canChain) {
      return commit({ ...withCategory, bonusWindow: command.player });
    }

    const ended = endTurn({ ...withCategory, inBonusAction: false });
    events.push(...ended.events);
    return commit(ended.state);
  };

  switch (command.type) {
    case 'castVote': {
      const vote = state.pendingVote;
      if (!vote) throw new Error('no vote is open');
      if (!state.leaders[command.player]) throw new Error('unknown player');
      if (command.option < 0 || command.option >= vote.options.length) {
        throw new Error('vote option out of range');
      }

      const votes = { ...vote.votes, [command.player]: command.option };
      events.push({ type: 'voteCast', id: vote.id, player: command.player });

      if (!state.order.every((id) => id in votes)) {
        return commit({ ...state, pendingVote: { ...vote, votes } });
      }

      const resolved = resolveVote(state, { ...vote, votes });
      events.push(...resolved.events);
      return commit(resolved.state);
    }

    /**
     * Milestone 6: trade the blind draw for a face-up Reserve tile.
     *
     * Free and outside the action, so it neither calls requireActionPhase nor
     * touches actionsThisRound. The unwanted draw takes the slot, which is what
     * makes the Reserve communal: the next Leader inherits what you rejected.
     */
    case 'swapReserve': {
      if (state.phase === 'gameOver') throw new Error('the game is over');
      if (state.phase !== 'turns') throw new Error('it is not a Leader\'s turn');
      if (currentPlayer(state) !== command.player) throw new Error('not your turn');
      if (state.turnStep !== 'place') throw new Error('the tile is already placed');
      if (state.rules.reserveSlots === 0) throw new Error('these rules have no Reserve');

      const took = state.reserve[command.slot];
      if (!took) throw new Error(`no Reserve tile in slot ${command.slot}`);
      const gave = state.drawnTile;
      if (!gave) throw new Error('nothing drawn to swap');

      const reserve = state.reserve.map((tile, i) => (i === command.slot ? gave : tile));
      events.push({ type: 'reserveSwapped', player: command.player, took, gave });

      return commit({ ...state, drawnTile: took, reserve });
    }

    case 'placeTile': {
      if (state.phase === 'gameOver') throw new Error('the game is over');
      if (state.phase === 'heaven') throw new Error('the Heaven Phase must be resolved');
      if (state.phase !== 'turns') throw new Error('the Confusion decision must be resolved');
      if (state.pendingVote) throw new Error('a vote is open');
      if (state.pendingBeacon) throw new Error('a Beacon must be placed');
      if (command.player !== currentPlayer(state)) throw new Error('not your turn');
      if (state.turnStep !== 'place') throw new Error('tile already placed this turn');

      const draw = state.drawnTile;
      if (!draw) throw new Error('no tile drawn');
      if (!isLegalPlacement(state.board, command.at, draw, command.rotation, state.rules)) {
        throw new Error('illegal placement');
      }

      const board: Board = {
        ...state.board,
        [coordKey(command.at)]: { ...draw, rotation: command.rotation },
      };

      events.push({
        type: 'tilePlaced',
        player: command.player,
        at: command.at,
        terrain: draw.terrain,
        river: draw.river,
        rotation: command.rotation,
      });

      let next: GameState = { ...state, board };

      /* GDD §9: foreign harvesting buildings first, so the placer's +1 is known. */
      const occupied = occupiedKeys(state.hosts);

      /* GDD §19 Silent Workshops: harvesting buildings do not trigger at all. */
      const harvest = confusionIs(state, 'silent-workshops')
        ? null
        : resolveHarvest(
            board,
            state.buildings,
            occupied,
            command.at,
            draw,
            command.player,
          );

      /* GDD §6 payout, suppressed inside an occupied feature by GDD §10, and
         denied to the placer by GDD §19 Lost Ledgers. */
      const lostLedgers = confusionIs(state, 'lost-ledgers');
      const payout = lostLedgers
        ? null
        : placementPayout(board, occupied, command.at, draw);

      /**
       * RD-012: Lost Ledgers removes the "normal base terrain payout" but says
       * foreign harvesting buildings still resolve normally. The placer's +1 is
       * part of that trigger rather than the base payout, so it survives.
       */
      const bonus = harvest ? harvest.placerBonus : 0;

      if (payout) {
        const total = payout.amount + bonus;
        events.push({
          type: 'resourcesGained',
          player: command.player,
          resource: payout.resource,
          amount: total,
          source: 'placement',
        });
        next = { ...next, leaders: credit(next, command.player, payout.resource, total) };
      } else if (harvest && bonus > 0) {
        events.push({
          type: 'resourcesGained',
          player: command.player,
          resource: harvest.resource,
          amount: bonus,
          source: 'harvest',
        });
        next = { ...next, leaders: credit(next, command.player, harvest.resource, bonus) };
      }

      if (!payout && draw.terrain !== 'desert' && draw.terrain !== 'lake') {
        events.push({
          type: 'payoutSuppressed',
          player: command.player,
          at: command.at,
          reason: lostLedgers ? 'lostLedgers' : 'featureOccupied',
        });
      }

      /**
       * Prestige for lengthening Babel's river, when the rules pay for it.
       *
       * Scored against the board *before* this tile went down, so a Leader is
       * paid for what their own placement added and not for what the river
       * already was.
       */
      const riverReward = riverPrestigeFor(
        state.board,
        command.at,
        draw,
        command.rotation,
        state.rules,
        riverPrestigeEarned(state, command.player),
        undefined,
        state.riverReachRecord ?? babelRiverReach(state.board),
      );
      if (riverReward > 0) {
        events.push({
          type: 'prestigeGained',
          player: command.player,
          amount: riverReward,
          source: 'river',
        });
        next = {
          ...next,
          leaders: {
            ...next.leaders,
            [command.player]: {
              ...next.leaders[command.player]!,
              prestige: next.leaders[command.player]!.prestige + riverReward,
            },
          },
        };
      }

      if (harvest) {
        events.push({
          type: 'harvestTriggered',
          placer: command.player,
          owners: harvest.owners,
          resource: harvest.resource,
          amount: harvest.amount,
          placerBonus: harvest.placerBonus,
        });
        for (const owner of harvest.owners) {
          events.push({
            type: 'resourcesGained',
            player: owner,
            resource: harvest.resource,
            amount: harvest.amount,
            source: 'harvest',
          });
          next = { ...next, leaders: credit(next, owner, harvest.resource, harvest.amount) };
        }
      }

      return commit({
        ...next,
        riverReachRecord: Math.max(
          state.riverReachRecord ?? babelRiverReach(state.board),
          babelRiverReach(board),
        ),
        drawnTile: null,
        turnStep: 'action',
      });
    }

    case 'buildHarvester': {
      requireActionPhase(state, command.player, 'build');
      const leader = leaderOf(state, command.player);
      if (!isHarvester(command.building)) throw new Error('use buildTower for a Tower');
      const rejection = canBuildHarvester(
        state.board,
        state.buildings,
        leader,
        command.at,
        command.building,
      );
      if (rejection) throw new Error(`cannot build: ${rejection}`);

      events.push({
        type: 'buildingConstructed',
        player: command.player,
        at: command.at,
        building: command.building,
      });
      /* GDD §9: constructing a harvesting building gives +1 Prestige. */
      events.push({
        type: 'prestigeGained',
        player: command.player,
        amount: BUILDING_PRESTIGE,
        source: 'building',
      });

      return finishAction(
        {
          ...state,
          buildings: {
            ...state.buildings,
            [coordKey(command.at)]: { type: command.building, owner: command.player },
          },
          leaders: {
            ...state.leaders,
            [command.player]: {
              ...leader,
              resources: paySpecific(leader, structureCost(command.building)),
              prestige: leader.prestige + BUILDING_PRESTIGE,
            },
          },
        },
        `build ${command.building}`,
      );
    }

    case 'buildBabel': {
      requireActionPhase(state, command.player, 'babel');
      /* GDD §2: Babel cannot be built while a Host occupies the Foundation. */
      if (isFoundationOccupied(state.hosts)) {
        throw new Error('the Foundation is occupied');
      }
      if (!canBuildBabel(leaderOf(state, command.player), state.stage, state.rules)) {
        throw new Error('cannot afford a Babel piece');
      }

      /**
       * One action may add several pieces where the rules allow it.
       *
       * Each piece is paid for at the Stage in force when it goes on, so a run
       * that crosses a Stage boundary pays the cheaper price for the pieces
       * below it and the dearer one above — building does not let a Leader
       * outrun the escalation they are causing.
       */
      const wanted = Math.max(1, command.pieces ?? state.rules.babelPiecesPerAction);
      let next: GameState = state;
      let placed = 0;

      while (placed < wanted) {
        const leader = leaderOf(next, command.player);
        if (!canBuildBabel(leader, next.stage, next.rules)) break;

        const prestige = piecePrestige(next.stage);
        const babel = { stack: [...next.babel.stack, command.player] };

        events.push({
          type: 'babelPieceBuilt',
          player: command.player,
          stage: next.stage,
          pieces: babel.stack.length,
        });
        events.push({
          type: 'prestigeGained',
          player: command.player,
          amount: prestige,
          source: 'babel',
        });

        next = {
          ...next,
          babel,
          leaders: {
            ...next.leaders,
            [command.player]: {
              ...leader,
              resources: paySpecific(leader, pieceCost(next.stage, next.rules)),
              prestige: leader.prestige + prestige,
            },
          },
        };
        placed += 1;

        /* GDD §12: permanent escalation at the end of Stage I and Stage II. */
        const stage = stageAfterPiece(babel, next.stage, next.order.length, next.rules);
        if (stage !== next.stage) {
          events.push({ type: 'stageEscalated', from: next.stage, to: stage });
          /* GDD §19: the new cards are shuffled into what remains of the deck. */
          const grown = addStageConfusion(next.confusionDeck, stage, next.rng);
          if (grown.added.length > 0) {
            events.push({ type: 'confusionAdded', cards: grown.added });
          }
          next = { ...next, stage, confusionDeck: grown.deck, rng: grown.rng };
        }

        /* GDD §2: completing the final piece wins the game for humanity. */
        if (isBabelComplete(babel, next.order.length, next.rules)) {
          const best = Math.max(...Object.values(next.leaders).map((l) => l.prestige));
          const topPrestige = next.order.filter((id) => next.leaders[id]!.prestige === best);
          events.push({ type: 'humanityWins', topPrestige });
          return commit({
            ...next,
            phase: 'gameOver',
            turnStep: 'action',
            drawnTile: null,
            winner: topPrestige.length === 1 ? (topPrestige[0] as PlayerId) : null,
          });
        }
      }

      const finished = finishAction(next, 'babel');
      /* GDD §13: new Beacons are sited immediately after the piece that
         triggered the Stage is completed. */
      if (finished.state.pendingBeacon || beaconsOwed(finished.state) <= 0) return finished;
      const opened = openBeaconDecision(finished.state);
      return {
        state: { ...opened.state, log: [...finished.state.log, ...opened.events] },
        events: [...finished.events, ...opened.events],
      };
    }

    case 'barter': {
      requireActionPhase(state, command.player, 'barter');
      if (state.rules.barterIsFree && state.freeBarterUsed) {
        throw new Error('you have already taken your free Barter this turn');
      }
      /* GDD §8: discard any 3 resource cards to gain 1 of your choice. */
      if (command.spend.length !== state.rules.barterCost) {
        throw new Error(`Barter discards exactly ${state.rules.barterCost} resources`);
      }
      if (!RESOURCE_TYPES.includes(command.gain)) throw new Error('unknown resource');
      /* Milestone 6 candidate: three of the *same* resource, so Barter stays an
         escape valve for a surplus stack rather than a precision converter. */
      if (
        state.rules.barterMode === 'sameKind' &&
        new Set(command.spend).size !== 1
      ) {
        throw new Error('these rules require three of the same resource to Barter');
      }

      const leader = leaderOf(state, command.player);
      const resources = { ...leader.resources };
      for (const resource of command.spend) {
        if (!RESOURCE_TYPES.includes(resource)) throw new Error('unknown resource');
        if (resources[resource] <= 0) throw new Error('not enough resources to Barter');
        resources[resource] -= 1;
      }
      resources[command.gain] += 1;

      events.push({
        type: 'bartered',
        player: command.player,
        spent: command.spend,
        gained: command.gain,
      });

      const traded: GameState = {
        ...state,
        leaders: { ...state.leaders, [command.player]: { ...leader, resources } },
      };

      /**
       * A free Barter does not consume the action, so the turn stays open. One
       * per turn: the trade is a net loss of cards, but an unlimited loop would
       * still let a Leader grind a whole hand into a single resource in one go,
       * which is a different game from "you may convert once".
       */
      if (state.rules.barterIsFree) {
        return commit({
          ...traded,
          freeBarterUsed: true,
          actionsThisRound: { ...traded.actionsThisRound, barter: command.player },
        });
      }
      return finishAction(traded, 'barter');
    }

    case 'buildTower': {
      requireActionPhase(state, command.player, 'build');
      const leader = leaderOf(state, command.player);
      const rejection = canBuildTower(state.board, state.buildings, leader, command.at);
      if (rejection) throw new Error(`cannot build a Tower: ${rejection}`);

      events.push({
        type: 'buildingConstructed',
        player: command.player,
        at: command.at,
        building: TOWER,
      });
      /* GDD §20: +1 Prestige for building a Tower. */
      events.push({
        type: 'prestigeGained',
        player: command.player,
        amount: TOWER_PRESTIGE,
        source: 'tower',
      });

      return finishAction(
        {
          ...state,
          buildings: {
            ...state.buildings,
            [coordKey(command.at)]: { type: TOWER, owner: command.player },
          },
          leaders: {
            ...state.leaders,
            [command.player]: {
              ...leader,
              resources: paySpecific(leader, TOWER_COST),
              prestige: leader.prestige + TOWER_PRESTIGE,
            },
          },
        },
        'tower',
      );
    }

    /**
     * A Monument: Prestige for its owner, nothing for humanity.
     *
     * It costs a Leader the same scarce thing Babel does — the one action they
     * get this turn — which is what makes it a decision rather than a bonus.
     */
    case 'buildMonument': {
      requireActionPhase(state, command.player, 'build');
      const monument = state.rules.monument;
      if (!monument) throw new Error('these rules have no Monument');
      const leader = leaderOf(state, command.player);
      const rejection = canBuildMonument(
        state.board,
        state.buildings,
        leader,
        command.at,
        monument.cost,
      );
      if (rejection) throw new Error(`cannot build a Monument: ${rejection}`);

      events.push({
        type: 'buildingConstructed',
        player: command.player,
        at: command.at,
        building: MONUMENT,
      });
      events.push({
        type: 'prestigeGained',
        player: command.player,
        amount: monument.prestige,
        source: 'monument',
      });

      return finishAction(
        {
          ...state,
          buildings: {
            ...state.buildings,
            [coordKey(command.at)]: { type: MONUMENT, owner: command.player },
          },
          leaders: {
            ...state.leaders,
            [command.player]: {
              ...leader,
              resources: paySpecific(leader, monument.cost),
              prestige: leader.prestige + monument.prestige,
            },
          },
        },
        'monument',
      );
    }

    case 'buildWalls': {
      requireActionPhase(state, command.player, 'build');
      const leader = leaderOf(state, command.player);
      const wallRule = state.rules.walls;
      if (!wallRule) throw new Error('Walls are not in play');
      if (!canAfford(leader, wallRule.cost)) throw new Error('cannot afford Walls');

      /* GDD §17: one Build action places two segments. RD-010 allows fewer only
         when the board offers fewer legal edges. */
      const available = getLegalWallEdges(state.board, state.walls);
      const cap = Math.min(wallRule.segments, available.length);
      if (command.edges.length < 1 || command.edges.length > cap) {
        throw new Error(`a Build Walls action places ${cap} segment(s)`);
      }

      const legal = new Set(available.map(wallEdgeKey));
      const chosen: WallEdge[] = [];
      const seen = new Set<string>();
      for (const edge of command.edges) {
        const wall = canonicalWall(edge.a, edge.b);
        const key = wallEdgeKey(wall);
        if (!legal.has(key)) throw new Error('illegal Wall edge');
        if (seen.has(key)) throw new Error('duplicate Wall edge');
        seen.add(key);
        chosen.push(wall);
      }

      events.push({ type: 'wallsBuilt', player: command.player, edges: chosen });
      /* GDD §17: a Build Walls action gives +1 Prestige. */
      events.push({
        type: 'prestigeGained',
        player: command.player,
        amount: wallRule.prestige,
        source: 'walls',
      });

      return finishAction(
        {
          ...state,
          walls: [...state.walls, ...chosen],
          leaders: {
            ...state.leaders,
            [command.player]: {
              ...leader,
              resources: paySpecific(leader, wallRule.cost),
              prestige: leader.prestige + wallRule.prestige,
            },
          },
        },
        'walls',
      );
    }

    case 'muster': {
      requireActionPhase(state, command.player, 'muster');
      const leader = leaderOf(state, command.player);
      /* GDD §15: 1 Food + 1 Metal for one more Army die, to a maximum of 5. */
      if (leader.army >= MAX_ARMY) throw new Error('Army is already at its maximum');
      if (!canAfford(leader, MUSTER_COST)) throw new Error('cannot afford to Muster');

      events.push({ type: 'mustered', player: command.player, army: leader.army + 1 });
      return finishAction(
        {
          ...state,
          leaders: {
            ...state.leaders,
            [command.player]: {
              ...leader,
              resources: paySpecific(leader, MUSTER_COST),
              army: leader.army + 1,
            },
          },
        },
        'muster',
      );
    }

    case 'attack': {
      requireActionPhase(state, command.player, 'attack');
      if (state.hosts.length === 0) throw new Error('there are no Hosts to attack');
      const bonus = state.rules.combatDieBonus;
      let rng = state.rng;
      let hosts = [...state.hosts];
      let towerSeq = state.hostSeq;
      let leaders = state.leaders;
      let combatPrestige = 0;

      const combatState = (): GameState => ({ ...state, hosts });
      const defenceOf = (host: GameState['hosts'][number]) =>
        effectiveHostDefence(combatState(), host);

      /**
       * Towers in one connected feature share one support die. A caller may
       * choose the Tower key for each merged feature; absent a choice, object
       * insertion order preserves the oldest surviving Tower fallback.
       */
      const featureKey = (at: Coord) => [...getConnectedFeature(state.board, at)].sort().join('|');
      const groups = getTowerSupportGroups(state).map((group) =>
        group.towers.map((key) => [key, state.buildings[key]] as const),
      );
      const selected = command.towerSupport ?? [];
      const selectedFeatures = new Set<string>();
      for (const key of selected) {
        const building = state.buildings[key];
        if (!building || building.type !== TOWER) throw new Error(`unknown Tower ${key}`);
        const [x, y] = key.split(',').map(Number) as [number, number];
        const groupKey = featureKey({ x, y });
        const occupied = getTowerSupportGroups(state).some((group) => group.towers.includes(key));
        if (!occupied) throw new Error(`Tower ${key} cannot provide support here`);
        if (selectedFeatures.has(groupKey)) {
          throw new Error('choose only one support Tower per feature');
        }
        selectedFeatures.add(groupKey);
      }

      /**
       * GDD §16: Towers do not fire during Heaven's turn. When any player
       * Attacks, every *occupied* feature holding a Tower contributes one
       * support die, committed to a Host in that same feature, and these
       * resolve before Army dice.
       *
       * RD-011: canon does not say who picks the Host a support die is
       * committed to. It targets the lowest-id Host in that feature, so the
       * result is deterministic and the attacker is not handed an extra
       * micro-decision every Attack.
       */
      for (const group of groups) {
        const chosenKey = selected.find((key) => group.some(([towerKey]) => towerKey === key)) ?? group[0]?.[0];
        if (!chosenKey) continue;
        const building = state.buildings[chosenKey] as (typeof state.buildings)[string];
        const key = chosenKey;
        const [tx, ty] = key.split(',').map(Number) as [number, number];
        const feature = new Set(getConnectedFeature(state.board, { x: tx, y: ty }));
        const inFeature = hosts
          .filter((host) => feature.has(coordKey(host.at)))
          /* A Warded Host is beyond prepared ground: only an Army reaches it,
             so a table that has settled into Towers has to muster again. */
          .filter((host) => !HOSTS[host.kind].wardedFromTowers)
          .sort((l, r) => compareHostIds(l.id, r.id));
        if (inFeature.length === 0) continue;

        const [roll, nextRng] = rollD6(rng);
        rng = nextRng;
        const target = inFeature[0] as GameState['hosts'][number];
        /* A Tower die is a combat die like any other: it uses the ruleset's
           bonus and the target's own Defence. Reading the constant here meant
           a variant that changed the bonus silently left Towers behind, which
           made two settings that should be identical disagree by 35 points. */
        const hit = dieHits(roll, defenceOf(target), bonus);

        events.push({
          type: 'towerSupport',
          owner: building.owner,
          at: { x: tx, y: ty },
          roll,
          defence: defenceOf(target),
          hit,
          targetId: target.id,
        });
        if (!hit) continue;

        const outcome = applyHit(target);
        const index = hosts.findIndex((host) => host.id === target.id);
        if (outcome.killed) {
          events.push({ type: 'hostKilled', player: command.player, id: target.id });
          hosts.splice(index, 1);
          /* A Tower kill leaves the same wreckage an Army kill would. */
          const spec = HOSTS[target.kind].splitsInto;
          if (spec) {
            const born: string[] = [];
            for (let i = 0; i < spec.count; i++) {
              towerSeq += 1;
              const id = `h${towerSeq}`;
              hosts.push(newHost(id, spec.kind, target.at));
              born.push(id);
            }
            events.push({ type: 'hostSplit', from: target.id, into: born, at: target.at });
          }
          /* The attacker still earns the normal kill Prestige. GDD §16. */
          combatPrestige += COMBAT_PRESTIGE;
        } else {
          events.push({
            type: 'hostHit',
            player: command.player,
            id: target.id,
            shieldBroken: outcome.shieldBroken,
          });
          hosts[index] = outcome.host as GameState['hosts'][number];
        }

        /* GDD §16: the Tower's owner earns Prestige for a successful hit. */
        const owner = leaders[building.owner] as GameState['leaders'][string];
        events.push({
          type: 'prestigeGained',
          player: building.owner,
          amount: TOWER_PRESTIGE,
          source: 'tower',
        });
        leaders = {
          ...leaders,
          [building.owner]: { ...owner, prestige: owner.prestige + TOWER_PRESTIGE },
        };
      }

      /* Towers resolve first. Army Defence is computed from the surviving
         state, so a Tower-killed Herald cannot continue protecting its targets. */
      const defence = hosts.length > 0
        ? Math.min(...hosts.map(defenceOf))
        : hostDefence(state.order.length, state.stage, state.rules);
      const leader = leaders[command.player] as GameState['leaders'][string];

      /**
       * Where the rules price Army dice, a Leader rolls as many as their Food
       * covers, up to their Army, and pays for exactly those.
       *
       * Tower support above is unaffected: GDD §16 makes it a property of the
       * ground, not of the attacker's Army. The legality check keeps a Leader
       * who can afford no dice at all from Attacking purely to set Towers off.
       */
      const price = state.rules.attackDieCost;
      const most = affordableDice(leader, price);
      if (most <= 0) {
        throw new Error(`not enough ${price?.resource ?? 'resources'} to roll a single Army die`);
      }

      /* Committing fewer dice is a real decision once they cost something:
         holding Food back for Babel is often worth more than another 1-in-3. */
      const dice = command.dice ?? most;
      if (dice < 1 || dice > most) {
        throw new Error(`roll between 1 and ${most} Army dice, not ${dice}`);
      }
      const paid = price ? (price.flat ? price.amount : dice * price.amount) : 0;

      /**
       * Munitions: extra dice bought outright.
       *
       * The only shape of defensive spending a combat system with no range can
       * take — dice are the currency, so a pile buys more of them. Optional and
       * never a tax: pricing what a table has to do every round starves it, as
       * the Attack-cost rounds showed.
       */
      const munitions = state.rules.munitions;
      const asked = command.extraDice ?? 0;
      /* Reject rather than clamp: quietly rolling fewer dice than the caller
         asked for would hide a UI bug behind a plausible-looking result. */
      if (asked > 0 && !munitions) throw new Error('these rules have no Munitions');
      if (asked < 0 || (munitions && asked > munitions.maxExtraDice)) {
        throw new Error(`Munitions buy at most ${munitions?.maxExtraDice ?? 0} extra dice`);
      }
      const extraDice = asked;
      let munitionsBill: Partial<Record<ResourceType, number>> = {};
      if (extraDice > 0 && munitions) {
        munitionsBill = Object.fromEntries(
          Object.entries(munitions.cost).map(([r, n]) => [r, (n ?? 0) * extraDice]),
        );
        if (!canAfford(leader, munitionsBill)) throw new Error('cannot afford that many Munitions');
      }

      const { result, rng: afterArmy } = rollAttack(rng, dice + extraDice, defence, bonus);
      rng = afterArmy;

      events.push({
        type: 'attackRolled',
        player: command.player,
        rolls: result.rolls,
        defence,
        successes: result.successes,
        paid: price ? { resource: price.resource, amount: paid } : null,
      });

      if (combatPrestige > 0) {
        events.push({
          type: 'prestigeGained',
          player: command.player,
          amount: combatPrestige,
          source: 'combat',
        });
      }

      const withCombat: GameState = {
        ...state,
        rng,
        hostSeq: towerSeq,
        hosts,
        leaders: {
          ...leaders,
          [command.player]: {
            ...leader,
            prestige: leader.prestige + combatPrestige,
            resources: paySpecific(
              {
                ...leader,
                resources: price
                  ? {
                      ...leader.resources,
                      [price.resource]: leader.resources[price.resource] - paid,
                    }
                  : leader.resources,
              },
              munitionsBill,
            ),
          },
        },
      };

      /* Nothing left to assign, so the action is over. */
      if (result.successes === 0 || hosts.length === 0) {
        return finishAction(withCombat, 'attack');
      }

      /* GDD §15: successful dice are assigned among Hosts after rolling. */
      return commit({
        ...withCombat,
        pendingAttack: {
          player: command.player,
          rolls: result.rolls,
          defence,
          successes: result.successes,
        },
      });
    }

    case 'assignHits': {
      const pending = state.pendingAttack;
      if (!pending) throw new Error('no Attack is awaiting assignment');
      if (pending.player !== command.player) throw new Error('not your Attack');

      const invalid = validateAssignments(state.hosts, command.assignments, pending.successes, {
        rolls: pending.rolls,
        bonus: state.rules.combatDieBonus,
        defenceOf: (host) => effectiveHostDefence(state, host),
      });
      if (invalid) throw new Error(invalid);

      const hosts = [...state.hosts];
      let hostSeq = state.hostSeq;
      let killed = 0;

      /**
       * What a Swarm leaves behind.
       *
       * Killing one is not the end of it: two Ophanim take its place on the
       * same square. Chip damage is punished and concentrated fire rewarded,
       * which is exactly the shape Munitions is for. Ophanim do not split, so
       * this terminates.
       */
      const split = (dead: GameState['hosts'][number]): void => {
        const spec = HOSTS[dead.kind].splitsInto;
        if (!spec) return;
        const born: string[] = [];
        for (let i = 0; i < spec.count; i++) {
          hostSeq += 1;
          const id = `h${hostSeq}`;
          hosts.push(newHost(id, spec.kind, dead.at));
          born.push(id);
        }
        events.push({ type: 'hostSplit', from: dead.id, into: born, at: dead.at });
      };

      for (const [id, count] of Object.entries(command.assignments)) {
        for (let hit = 0; hit < count; hit++) {
          const index = hosts.findIndex((host) => host.id === id);
          if (index === -1) break;
          const dying = hosts[index] as GameState['hosts'][number];
          const outcome = applyHit(dying);
          if (outcome.killed) {
            events.push({ type: 'hostKilled', player: command.player, id });
            hosts.splice(index, 1);
            split(dying);
            killed += 1;
          } else {
            events.push({
              type: 'hostHit',
              player: command.player,
              id,
              shieldBroken: outcome.shieldBroken,
            });
            hosts[index] = outcome.host as GameState['hosts'][number];
          }
        }
      }

      const leader = leaderOf(state, command.player);
      const prestige = killed * COMBAT_PRESTIGE;
      if (prestige > 0) {
        /* GDD §15: +1 Prestige per Host killed during your Attack action. */
        events.push({
          type: 'prestigeGained',
          player: command.player,
          amount: prestige,
          source: 'combat',
        });
      }

      return finishAction(
        {
          ...state,
          hosts,
          /* A Swarm's offspring need ids nobody else will reuse. */
          hostSeq,
          pendingAttack: null,
          leaders: {
            ...state.leaders,
            [command.player]: { ...leader, prestige: leader.prestige + prestige },
          },
        },
        'attack',
      );
    }

    case 'pass': {
      requireActionPhase(state, command.player, 'pass');
      return finishAction(state, 'pass');
    }

    case 'buyScheme': {
      requireActionPhase(state, command.player, 'scheme');
      const leader = leaderOf(state, command.player);
      if (!canAfford(leader, SCHEME_COST)) throw new Error('cannot afford a Scheme');

      /* GDD §18: blind draw, reshuffling the discard when the pile runs out. */
      const drawn = drawCard(state.schemeDeck, state.schemeDiscard, state.rng);
      if (!drawn.card) {
        events.push({ type: 'schemeDeckEmpty' });
        throw new Error('no Schemes remain');
      }

      events.push({ type: 'schemeBought', player: command.player });
      return finishAction(
        {
          ...state,
          rng: drawn.rng,
          schemeDeck: drawn.deck,
          schemeDiscard: drawn.discard,
          leaders: {
            ...state.leaders,
            [command.player]: {
              ...leader,
              resources: paySpecific(leader, SCHEME_COST),
              schemeHand: [...leader.schemeHand, drawn.card],
            },
          },
        },
        'scheme',
      );
    }

    case 'playScheme': {
      if (state.phase === 'gameOver') throw new Error('the game is over');
      const leader = state.leaders[command.player];
      if (!leader) throw new Error('unknown player');
      if (!leader.schemeHand.includes(command.scheme)) {
        throw new Error('you do not hold that Scheme');
      }

      /* Spend the card whatever it does. GDD §18. */
      const spend = (next: GameState): GameState => {
        const index = leader.schemeHand.indexOf(command.scheme);
        const hand = [...leader.schemeHand];
        hand.splice(index, 1);
        return {
          ...next,
          schemeDiscard: [...next.schemeDiscard, command.scheme],
          leaders: {
            ...next.leaders,
            [command.player]: { ...leaderOf(next, command.player), schemeHand: hand },
          },
        };
      };

      events.push({ type: 'schemePlayed', player: command.player, scheme: command.scheme });

      switch (command.scheme) {
        case 'common-tongue': {
          if (state.phase !== 'confusion') {
            throw new Error('Common Tongue is played as Confusion is revealed');
          }
          const card = state.confusion.card;
          if (!card) throw new Error('there is no Confusion to cancel');
          events.push({ type: 'confusionCancelled', card, player: command.player });
          return commit(
            spend({
              ...state,
              phase: 'turns',
              confusion: { card, cancelledBy: command.player },
            }),
          );
        }

        case 'frenzied-works': {
          if (state.bonusWindow !== command.player) {
            throw new Error('Frenzied Works is played right after your own action');
          }
          /* GDD §18: take one more action immediately. */
          return commit(
            spend({
              ...state,
              bonusWindow: null,
              inBonusAction: true,
              turnStep: 'action',
            }),
          );
        }

        case 'false-prophet': {
          if (state.phase !== 'heaven') {
            throw new Error('False Prophet is played during the Heaven Phase');
          }
          if (!command.hostId || !command.to) {
            throw new Error('False Prophet needs a Host and a destination');
          }
          const host = state.hosts.find((h) => h.id === command.hostId);
          if (!host) throw new Error('unknown Host');
          /* Any adjacent legal tile, including sideways or away from Babel. */
          const legal = neighbours(host.at).some(
            (candidate) =>
              coordKey(candidate) === coordKey(command.to as GameState['hosts'][number]['at']) &&
              isPassableAt(state.board, candidate, state.rules.impassableTerrain),
          );
          if (!legal) throw new Error('that is not an adjacent legal tile');

          return commit(
            spend({ ...state, falseProphet: { hostId: host.id, to: command.to } }),
          );
        }
      }
      throw new Error('unknown Scheme');
    }

    case 'endTurn': {
      if (state.bonusWindow !== command.player) throw new Error('nothing to end');
      const ended = endTurn({ ...state, bonusWindow: null, inBonusAction: false });
      events.push(...ended.events);
      return commit(ended.state);
    }

    case 'beginRound': {
      if (state.phase !== 'confusion') throw new Error('the round has already begun');
      if (!state.leaders[command.player]) throw new Error('unknown player');
      return commit({ ...state, phase: 'turns' });
    }

    case 'placeBeacon': {
      const pending = state.pendingBeacon;
      if (!pending) throw new Error('no Beacon is pending');
      if (!state.leaders[command.player]) throw new Error('unknown player');
      if (!pending.sites.some((site) => coordKey(site) === coordKey(command.at))) {
        throw new Error('illegal Beacon site');
      }

      const beacons = [...state.beacons, command.at];
      /* A new gate opens empty and has to save up like the rest. */
      const beaconCharge = [...state.beaconCharge, 0];
      events.push({ type: 'beaconPlaced', at: command.at, total: beacons.length });

      const opened = openBeaconDecision({ ...state, beacons, beaconCharge });
      events.push(...opened.events);
      return commit(opened.state);
    }

    case 'resolveHeaven': {
      if (state.phase !== 'heaven') throw new Error('it is not the Heaven Phase');
      if (state.pendingBeacon) throw new Error('a Beacon must be placed first');
      if (!state.leaders[command.player]) throw new Error('unknown player');

      const resolved = resolveHeavenPhase(state, command.plan ?? {});
      events.push(...resolved.events);
      if (resolved.state.phase === 'gameOver') return commit(resolved.state);

      const advanced = advanceRound(resolved.state);
      events.push(...advanced.events);
      return commit(advanced.state);
    }
  }
}

/**
 * Per-player view. GDD §18: Scheme hands are hidden, so a networked client must
 * never receive another Leader's hand.
 */
export function playerView(state: GameState, viewer: PlayerId): GameState {
  const leaders = Object.fromEntries(
    Object.entries(state.leaders).map(([id, leader]) => [
      id,
      id === viewer ? leader : { ...leader, schemeHand: [] },
    ]),
  );
  return { ...state, leaders };
}
