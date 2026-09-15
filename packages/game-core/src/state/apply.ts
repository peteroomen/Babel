import { nextInt } from '../rng/index.js';
import { BABEL_COORD, drawTerrain } from './setup.js';
import {
  coordKey,
  type ApplyResult,
  type Command,
  type Coord,
  type GameEvent,
  type GameState,
  type PendingVote,
  type PlayerId,
} from './types.js';

const ORTHOGONAL: readonly Coord[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** GDD §6: a tile must be orthogonally adjacent to the board or to Babel. */
export function isLegalPlacement(state: GameState, at: Coord): boolean {
  if (state.board[coordKey(at)]) return false;
  if (coordKey(at) === coordKey(BABEL_COORD)) return false;
  return ORTHOGONAL.some((d) => {
    const neighbour = { x: at.x + d.x, y: at.y + d.y };
    return (
      Boolean(state.board[coordKey(neighbour)]) ||
      coordKey(neighbour) === coordKey(BABEL_COORD)
    );
  });
}

export function currentPlayer(state: GameState): PlayerId {
  return state.order[state.currentPlayerIndex] as PlayerId;
}

/**
 * Resolve a completed vote. Majority wins; a tie is broken by a seeded coin
 * flip so that the result is deterministic and replays identically.
 */
function resolveVote(
  state: GameState,
  vote: PendingVote,
): { state: GameState; events: GameEvent[]; choice: number } {
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
    choice,
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

  const [terrain, rng] = drawTerrain(state.rng);
  events.push({
    type: 'tileDrawn',
    player: state.order[turnIndex] as PlayerId,
    terrain,
  });

  return {
    state: {
      ...state,
      round,
      firstPlayerIndex,
      currentPlayerIndex: turnIndex,
      turnStep: 'place',
      drawnTile: terrain,
      rng,
    },
    events,
  };
}

/**
 * The single authoritative state transition. Pure: same state plus same
 * command always yields the same result, with all randomness drawn from the
 * serializable RNG carried in the state.
 */
export function applyMove(state: GameState, command: Command): ApplyResult {
  const events: GameEvent[] = [];

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

      const everyoneVoted = state.order.every((id) => id in votes);
      if (!everyoneVoted) {
        const next = { ...state, pendingVote: { ...vote, votes } };
        return { state: { ...next, log: [...state.log, ...events] }, events };
      }

      const resolved = resolveVote(state, { ...vote, votes });
      events.push(...resolved.events);
      return {
        state: { ...resolved.state, log: [...state.log, ...events] },
        events,
      };
    }

    case 'placeTile': {
      if (state.pendingVote) throw new Error('a vote is open');
      if (command.player !== currentPlayer(state)) throw new Error('not your turn');
      if (state.turnStep !== 'place') throw new Error('tile already placed this turn');
      if (!isLegalPlacement(state, command.at)) throw new Error('illegal placement');

      const terrain = state.drawnTile;
      if (!terrain) throw new Error('no tile drawn');

      events.push({
        type: 'tilePlaced',
        player: command.player,
        at: command.at,
        terrain,
      });

      const next: GameState = {
        ...state,
        board: {
          ...state.board,
          [coordKey(command.at)]: { terrain, riverEdges: [] },
        },
        drawnTile: null,
        turnStep: 'action',
      };
      return { state: { ...next, log: [...state.log, ...events] }, events };
    }

    case 'takeAction': {
      if (state.pendingVote) throw new Error('a vote is open');
      if (command.player !== currentPlayer(state)) throw new Error('not your turn');
      if (state.turnStep !== 'action') throw new Error('place your tile first');

      events.push({ type: 'actionTaken', player: command.player, action: command.action });
      const ended = endTurn({ ...state, log: [...state.log, ...events] });
      events.push(...ended.events);
      return {
        state: { ...ended.state, log: [...state.log, ...ended.events] },
        events,
      };
    }
  }
}

/**
 * Per-player view. GDD §18: Scheme hands are hidden, so a networked client
 * must never receive another Leader's hand.
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
