import type {
  ActionCategory,
  ConfusionId,
  HostKind,
  SchemeId,
  StructureType,
  ResourceType,
  RiverShape,
  RuleSet,
  Stage,
  TerrainType,
} from '@babel-game/game-data';
import type { Coord, Rotation } from '../map/edges.js';
import type { WallEdge } from '../walls/index.js';
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

/** GDD §3: land is communal, buildings are player-owned, one per land tile. */
export type Building = {
  readonly type: StructureType;
  readonly owner: PlayerId;
};

/**
 * GDD §12. `stack` holds the Leader who built each piece, oldest first, so
 * Heaven removes the most recently built piece by popping the end.
 */
export type BabelState = {
  readonly stack: readonly PlayerId[];
};

/**
 * A Heavenly unit on the board. GDD §14: Heavenly units are physical, unlike
 * the players' abstract Armies.
 */
export type Host = {
  readonly id: string;
  readonly kind: HostKind;
  readonly at: Coord;
  /** GDD §14: a Seraph's Shield, once broken, stays broken between turns. */
  readonly shieldUp: boolean;
};

/** An Attack that has rolled but not yet assigned its successful dice. */
export type PendingAttack = {
  readonly player: PlayerId;
  readonly rolls: readonly number[];
  readonly defence: number;
  /** How many dice beat the Host Defence and are waiting to be assigned. */
  readonly successes: number;
};

