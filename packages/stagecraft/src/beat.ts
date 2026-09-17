import type { Coord, GameEvent, GameState } from '@babel-game/game-core';

/**
 * What sort of moment a beat is.
 *
 * The kind decides two things and nothing else: how long the screen sits on it
 * (the tempo below) and how the board draws attention to it. It is not a
 * second copy of the event type — several events share a kind where they want
 * the same treatment.
 */
export type SpotKind =
  | 'tile'
  | 'build'
  | 'walls'
  | 'babel'
  | 'babelLost'
  | 'razed'
  | 'beacon'
  | 'heaven'
  | 'spawn'
  | 'march'
  | 'wallBroken'
  | 'dice'
  | 'tower'
  | 'shield'
  | 'slain'
  | 'split'
  | 'foundation'
  | 'confusion'
  | 'cancel'
  | 'stage'
  | 'scheme'
  | 'win'
  | 'loss';

/**
 * What this beat is about.
 *
 * It carries the event that caused it rather than a sentence, so the words on
 * screen come from the same place the log's words come from. A caption and a
 * log line that disagree are worse than either alone.
 */
export type Spotlight = {
  readonly kind: SpotKind;
  readonly cause: GameEvent;
  /** Squares the eye should go to. */
  readonly at: readonly Coord[];
  /** Hosts the eye should go to. */
  readonly hostIds: readonly string[];
};

/** One held moment: a whole world, what to look at, and for how long. */
export type Beat = {
  readonly frame: GameState;
  readonly spot: Spotlight | null;
  readonly hold: number;
};

export type Script = {
  /**
   * The beats to play, always ending with a zero-hold beat whose frame is the
   * state the command actually produced. A consumer that shows the live state
   * when its queue drains can drop that last one.
   */
  readonly beats: readonly Beat[];
  /**
   * True when the director could not reproduce the transition and cut straight
   * to the end rather than show a world that never existed.
   */
  readonly degraded: boolean;
  /** Why, when it degraded. Null otherwise. */
  readonly drift: string | null;
};

export type Tempo = Readonly<Record<SpotKind, number>>;

/** One tempo where every kind of moment is held for the same time. */
export const heldFor = (ms: number): Tempo => ({
  tile: ms,
  build: ms,
  walls: ms,
  babel: ms,
  babelLost: ms,
  razed: ms,
  beacon: ms,
  heaven: ms,
  spawn: ms,
  march: ms,
  wallBroken: ms,
  dice: ms,
  tower: ms,
  shield: ms,
  slain: ms,
  split: ms,
  foundation: ms,
  confusion: ms,
  cancel: ms,
  stage: ms,
  scheme: ms,
  win: ms,
  loss: ms,
});

/**
 * Nothing is held.
 *
 * The stage is fully wired under this tempo and shows exactly what it showed
 * before there was a stage at all, which is what makes it safe to land the
 * plumbing on its own.
 */
export const STILL: Tempo = heldFor(0);
