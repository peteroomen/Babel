import type { ResourceType, TerrainType } from '@babel-game/game-data';
import type { RngState } from '../rng/index.js';

export type PlayerId = string;

/** GDD §11. A round is: reveal Confusion, all player turns, Heaven Phase. */
export type Phase = 'confusion' | 'turns' | 'heaven' | 'gameOver';

/** GDD §11 turn structure: draw, place, resolve, then exactly one action. */
export type TurnStep = 'place' | 'action';

export type Coord = { readonly x: number; readonly y: number };

export type PlacedTile = {
  readonly terrain: TerrainType;
  /** Which of the tile's four edges carry river geometry, after rotation. */
  readonly riverEdges: readonly Edge[];
};

export type Edge = 'n' | 'e' | 's' | 'w';

export type LeaderState = {
  readonly id: PlayerId;
  readonly name: string;
  readonly resources: Readonly<Record<ResourceType, number>>;
  readonly prestige: number;
  /** GDD §15. Army size is a count of d6 attack dice. */
  readonly army: number;
  /** Hidden from other players. GDD §18. */
  readonly schemeHand: readonly string[];
};

/**
 * A decision the table makes together rather than the active player.
 *
 * GDD §13 (Beacon siting) and §14 (choosing between equally short Host routes)
 * both say "the players choose" without naming an arbiter. That is fine at a
 * kitchen table and in hot-seat; it is not implementable over a network. The
 * resolution rule adopted here is majority vote, ties broken by a seeded coin
 * flip, so the outcome stays deterministic and replayable.
 */
export type PendingVote = {
  readonly id: string;
  readonly question: string;
  readonly options: readonly string[];
  /** Ballots cast so far, by player. Resolves once every leader has voted. */
  readonly votes: Readonly<Record<PlayerId, number>>;
};

export type GameState = {
  readonly round: number;
  readonly stage: 1 | 2 | 3;
  readonly phase: Phase;
  readonly turnStep: TurnStep;
  readonly order: readonly PlayerId[];
  readonly currentPlayerIndex: number;
  readonly firstPlayerIndex: number;
  readonly leaders: Readonly<Record<PlayerId, LeaderState>>;
  readonly board: Readonly<Record<string, PlacedTile>>;
  /** The tile drawn at the start of the current turn, awaiting placement. */
  readonly drawnTile: TerrainType | null;
  readonly pendingVote: PendingVote | null;
  readonly rng: RngState;
  readonly log: readonly GameEvent[];
  readonly winner: PlayerId | null;
};

export type GameEvent =
  | { readonly type: 'roundStarted'; readonly round: number }
  | { readonly type: 'tileDrawn'; readonly player: PlayerId; readonly terrain: TerrainType }
  | {
      readonly type: 'tilePlaced';
      readonly player: PlayerId;
      readonly at: Coord;
      readonly terrain: TerrainType;
    }
  | { readonly type: 'actionTaken'; readonly player: PlayerId; readonly action: string }
  | { readonly type: 'turnEnded'; readonly player: PlayerId }
  | { readonly type: 'heavenPhase'; readonly round: number }
  | { readonly type: 'voteOpened'; readonly id: string; readonly question: string }
  | { readonly type: 'voteCast'; readonly id: string; readonly player: PlayerId }
  | {
      readonly type: 'voteResolved';
      readonly id: string;
      readonly choice: string;
      /** True when the majority tied and the seeded coin flip decided it. */
      readonly byCoinFlip: boolean;
    };

export type Command =
  | { readonly type: 'placeTile'; readonly player: PlayerId; readonly at: Coord }
  | { readonly type: 'takeAction'; readonly player: PlayerId; readonly action: string }
  | { readonly type: 'castVote'; readonly player: PlayerId; readonly option: number };

export type ApplyResult = {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
};

export const coordKey = (c: Coord): string => `${c.x},${c.y}`;