export type LeaderState = {
  readonly id: PlayerId;
  readonly name: string;
  readonly resources: Readonly<Record<ResourceType, number>>;
  readonly prestige: number;
  /** GDD §15. Army size is a count of d6 attack dice. */
  readonly army: number;
  /** Hidden from other players. GDD §18. */
  readonly schemeHand: readonly SchemeId[];
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
  /** Permanent difficulty Stage. GDD §12: escalation never reverses. */
  readonly stage: Stage;
  readonly phase: Phase;
  readonly turnStep: TurnStep;
  readonly order: readonly PlayerId[];
  readonly currentPlayerIndex: number;
  readonly firstPlayerIndex: number;
  readonly leaders: Readonly<Record<PlayerId, LeaderState>>;
  readonly board: Readonly<Record<string, PlacedTile>>;
  readonly buildings: Readonly<Record<string, Building>>;
  readonly babel: BabelState;
  /** GDD §13: where Heaven descends into the world. */
  /** GDD §17: temporary barricades on edges between land tiles. */
  readonly walls: readonly WallEdge[];
  readonly beacons: readonly Coord[];
  readonly hosts: readonly Host[];
  readonly pendingBeacon: { readonly sites: readonly Coord[] } | null;
  readonly pendingAttack: PendingAttack | null;
  /** GDD §19: the Confusion card in force this round, and who cancelled it. */
  readonly confusion: {
    readonly card: ConfusionId | null;
    readonly cancelledBy: PlayerId | null;
  };
  readonly confusionDeck: readonly ConfusionId[];
  readonly confusionDiscard: readonly ConfusionId[];
  readonly schemeDeck: readonly SchemeId[];
  readonly schemeDiscard: readonly SchemeId[];
  /** Which Leader has taken each action this round. For Fractured Command. */
  readonly actionsThisRound: Readonly<Partial<Record<ActionCategory, PlayerId>>>;
  /**
   * Set after a Leader acts while holding Frenzied Works: the turn waits for
   * them to play it or end the turn. GDD §18.
   */
  readonly bonusWindow: PlayerId | null;
  /** True while the Leader is taking the extra action Frenzied Works granted. */
  readonly inBonusAction: boolean;
  /** A Host redirected this Heaven Phase by False Prophet. GDD §18. */
  readonly falseProphet: { readonly hostId: string; readonly to: Coord } | null;
  /** Monotonic counter giving each spawned Host a unique id. */
  readonly hostSeq: number;
  /** The tile drawn at the start of the current turn, awaiting placement. */
  readonly drawnTile: TileDraw | null;
  /**
   * Face-up communal tiles the current Leader may swap their draw for, free
   * and outside their action. Empty under canon rules. Milestone 6.
   */
  readonly reserve: readonly TileDraw[];
  readonly pendingVote: PendingVote | null;
  /**
   * The rules this game is being played under, fixed at setup. Carried in the
   * state so a replay reproduces the variant it was recorded under, and so a
   * harness can compare variants without forking the core.
   */
  readonly rules: RuleSet;
  readonly rng: RngState;
  readonly log: readonly GameEvent[];
  readonly winner: PlayerId | null;
  /** Set when humanity loses. GDD §2: the two-step Foundation breach. */
  readonly lossReason: 'foundationBreached' | null;
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
      readonly source: 'placement' | 'harvest';
    }
  /** GDD §10: the placement fell inside an occupied feature. */
  | {
      readonly type: 'payoutSuppressed';
      readonly player: PlayerId;
      readonly at: Coord;
      readonly reason: 'featureOccupied' | 'lostLedgers';
    }
  | { readonly type: 'actionTaken'; readonly player: PlayerId; readonly action: string }
  /** GDD §9: foreign harvesting buildings paid out on someone else's placement. */
  | {
      readonly type: 'harvestTriggered';
      readonly placer: PlayerId;
      readonly owners: readonly PlayerId[];
      readonly resource: ResourceType;
      readonly amount: number;
      readonly placerBonus: number;
    }
  | {
      readonly type: 'buildingConstructed';
      readonly player: PlayerId;
      readonly at: Coord;
      readonly building: StructureType;
    }
  | {
      readonly type: 'babelPieceBuilt';
      readonly player: PlayerId;
      readonly stage: Stage;
      readonly pieces: number;
    }
  /** GDD §12: reaching the end of a Stage escalates Heaven permanently. */
  | { readonly type: 'stageEscalated'; readonly from: Stage; readonly to: Stage }
  | {
      readonly type: 'bartered';
      readonly player: PlayerId;
      readonly spent: readonly ResourceType[];
      readonly gained: ResourceType;
    }
  | {
      readonly type: 'prestigeGained';
      readonly player: PlayerId;
      readonly amount: number;
      readonly source: 'babel' | 'building' | 'combat' | 'tower' | 'walls';
    }
  /** GDD §2: humanity completes Babel; highest Prestige wins individually. */
  | { readonly type: 'humanityWins'; readonly topPrestige: readonly PlayerId[] }
  | { readonly type: 'turnEnded'; readonly player: PlayerId }
  | { readonly type: 'heavenPhase'; readonly round: number }
  | { readonly type: 'beaconPlaced'; readonly at: Coord; readonly total: number }
  /** RD-009: a Beacon was owed but the map offered nowhere legal to put it. */
  | { readonly type: 'beaconDeferred'; readonly owed: number }
  | {
      readonly type: 'hostSpawned';
      readonly id: string;
      readonly kind: HostKind;
      readonly at: Coord;
    }
  | {
      readonly type: 'hostMoved';
      readonly id: string;
      readonly from: Coord;
      readonly to: Coord;
      /** True when several equally short routes existed and one was chosen. */
      readonly hadChoice: boolean;
    }
  /** GDD §2: a Host reached Babel and knocked off its newest piece. */
  | {
      readonly type: 'babelPieceLost';
      readonly builtBy: PlayerId;
      readonly remaining: number;
    }
  | { readonly type: 'foundationOccupied'; readonly hostId: string }
  | { readonly type: 'humanityLoses'; readonly reason: 'foundationBreached' }
  | {
      readonly type: 'attackRolled';
      readonly player: PlayerId;
      readonly rolls: readonly number[];
      readonly defence: number;
      readonly successes: number;
    }
  | {
      readonly type: 'hostHit';
      readonly player: PlayerId;
      readonly id: string;
      readonly shieldBroken: boolean;
    }
  | { readonly type: 'hostKilled'; readonly player: PlayerId; readonly id: string }
  | { readonly type: 'mustered'; readonly player: PlayerId; readonly army: number }
  | { readonly type: 'confusionRevealed'; readonly card: ConfusionId }
  | {
      readonly type: 'confusionCancelled';
      readonly card: ConfusionId;
      readonly player: PlayerId;
    }
  | { readonly type: 'confusionAdded'; readonly cards: readonly ConfusionId[] }
  | { readonly type: 'schemeBought'; readonly player: PlayerId }
  | {
      readonly type: 'schemePlayed';
      readonly player: PlayerId;
      readonly scheme: SchemeId;
    }
  | { readonly type: 'schemeDeckEmpty' }
  /** Milestone 6: the Leader traded their blind draw for a Reserve tile. */
  | {
      readonly type: 'reserveSwapped';
      readonly player: PlayerId;
      readonly took: TileDraw;
      readonly gave: TileDraw;
    }
  /**
   * The Reserve was topped up: `filled` on the opening deal or after a swap,
   * `dead` when a tile that could no longer be placed anywhere was discarded.
   */
  | {
      readonly type: 'reserveRefreshed';
      readonly tiles: readonly TileDraw[];
      readonly reason: 'filled' | 'dead';
    }
  | {
      readonly type: 'wallsBuilt';
      readonly player: PlayerId;
      readonly edges: readonly WallEdge[];
    }
  /** GDD §17: crossing costs the Host its movement and destroys the Wall. */
  | {
      readonly type: 'wallBroken';
      readonly hostId: string;
      readonly edge: WallEdge;
    }
  /** GDD §16: a Tower in an occupied feature adds one targeted support die. */
  | {
      readonly type: 'towerSupport';
      readonly owner: PlayerId;
      readonly at: Coord;
      readonly roll: number;
      readonly defence: number;
      readonly hit: boolean;
      readonly targetId: string | null;
    }
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
  /**
   * Milestone 6: trade the blind draw for a face-up Reserve tile. Free, before
   * placing, and not the turn's action.
   */
  | { readonly type: 'swapReserve'; readonly player: PlayerId; readonly slot: number }
  /** GDD §11: exactly one of these per turn, after the tile is placed. */
  | {
      readonly type: 'buildHarvester';
      readonly player: PlayerId;
      readonly at: Coord;
      readonly building: StructureType;
    }
  | { readonly type: 'buildTower'; readonly player: PlayerId; readonly at: Coord }
  | {
      readonly type: 'buildWalls';
      readonly player: PlayerId;
      readonly edges: readonly WallEdge[];
    }
  | { readonly type: 'buildBabel'; readonly player: PlayerId }
  | {
      readonly type: 'barter';
      readonly player: PlayerId;
      readonly spend: readonly ResourceType[];
      readonly gain: ResourceType;
    }
  | { readonly type: 'muster'; readonly player: PlayerId }
  | { readonly type: 'attack'; readonly player: PlayerId }
  /** Assign successful dice among Hosts after rolling. GDD §15. */
  | {
      readonly type: 'assignHits';
      readonly player: PlayerId;
      readonly assignments: Readonly<Record<string, number>>;
    }
  | { readonly type: 'pass'; readonly player: PlayerId }
  | { readonly type: 'buyScheme'; readonly player: PlayerId }
  /** GDD §18. False Prophet also carries the Host and the square it is sent to. */
  | {
      readonly type: 'playScheme';
      readonly player: PlayerId;
      readonly scheme: SchemeId;
      readonly hostId?: string;
      readonly to?: Coord;
    }
  /** Decline the Frenzied Works window, or the Confusion window. */
  | { readonly type: 'endTurn'; readonly player: PlayerId }
  | { readonly type: 'beginRound'; readonly player: PlayerId }
  /** Collective decisions, issuable by any Leader. See RD-008. */
  | { readonly type: 'placeBeacon'; readonly player: PlayerId; readonly at: Coord }
  | {
      readonly type: 'resolveHeaven';
      readonly player: PlayerId;
      /** Optional override of the default route for each Host. */
      readonly plan?: Readonly<Record<string, readonly Coord[]>>;
    }
  | { readonly type: 'castVote'; readonly player: PlayerId; readonly option: number };

export type ApplyResult = {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
};
