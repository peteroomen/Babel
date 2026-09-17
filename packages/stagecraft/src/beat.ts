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

/**
 * What the screen currently takes its time over.
 *
 * Only the Heaven Phase, the Attack and the announcements, so far. Those are
 * the moments players have the least information about and the most at stake
 * in, and until now the whole of each one arrived as a single changed picture.
 *
 * The numbers are paced to be read rather than admired, and they are longer
 * where the thing that happened is worse. A Host walking is the shortest beat
 * because there may be a dozen of them in a phase; Babel losing a piece is
 * over a second because it happens once and it hurts. A card that rewrites the
 * round gets long enough to actually read the sentence on it, which is the
 * whole reason it turns over at all.
 *
 * This is the middle setting. `paced` scales the lot for people who want it
 * brisker or slower, and the screen is interruptible at any point regardless.
 */
export const NATURAL: Tempo = {
  ...STILL,
  heaven: 620,
  march: 400,
  spawn: 520,
  wallBroken: 720,
  razed: 850,
  babelLost: 1100,
  foundation: 1200,
  loss: 1400,

  /* An Attack: the dice tumble and come to rest, the Towers fire one at a
     time, and each hit is spent on something you can see it being spent on.
     `dice` has to outlast the roll itself or the tray would change under a die
     that is still turning. */
  tower: 800,
  dice: 1100,
  shield: 850,
  slain: 700,
  split: 950,

  /* The state that changes underneath a player rather than because of them.
     These arrive once and are then lived with, so they are the only beats
     measured in seconds. */
  confusion: 2600,
  cancel: 2000,
  stage: 2600,
  scheme: 2000,
  beacon: 1500,
  win: 2200,
};

/** The same tempo, faster or slower throughout. */
export const scaled = (tempo: Tempo, factor: number): Tempo =>
  Object.fromEntries(
    Object.entries(tempo).map(([kind, ms]) => [kind, Math.round(ms * factor)]),
  ) as Tempo;

/**
 * How long the screen should take, as a person would put it.
 *
 * One number rather than a table of them: what differs between someone who
 * has played fifty games and someone who has played none is not which beats
 * matter, it is how long they need on each.
 */
export type Pace = 'brisk' | 'natural' | 'unhurried';

export const PACE: Readonly<Record<Pace, number>> = {
  brisk: 0.6,
  natural: 1,
  unhurried: 1.7,
};

export const paced = (pace: Pace): Tempo => scaled(NATURAL, PACE[pace]);
