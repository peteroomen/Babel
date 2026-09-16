/**
 * Heaven's forces. GDD §14 (movement), §15 (combat), §0 / ART_DIRECTION
 * (the two silhouettes the first playable keeps to).
 */
export const HOST_KINDS = ['ophanim', 'seraph', 'zealot', 'flier'] as const;
export type HostKind = (typeof HOST_KINDS)[number];

export type HostSpec = {
  /** Tiles moved per Heaven Phase. */
  readonly movement: number;
  /** Successful hits needed to kill, including breaking any Shield. */
  readonly hits: number;
  /** GDD §14: a Seraph's first hit removes its Shield and stays removed. */
  readonly shield: boolean;
  /** Added to this Host's Defence, so a tougher kind needs a higher roll. */
  readonly defence: number;
  /** Rivers and Lakes do not stop it. Everything on foot they do. */
  readonly flies: boolean;
  readonly label: string;
};

export const HOSTS: Record<HostKind, HostSpec> = {
  ophanim: { movement: 1, hits: 1, shield: false, defence: 0, flies: false, label: 'Ophanim Host' },
  seraph: { movement: 2, hits: 2, shield: true, defence: 0, flies: false, label: 'Seraph' },
  /* Armoured rather than fast: two hits and a harder roll, on foot. */
  zealot: { movement: 1, hits: 2, shield: false, defence: 1, flies: false, label: 'Zealot' },
  /* Fast and unblockable rather than tough: one hit, but rivers do not stop it
     and no wall it can simply fly over will either. */
  flier: { movement: 2, hits: 1, shield: false, defence: 1, flies: true, label: 'Throne' },
};

/**
 * GDD §14: at Stage III approximately 25% of newly spawned Hosts are Seraphs.
 * TUNEABLE — the balance pass calls Seraph frequency a tuning parameter, not a
 * separate enemy subsystem.
 */
export const SERAPH_CHANCE_STAGE_III = 0.25;

/** GDD §15: every combat die is d6 + 2, tested against the Host's Defence. */
export const COMBAT_DIE_BONUS = 2;

/**
 * What a Beacon sends, and how often.
 *
 * Beacons are numbered in the order they are sited, so the first Beacon on the
 * board keeps sending the Hosts the table already knows how to fight and the
 * later ones open new problems. `everyNRounds` with an `offset` staggers them,
 * so two slower Beacons alternate rather than arriving together.
 */
export type BeaconTier = {
  readonly kind: HostKind;
  readonly everyNRounds: number;
  readonly offset: number;
  readonly label: string;
};

export const BEACON_TIERS: readonly BeaconTier[] = [
  { kind: 'ophanim', everyNRounds: 1, offset: 0, label: 'Ophanim gate' },
  { kind: 'zealot', everyNRounds: 2, offset: 0, label: 'Zealot gate' },
  { kind: 'flier', everyNRounds: 2, offset: 1, label: 'Throne gate' },
];

/** GDD §15: Muster costs 1 Food + 1 Metal; the intended maximum is 5 dice. */
export const MUSTER_COST = { food: 1, metal: 1 } as const;
export const MAX_ARMY = 5;

/** GDD §15 and §16: Prestige for a kill, and for a Tower support hit. */
export const COMBAT_PRESTIGE = 1;
