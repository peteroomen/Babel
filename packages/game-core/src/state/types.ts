import type { ResourceType, RiverShape, TerrainType } from '@babel-game/game-data';
import type { Coord, Rotation } from '../map/edges.js';
import type { RngState } from '../rng/index.js';

export type PlayerId = string;

/** GDD §11. A round is: reveal Confusion, all player turns, Heaven Phase. */
export type Phase = 'confusion' | 'turns' | 'heaven' | 'gameOver';

/** GDD §11 turn structure: draw, place, resolve, then exactly one action. */
export type TurnStep = 'place' | 'action';

/** A tile as drawn from the bag, before the player chooses a rotation. */
export type TileDraw = {
  readonly terrain: TerrainType;
  readonly river: RiverShape;
};

/** A tile on the board. River edges are derived from shape + rotation. */
export type PlacedTile = TileDraw & { readonly rotation: Rotation };

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
 * See RD-005: majority, ties broken by a seeded coin flip.
 */
export type PendingVote = {
  readonly id: string;
  readonly question: string;
  readonly options: readonly string[];
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
  readonly drawnTile: TileDraw | null;
  /**
   * Coordinate keys currently holding a Host. GDD §10 shuts down the whole
   * connected feature. Populated by the Heaven Phase in Milestone 3.
   */
  readonly occupiedTiles: readonly string[];
  readonly pendingVote: PendingVote | null;
  readonly rng: RngState;
  readonly log: readonly GameEvent[];
  readonly winner: PlayerId | null;
};

export type GameEvent =
  | { readonly type: 'roundStarted'; readonly round: number }
  | {
      readonly type: 'tileDrawn';
      readonly player: PlayerId;
      readonly terrain: TerrainType;
      readonly river: RiverShape;
    }
  /** RD-002: drawn tile had no legal placement in any rotation. */
  | {
      readonly type: 'tileDiscarded';
      readonly player: PlayerId;
      readonly terrain: TerrainType;
      readonly river: RiverShape;
      readonly reason: 'noLegalPlacement';
    }
  | {
      readonly type: 'tilePlaced';
      readonly player: PlayerId;
      readonly at: Coord;
      readonly terrain: TerrainType;
      readonly river: RiverShape;
      readonly rotation: Rotation;
    }
  | {
      readonly type: 'resourcesGained';
      readonly player: PlayerId;
      readonly resource: ResourceType;
      readonly amount: number;
      readonly source: 'placement';
    }
  /** GDD §10: the placement fell inside an occupied feature. */
  | {
      readonly type: 'payoutSuppressed';
      readonly player: PlayerId;
      readonly at: Coord;
      readonly reason: 'featureOccupied';
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
      readonly byCoinFlip: boolean;
    };

export type Command =
  | {
      readonly type: 'placeTile';
      readonly player: PlayerId;
      readonly at: Coord;
      readonly rotation: Rotation;
    }
  | { readonly type: 'takeAction'; readonly player: PlayerId; readonly action: string }
  | { readonly type: 'castVote'; readonly player: PlayerId; readonly option: number };

export type ApplyResult = {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
};
