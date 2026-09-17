import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent, GameState } from '@babel-game/game-core';
import { STILL, direct, type Beat, type Spotlight, type Tempo } from '@babel-game/stagecraft';

/**
 * Whether this person has asked for less movement.
 *
 * Read live rather than once, because it can change under a running game, and
 * a setting that only takes effect on reload is a setting that does not work.
 */
function useStillness(): boolean {
  const [still, setStill] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const listen = () => setStill(query.matches);
    query.addEventListener('change', listen);
    return () => query.removeEventListener('change', listen);
  }, []);

  return still;
}

export type Stage = {
  /** The world to draw right now: a held frame, or the live state. */
  readonly view: GameState;
  /** What this moment is about, for whatever wants to say so. */
  readonly spot: Spotlight | null;
  /** True while the screen is behind the rules. */
  readonly busy: boolean;
  /** How long this beat is being held, so a transition can match it. */
  readonly hold: number;
  /** Give up on the story and show the present. */
  readonly skip: () => void;
  /** Hand the stage a transition to play. */
  readonly play: (before: GameState, events: readonly GameEvent[], after: GameState) => void;
};

/**
 * The queue of held frames between the rules and the screen.
 *
 * The game state is never waiting on this. A command applies immediately and
 * `live` is already the truth; the stage only decides how much of the way
 * there the screen has got. That is why draining the queue is always safe, and
 * why every interruption below simply drains it.
 */
export function useStage(live: GameState, tempo: Tempo = STILL): Stage {
  const [queue, setQueue] = useState<readonly Beat[]>([]);
  const still = useStillness();
  const tempoNow = useRef(tempo);
  tempoNow.current = still ? STILL : tempo;

  const current = queue[0] ?? null;
  const busy = current !== null;

  /* Hold this beat for its own time, then move on. */
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setQueue((rest) => rest.slice(1)), current.hold);
    return () => clearTimeout(timer);
  }, [current]);

  const skip = useCallback(() => setQueue([]), []);

  /**
   * A player who already knows what happened must never be made to wait for
   * the screen to finish telling them. Any input at all is enough to say so.
   */
  useEffect(() => {
    if (!busy) return;
    window.addEventListener('pointerdown', skip, true);
    window.addEventListener('keydown', skip, true);
    return () => {
      window.removeEventListener('pointerdown', skip, true);
      window.removeEventListener('keydown', skip, true);
    };
  }, [busy, skip]);

  const play = useCallback(
    (before: GameState, events: readonly GameEvent[], after: GameState) => {
      const script = direct(before, events, after, tempoNow.current);
      /* The last beat is the live state, which is what shows when the queue
         runs dry, so only the held ones need queueing. */
      const held = script.beats.filter((beat) => beat.hold > 0);
      if (held.length > 0) setQueue((rest) => [...rest, ...held]);
    },
    [],
  );

  return {
    view: current?.frame ?? live,
    spot: current?.spot ?? null,
    hold: current?.hold ?? 0,
    busy,
    skip,
    play,
  };
}
