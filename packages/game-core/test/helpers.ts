import { expect } from 'vitest';
import {
  applyMove,
  currentPlayer,
  getLegalTilePlacements,
  type Command,
  type GameState,
} from '../src/index.js';

/**
 * Drive the parts of the loop that are not a Leader's own action: siting a
 * Beacon the table owes, and resolving the Heaven Phase at the round boundary.
 * Returns the state unchanged when neither is pending.
 */
export function settleTable(state: GameState): GameState {
  let current = state;
  /* Beacons may be owed one after another, so keep going until none are. */
  while (current.pendingBeacon && current.phase !== 'gameOver') {
    const site = current.pendingBeacon.sites[0];
    if (!site) throw new Error('a Beacon is owed but no legal site exists');
    current = applyMove(current, {
      type: 'placeBeacon',
      player: current.order[0] as string,
      at: site,
    }).state;
  }
  if (current.phase === 'heaven') {
    current = applyMove(current, {
      type: 'resolveHeaven',
      player: current.order[0] as string,
    }).state;
  }
  return current;
}

/** Place the drawn tile at the first legal square, then take `action`. */
export function playTurn(
  state: GameState,
  action?: (s: GameState, player: string) => Command,
): GameState {
  let current = settleTable(state);
  if (current.phase === 'gameOver') return current;

  const me = currentPlayer(current);
  const option = getLegalTilePlacements(current.board, current.drawnTile!)[0];
  if (!option) throw new Error('no legal placement available');

  current = applyMove(current, {
    type: 'placeTile',
    player: me,
    at: option.at,
    rotation: option.rotations[0]!,
  }).state;

  const command = action ? action(current, me) : ({ type: 'pass', player: me } as Command);
  current = applyMove(current, command).state;
  return settleTable(current);
}

/** Run a whole game of pass-only turns, settling Heaven each round. */
export function playRounds(state: GameState, turns: number): GameState {
  let current = state;
  for (let i = 0; i < turns; i++) {
    if (current.phase === 'gameOver') break;
    current = playTurn(current);
  }
  return current;
}

export { expect };
