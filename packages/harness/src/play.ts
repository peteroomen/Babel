import {
  RESOURCE_TYPES,
  type ResourceType,
  type Stage,
  type TerrainType,
} from '@babel-game/game-data';
import {
  applyMove,
  currentPlayer,
  setupGame,
  type GameEvent,
  type GameState,
  type PlayerId,
} from '@babel-game/game-core';
import {
  CLASSIC_TABLE,
  aiRandom,
  nextCommand,
  tableCommand,
  want,
  type Archetype,
  type AiSeats,
} from '@babel-game/game-ai';
import type { Variant } from './variants.js';

/**
 * Hard stop, so a stalemate reports as a timeout instead of hanging.
 *
 * Generous on purpose. At 60 the control variant reported half its games as
 * timeouts and a 30% win rate; the same games run to 90 resolved at 60%. The
 * cap was measuring itself. It is set well past where games actually finish so
 * that a timeout means a real stall, and the mean round count carries the
 * information about length instead.
 */
export const ROUND_CAP = 120;

export type Outcome = 'win' | 'loss' | 'timeout';

/** One Leader's turn, as the metrics need to see it. */
export type TurnRecord = {
  readonly round: number;
  readonly player: PlayerId;
  readonly archetype: Archetype;
  readonly action: string;
  /** The resource the Leader was short of when the turn began. */
  readonly wanted: ResourceType | null;
  /** Whether the turn actually produced any of it, from any source. */
  readonly satisfied: boolean;
  /** Null when the rules have no Reserve; otherwise 'kept', or the slot taken. */
  readonly swap: 'kept' | number | null;
  /** Terrain of the tile the Leader ended up placing. */
  readonly placed: TerrainType | null;
};

export type GameRecord = {
  readonly variant: string;
  readonly seed: string;
  readonly outcome: Outcome;
  readonly rounds: number;
  readonly winner: PlayerId | null;
  readonly seats: AiSeats;
  readonly prestige: Readonly<Record<PlayerId, number>>;
  readonly finalResources: Readonly<Record<PlayerId, Readonly<Record<ResourceType, number>>>>;
  /** Round at which each Stage was first reached. Stage 1 is always round 1. */
  readonly stageRounds: Readonly<Partial<Record<Stage, number>>>;
  readonly babelPieces: number;
  readonly turns: readonly TurnRecord[];
  readonly events: readonly GameEvent[];
  /** Reserve tiles discarded as unplaceable, per Milestone 6's dead-slot rule. */
  readonly reserveDead: number;
  /** Terrain of every tile taken out of the Reserve. */
  readonly reserveTaken: readonly TerrainType[];
};

/** The actions a turn can end on, as the metrics name them. */
const ACTION_COMMANDS = new Set([
  'buildBabel',
  'buildHarvester',
  'buildTower',
  'buildWalls',
  'muster',
  'attack',
  'buyScheme',
  'barter',
  'pass',
]);

const gainedFrom = (events: readonly GameEvent[], me: PlayerId, resource: ResourceType) =>
  events.some(
    (event) =>
      (event.type === 'resourcesGained' &&
        event.player === me &&
        event.resource === resource) ||
      (event.type === 'bartered' && event.player === me && event.gained === resource),
  );

/**
 * Play one unattended game and record it.
 *
 * Every decision comes from `@babel-game/game-ai` — the same policy the web app
 * plays against — so a harness result is evidence about the AI a person will
 * actually meet, not about a second implementation that only exists here.
 */
export function playGame(
  variant: Variant,
  seed: string,
  archetypes: readonly Archetype[] = CLASSIC_TABLE,
  /* `rounds` exists for tests, which need the machinery exercised rather than
     whole games played: one full game is ~200 turns and blocks for seconds. */
  options: { readonly rounds?: number } = {},
): GameRecord {
  const cap = options.rounds ?? ROUND_CAP;
  let state = setupGame(archetypes, `${variant.id}:${seed}`, variant.rules);
  const seats = Object.fromEntries(
    state.order.map((id, i) => [id, archetypes[i % archetypes.length]!]),
  ) as AiSeats;
  const rand = aiRandom(`${variant.id}:${seed}`);

  const turns: TurnRecord[] = [];
  const stageRounds: Partial<Record<Stage, number>> = { 1: 1 };
  const reserveTaken: TerrainType[] = [];
  let reserveDead = 0;

  while (state.phase !== 'gameOver' && state.round <= cap) {
    const table = tableCommand(state, rand);
    if (table) {
      state = applyMove(state, table).state;
      continue;
    }

    /* A turn: everything the active seat does between its draw and the hand-off
       to the next Leader. Recorded as one unit, because that is the grain the
       Milestone 6 metrics are defined at. */
    const me = currentPlayer(state);
    const round = state.round;
    const archetype = seats[me]!;
    const wanted = want(state, me, archetype);
    const before = state.log.length;
    let action = 'pass';
    let swap: 'kept' | number | null = state.rules.reserveSlots > 0 ? 'kept' : null;

    let guard = 0;
    while (state.phase === 'turns' && currentPlayer(state) === me) {
      const command = nextCommand(state, seats, rand);
      if (!command) break;
      if (command.type === 'swapReserve') {
        swap = command.slot;
        reserveTaken.push(state.reserve[command.slot]!.terrain);
      }
      if (ACTION_COMMANDS.has(command.type)) action = command.type;
      state = applyMove(state, command).state;
      if (++guard > 24) throw new Error(`turn did not end for ${me}`);
    }
    if (guard === 0) throw new Error(`the AI had nothing to do on ${me}'s turn`);

    const produced = state.log.slice(before);
    const placed = produced.find((event) => event.type === 'tilePlaced');
    for (const event of produced) {
      if (event.type === 'stageEscalated' && stageRounds[event.to] === undefined) {
        stageRounds[event.to] = round;
      }
      if (event.type === 'reserveRefreshed' && event.reason === 'dead') {
        reserveDead += event.tiles.length;
      }
    }

    turns.push({
      round,
      player: me,
      archetype,
      action,
      wanted,
      satisfied: wanted !== null && gainedFrom(produced, me, wanted),
      swap,
      placed: placed?.type === 'tilePlaced' ? placed.terrain : null,
    });
  }

  /* Settle whatever the cap interrupted, so the final state is coherent. */
  for (let i = 0; i < 8; i++) {
    const command = tableCommand(state, rand);
    if (!command) break;
    state = applyMove(state, command).state;
  }

  const outcome: Outcome =
    state.phase !== 'gameOver' ? 'timeout' : state.lossReason ? 'loss' : 'win';

  return {
    variant: variant.id,
    seed,
    outcome,
    rounds: state.round,
    winner: state.winner,
    seats,
    prestige: Object.fromEntries(state.order.map((id) => [id, state.leaders[id]!.prestige])),
    finalResources: Object.fromEntries(
      state.order.map((id) => [
        id,
        Object.fromEntries(
          RESOURCE_TYPES.map((r) => [r, state.leaders[id]!.resources[r]]),
        ) as Record<ResourceType, number>,
      ]),
    ),
    stageRounds,
    babelPieces: state.babel.stack.length,
    turns,
    events: state.log,
    reserveDead,
    reserveTaken,
  };
}
