import {
  BARTER_COST,
  BUILDINGS,
  BUILDING_PRESTIGE,
  RESOURCE_TYPES,
  type ResourceType,
} from '@babel-game/game-data';
import {
  canBuildBabel,
  isBabelComplete,
  piecePrestige,
  pieceCost,
  stageAfterPiece,
} from '../babel/index.js';
import { canBuildHarvester, paySpecific } from '../buildings/index.js';
import { resolveHarvest } from '../economy/harvest.js';
import { placementPayout } from '../economy/payout.js';
import { coordKey } from '../map/edges.js';
import { isLegalPlacement, type Board } from '../map/placement.js';
import { nextInt } from '../rng/index.js';
import { drawPlaceableTile } from './setup.js';
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

/** Advance to the next player, running the Heaven Phase at the round boundary. */
function endTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [{ type: 'turnEnded', player: currentPlayer(state) }];
  const nextIndex = (state.currentPlayerIndex + 1) % state.order.length;

  /* GDD §11: once play returns to the First Player, the round is over. */
  const roundComplete = nextIndex === state.firstPlayerIndex;
  let round = state.round;
  let firstPlayerIndex = state.firstPlayerIndex;
  let turnIndex = nextIndex;

  if (roundComplete) {
    events.push({ type: 'heavenPhase', round: state.round });
    round += 1;
    /* GDD §11: pass the First Player marker clockwise. */
    firstPlayerIndex = (state.firstPlayerIndex + 1) % state.order.length;
    turnIndex = firstPlayerIndex;
    events.push({ type: 'roundStarted', round });
  }

  const nextPlayer = state.order[turnIndex] as PlayerId;
  const { draw, rng, discarded } = drawPlaceableTile(state.board, state.rng);

  for (const tile of discarded) {
    events.push({
      type: 'tileDiscarded',
      player: nextPlayer,
      terrain: tile.terrain,
      river: tile.river,
      reason: 'noLegalPlacement',
    });
  }
  events.push({
    type: 'tileDrawn',
    player: nextPlayer,
    terrain: draw.terrain,
    river: draw.river,
  });

  return {
    state: {
      ...state,
      round,
      firstPlayerIndex,
      currentPlayerIndex: turnIndex,
      turnStep: 'place',
      drawnTile: draw,
      rng,
    },
    events,
  };
}

/** Shared preconditions for the one action a Leader takes each turn. */
function requireActionPhase(state: GameState, player: PlayerId): void {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  if (state.pendingVote) throw new Error('a vote is open');
  if (player !== currentPlayer(state)) throw new Error('not your turn');
  if (state.turnStep !== 'action') throw new Error('place your tile first');
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

  /** Log the action, then hand the turn on. */
  const finishAction = (next: GameState, action: string): ApplyResult => {
    events.push({ type: 'actionTaken', player: command.player, action });
    const ended = endTurn(next);
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

    case 'placeTile': {
      if (state.phase === 'gameOver') throw new Error('the game is over');
      if (state.pendingVote) throw new Error('a vote is open');
      if (command.player !== currentPlayer(state)) throw new Error('not your turn');
      if (state.turnStep !== 'place') throw new Error('tile already placed this turn');

      const draw = state.drawnTile;
      if (!draw) throw new Error('no tile drawn');
      if (!isLegalPlacement(state.board, command.at, draw, command.rotation)) {
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
      const harvest = resolveHarvest(
        board,
        state.buildings,
        state.occupiedTiles,
        command.at,
        draw,
        command.player,
      );

      /* GDD §6 payout, suppressed inside an occupied feature by GDD §10. */
      const payout = placementPayout(board, state.occupiedTiles, command.at, draw);

      if (payout) {
        const total = payout.amount + (harvest ? harvest.placerBonus : 0);
        events.push({
          type: 'resourcesGained',
          player: command.player,
          resource: payout.resource,
          amount: total,
          source: 'placement',
        });
        next = { ...next, leaders: credit(next, command.player, payout.resource, total) };
      } else if (draw.terrain !== 'desert' && draw.terrain !== 'lake') {
        events.push({
          type: 'payoutSuppressed',
          player: command.player,
          at: command.at,
          reason: 'featureOccupied',
        });
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

      return commit({ ...next, drawnTile: null, turnStep: 'action' });
    }

    case 'buildHarvester': {
      requireActionPhase(state, command.player);
      const leader = leaderOf(state, command.player);
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
              resources: paySpecific(leader, BUILDINGS[command.building].cost),
              prestige: leader.prestige + BUILDING_PRESTIGE,
            },
          },
        },
        `build ${command.building}`,
      );
    }

    case 'buildBabel': {
      requireActionPhase(state, command.player);
      /* GDD §2: Babel cannot be built while a Host occupies the Foundation. */
      if (state.babel.foundationOccupied) {
        throw new Error('the Foundation is occupied');
      }
      const leader = leaderOf(state, command.player);
      if (!canBuildBabel(leader, state.stage)) throw new Error('cannot afford a Babel piece');

      const prestige = piecePrestige(state.stage);
      const babel = { ...state.babel, stack: [...state.babel.stack, command.player] };

      events.push({
        type: 'babelPieceBuilt',
        player: command.player,
        stage: state.stage,
        pieces: babel.stack.length,
      });
      events.push({
        type: 'prestigeGained',
        player: command.player,
        amount: prestige,
        source: 'babel',
      });

      let next: GameState = {
        ...state,
        babel,
        leaders: {
          ...state.leaders,
          [command.player]: {
            ...leader,
            resources: paySpecific(leader, pieceCost(state.stage)),
            prestige: leader.prestige + prestige,
          },
        },
      };

      /* GDD §12: permanent escalation at the end of Stage I and Stage II. */
      const stage = stageAfterPiece(babel, state.stage, state.order.length);
      if (stage !== state.stage) {
        events.push({ type: 'stageEscalated', from: state.stage, to: stage });
        next = { ...next, stage };
      }

      /* GDD §2: completing the final piece wins the game for humanity. */
      if (isBabelComplete(babel, state.order.length)) {
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

      return finishAction(next, 'babel');
    }

    case 'barter': {
      requireActionPhase(state, command.player);
      /* GDD §8: discard any 3 resource cards to gain 1 of your choice. */
      if (command.spend.length !== BARTER_COST) {
        throw new Error(`Barter discards exactly ${BARTER_COST} resources`);
      }
      if (!RESOURCE_TYPES.includes(command.gain)) throw new Error('unknown resource');

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

      return finishAction(
        { ...state, leaders: { ...state.leaders, [command.player]: { ...leader, resources } } },
        'barter',
      );
    }

    case 'pass': {
      requireActionPhase(state, command.player);
      return finishAction(state, 'pass');
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
