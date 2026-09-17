import { useEffect, useMemo, useRef } from 'react';
import type { Command, GameState, PlayerId } from '@babel-game/game-core';
import { ARCHETYPES, aiRandom, nextCommand, type AiSeats } from '@babel-game/game-ai';

/** How long an AI "thinks" once the screen has finished the last turn. */
const THINK_MS = 550;

/**
 * Work out which seats the machine plays.
 *
 * Humans take the first seats and the AI fills the rest, so seat 0 is always a
 * person unless every Leader is a bot. Archetypes are dealt round-robin, which
 * keeps a 3-Leader table to one of each.
 */
export function aiSeatsFor(order: readonly PlayerId[], aiCount: number): AiSeats {
  const first = Math.max(0, order.length - aiCount);
  return Object.fromEntries(
    order.slice(first).map((id, i) => [id, ARCHETYPES[i % ARCHETYPES.length]!]),
  );
}

/**
 * Let the AI Leaders take their turns.
 *
 * One command per tick rather than a whole turn at once: a person needs to see
 * the tile land before the action that follows it, and a single `setState` per
 * command keeps the board animating through the sequence.
 *
 * Table decisions — siting a Beacon, resolving the Heaven Phase, the Confusion
 * window — are deliberately left alone. They belong to everyone at the table
 * (RD-005, RD-008), so the human keeps them even when every other seat is a
 * bot. The AI only ever answers for its own turn.
 *
 * `ready` is how the bots wait for the screen: while the stage is still
 * playing out the last turn, nothing is scheduled, so a machine Leader can
 * never talk over the story being told about the one before it.
 */
export function useAiTurns(
  state: GameState,
  seats: AiSeats,
  seed: string,
  onCommand: (command: Command) => void,
  ready = true,
): void {
  /* One generator per game, so the bots' tie-breaks do not reset every render
     and replay the same choice forever. */
  const rand = useMemo(() => aiRandom(seed), [seed]);
  const latest = useRef(onCommand);
  latest.current = onCommand;

  useEffect(() => {
    if (!ready) return;
    if (Object.keys(seats).length === 0) return;
    const command = nextCommand(state, seats, rand);
    if (!command) return;

    const timer = setTimeout(() => latest.current(command), THINK_MS);
    return () => clearTimeout(timer);
  }, [state, seats, rand, ready]);
}
