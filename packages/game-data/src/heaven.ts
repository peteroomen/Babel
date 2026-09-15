/**
 * Heaven's forces. GDD §14 (movement), §15 (combat), §0 / ART_DIRECTION
 * (the two silhouettes the first playable keeps to).
 */
export const HOST_KINDS = ['ophanim', 'seraph'] as const;
export type HostKind = (typeof HOST_KINDS)[number];

export type HostSpec = {
  /** Tiles moved per Heaven Phase. */
  readonly movement: number;
  /** Successful hits needed to kill, including breaking any Shield. */
  readonly hits: number;
  /** GDD §14: a Seraph's first hit removes its Shield and stays removed. */
  readonly shield: boolean;
  readonly label: string;
};

export const HOSTS: Record<HostKind, HostSpec> = {
  ophanim: { movement: 1, hits: 1, shield: false, label: 'Ophanim Host' },
  seraph: { movement: 2, hits: 2, shield: true, label: 'Seraph' },
};

/**
 * GDD §14: at Stage III approximately 25% of newly spawned Hosts are Seraphs.
 * TUNEABLE — the balance pass calls Seraph frequency a tuning parameter, not a
 * separate enemy subsystem.
 */
export const SERAPH_CHANCE_STAGE_III = 0.25;

/** GDD §15: every combat die is d6 + 2, tested against the Host's Defence. */
export const COMBAT_DIE_BONUS = 2;

/** GDD §15: Muster costs 1 Food + 1 Metal; the intended maximum is 5 dice. */
export const MUSTER_COST = { food: 1, metal: 1 } as const;
export const MAX_ARMY = 5;

/** GDD §15 and §16: Prestige for a kill, and for a Tower support hit. */
export const COMBAT_PRESTIGE = 1;
