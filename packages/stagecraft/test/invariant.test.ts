import { describe, expect, it } from 'vitest';
import { applyMove, setupGame, type GameState } from '@babel-game/game-core';
import { CANON_RULES, CANON_WALLS, ROLLED_HEAVEN, type RuleSet } from '@babel-game/game-data';
import { ARCHETYPES, aiRandom, nextCommand, tableCommand, type AiSeats } from '@babel-game/game-ai';
import { direct, heldFor } from '../src/index.js';

const TEMPO = heldFor(120);

/** The same archetypes a person meets when they add machine Leaders. */
const seatsFor = (order: readonly string[]): AiSeats =>
  Object.fromEntries(
    order.map((id, i) => [id, ARCHETYPES[i % ARCHETYPES.length]!]),
  ) as AiSeats;

type Run = {
  readonly commands: number;
  readonly beats: number;
  readonly failures: readonly string[];
};

/**
 * Play a whole game and direct every single transition in it.
 *
 * This is the guarantee the animation layer rests on: whatever the rules do,
 * folding the events they emit back over the state they started from has to
 * reproduce the state they ended at. A game is a few hundred commands, and
 * every one of them is checked.
 */
function playAndDirect(seed: string, rules: RuleSet, rounds: number): Run {
  const names = ['Ada', 'Peter', 'Rook'];
  let state = setupGame(names, seed, rules);
  const seats = seatsFor(state.order);
  const rand = aiRandom(seed);

  const failures: string[] = [];
  let commands = 0;
  let beats = 0;

  while (state.phase !== 'gameOver' && state.round <= rounds) {
    const command = tableCommand(state, rand) ?? nextCommand(state, seats, rand);
    if (!command) break;

    const before = state;
    const { state: after, events } = applyMove(before, command);
    const script = direct(before, events, after, TEMPO);

    commands += 1;
    beats += script.beats.length - 1;
    if (script.degraded) {
      failures.push(`${command.type} @ round ${before.round}: ${script.drift}`);
    }
    /* The screen must always be able to come to rest on the truth. */
    if (script.beats.at(-1)!.frame !== after) {
      failures.push(`${command.type} @ round ${before.round}: did not end on the real state`);
    }

    state = after;
  }

  return { commands, beats, failures };
}

describe('every transition the rules can produce', () => {
  it('folds back into the state the rules produced, under canon', () => {
    const run = playAndDirect('invariant-canon', CANON_RULES, 40);

    expect(run.failures).toEqual([]);
    expect(run.commands).toBeGreaterThan(100);
    expect(run.beats).toBeGreaterThan(50);
  });

  it('folds back under the rolled Heaven table, where the odd Hosts live', () => {
    /* Colossus, Swarm, Herald and Warded only appear under v0.3's table, and
       they are the ones that raze buildings and split when killed. */
    const rules: RuleSet = { ...CANON_RULES, heavenSpawn: ROLLED_HEAVEN };
    const run = playAndDirect('invariant-rolled', rules, 40);

    expect(run.failures).toEqual([]);
    expect(run.commands).toBeGreaterThan(100);
  });

  it('holds across a spread of seeds', () => {
    const failures = ['a', 'b', 'c', 'd', 'e'].flatMap(
      (seed) => playAndDirect(`spread-${seed}`, { ...CANON_RULES, heavenSpawn: ROLLED_HEAVEN }, 25).failures,
    );

    expect(failures).toEqual([]);
  });
});

/** Every scene-moving event must actually be seen during those games. */
describe('coverage', () => {
  /** Every event type one game produced. */
  function eventsIn(seed: string, rules: RuleSet): Set<string> {
    const seen = new Set<string>();
    let state: GameState = setupGame(['Ada', 'Peter', 'Rook'], seed, rules);
    const seats = seatsFor(state.order);
    const rand = aiRandom(seed);

    while (state.phase !== 'gameOver' && state.round <= 60) {
      const command = tableCommand(state, rand) ?? nextCommand(state, seats, rand);
      if (!command) break;
      const { state: after, events } = applyMove(state, command);
      for (const event of events) seen.add(event.type);
      state = after;
    }
    return seen;
  }

  it('exercises the events the board cares about', () => {
    /**
     * Unioned across seeds, not read off one game.
     *
     * A single seed makes this test a hostage to every rule change: the agents
     * are not obliged to reach for a given action in a given game, so one
     * placement decided differently three rounds in can take a whole event type
     * off the board. v0.4's river rule did exactly that to `wallsBuilt`.
     *
     * Walls themselves left canon in v0.4, but the Director and the board still
     * draw `wallsBuilt` and `wallBroken` for a table that has switched them back
     * on. What is covered here is the board's event vocabulary, not canon's
     * action list, so the run turns them on.
     */
    const rules: RuleSet = {
      ...CANON_RULES,
      heavenSpawn: ROLLED_HEAVEN,
      walls: CANON_WALLS,
    };
    const seen = new Set<string>();
    for (const seed of ['coverage', 'coverage-b', 'coverage-c', 'coverage-d']) {
      for (const type of eventsIn(seed, rules)) seen.add(type);
    }

    for (const type of [
      'tilePlaced',
      'buildingConstructed',
      'wallsBuilt',
      'babelPieceBuilt',
      'beaconPlaced',
      'hostSpawned',
      'hostMoved',
      'hostKilled',
    ]) {
      expect(seen, `never saw ${type}`).toContain(type);
    }
  });
});
