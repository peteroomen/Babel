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
  PendingVote,
  PlayerId,
} from './types.js';

export function currentPlayer(state: GameState): PlayerId {
  return state.order[state.currentPlayerIndex] as PlayerId;
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

      /* GDD §6 payout, suppressed inside an occupied feature by GDD §10. */
      const payout = placementPayout(board, state.occupiedTiles, command.at, draw);
      const leader = state.leaders[command.player] as GameState['leaders'][string];
      let leaders = state.leaders;

      if (payout) {
        events.push({
          type: 'resourcesGained',
          player: command.player,
          resource: payout.resource,
          amount: payout.amount,
          source: 'placement',
        });
        leaders = {
          ...state.leaders,
          [command.player]: {
            ...leader,
            resources: {
              ...leader.resources,
              [payout.resource]: leader.resources[payout.resource] + payout.amount,
            },
          },
        };
      } else if (basePaysSomething(draw.terrain)) {
        events.push({
          type: 'payoutSuppressed',
          player: command.player,
          at: command.at,
          reason: 'featureOccupied',
        });
      }

      return commit({ ...state, board, leaders, drawnTile: null, turnStep: 'action' });
    }

    case 'takeAction': {
      if (state.pendingVote) throw new Error('a vote is open');
      if (command.player !== currentPlayer(state)) throw new Error('not your turn');
      if (state.turnStep !== 'action') throw new Error('place your tile first');

      events.push({ type: 'actionTaken', player: command.player, action: command.action });
      const ended = endTurn(state);
      events.push(...ended.events);
      return commit(ended.state);
    }
  }
}

/** Desert and Lake never pay, so a missing payout there is not suppression. */
function basePaysSomething(terrain: string): boolean {
  return terrain !== 'desert' && terrain !== 'lake';
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
