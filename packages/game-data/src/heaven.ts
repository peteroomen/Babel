import type { Stage } from './babel.js';
/**
 * Heaven's forces. GDD §14 (movement), §15 (combat), §0 / ART_DIRECTION
 * (the two silhouettes the first playable keeps to).
 */
export const HOST_KINDS = [
  'ophanim',
  'seraph',
  'zealot',
  'flier',
  'herald',
  'colossus',
  'swarm',
  'warded',
] as const;
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
  /**
   * Threat points a Beacon must save up to send one.
   *
   * This is what keeps the board from filling with bodies: a gate earns points
   * at a fixed rate, so a Host that costs four arrives a quarter as often as
   * one that costs one. Fewer, nastier arrivals out of a single number.
   */
  readonly cost: number;
  /** Defence granted to every *other* Host in the same feature. */
  readonly aura: number;
  /** Stops on the first building it reaches and destroys it. */
  readonly razes: boolean;
  /** Tower support dice cannot target it; only Army dice reach it. */
  readonly wardedFromTowers: boolean;
  /** What it leaves behind when killed, if anything. */
  readonly splitsInto: { readonly kind: 'ophanim'; readonly count: number } | null;
  readonly label: string;
};

const BASE = {
  movement: 1,
  hits: 1,
  shield: false,
  defence: 0,
  flies: false,
  cost: 1,
  aura: 0,
  razes: false,
  wardedFromTowers: false,
  splitsInto: null,
} as const;

export const HOSTS: Record<HostKind, HostSpec> = {
  ophanim: { ...BASE, label: 'Ophanim Host' },
  seraph: { ...BASE, movement: 2, hits: 2, shield: true, cost: 3, label: 'Seraph' },
  /* Armoured rather than fast: two hits and a harder roll, on foot. */
  zealot: { ...BASE, hits: 2, defence: 1, cost: 2, label: 'Zealot' },
  /* Fast and unblockable rather than tough: one hit, but rivers do not stop it
     and no wall it can fly over will either. */
  flier: { ...BASE, movement: 2, defence: 1, flies: true, cost: 2, label: 'Throne' },
  /* Fragile itself, and makes everything standing with it harder to kill. The
     answer is to shoot the Herald first, which is a decision the table does not
     currently have to make. */
  herald: { ...BASE, aura: 2, cost: 2, label: 'Herald' },
  /* Goes after the economy instead of the Tower: it stops at the first building
     it reaches and pulls it down. Ignoring it costs something other than Babel. */
  colossus: { ...BASE, hits: 4, defence: 2, razes: true, cost: 4, label: 'Colossus' },
  /* Punishes chip damage: killing it leaves two Ophanim behind, so it wants
     concentrated fire rather than whatever dice happen to be spare. */
  swarm: { ...BASE, hits: 2, cost: 3, splitsInto: { kind: 'ophanim', count: 3 }, label: 'Swarm' },
  /* Towers cannot touch it. A table that has settled into prepared ground has
     to raise an Army again. */
  warded: { ...BASE, hits: 3, defence: 2, wardedFromTowers: true, cost: 3, label: 'Warded' },
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

/**
 * What Heaven sends, by Stage, as a d6 table.
 *
 * Driven by Babel's Stage rather than by which Beacon a Host comes out of.
 * Stage is the escalation clock the game already has, it is legible on the
 * board — the Tower's height — and it does not care how many Beacons a given
 * player count happens to open. Tying kinds to Beacon identity did: a
 * two-Leader table never opens a third Beacon, so a third kind would never
 * appear at all.
 *
 * Weights sum to 6 at every Stage, so this is one die and one printed table.
 */
export type SpawnEntry = { readonly kind: HostKind; readonly weight: number };

export const SPAWN_TABLE: Record<Stage, readonly SpawnEntry[]> = {
  /* Stage I is what the table already knows how to fight. */
  1: [{ kind: 'ophanim', weight: 6 }],
  /* Stage II introduces the Host that Towers cannot answer. */
  2: [
    { kind: 'ophanim', weight: 4 },
    { kind: 'warded', weight: 2 },
  ],
  /* Stage III opens the rest: something that eats buildings and something that
     punishes chip damage. */
  3: [
    { kind: 'ophanim', weight: 2 },
    { kind: 'warded', weight: 1 },
    { kind: 'herald', weight: 1 },
    { kind: 'colossus', weight: 1 },
    { kind: 'swarm', weight: 1 },
  ],
};

/**
 * How many Hosts arrive each Heaven Phase, by Stage.
 *
 * Deliberately not "one per Beacon". Beacon counts are a player-count scaling
 * value (GDD §4), so hanging the spawn rate off them made the amount of Heaven
 * a side effect of how many people were playing. This is the knob for how
 * crowded the board gets, and it is one number a rulebook can print.
 *
 * 1/2/2 measured at 67% shared wins over 30 games with 1.61 arrivals a round,
 * against 92% and 2.03 for the one-per-Beacon Ophanim spam it replaces. Stage
 * III deliberately does not rise: by then the *composition* is doing the work.
 */
export const ARRIVALS_BY_STAGE: readonly [number, number, number] = [1, 2, 2];

/**
 * Gates for the harder roster, paced by threat points rather than a cadence.
 *
 * The first gate stays the familiar pressure. The rest each pose a problem the
 * table's current answers do not cover, and each is expensive enough to arrive
 * rarely: under a budget of one point a round a Colossus is a once-every-four
 * event rather than another body in the queue.
 */
export const DEEP_BEACON_TIERS: readonly BeaconTier[] = [
  /* Order matters more than it looks: a 3-Leader table only ever opens three
     Beacons, so anything past the third gate never appears at that count. The
     first three are therefore the ones that have to carry the variety. */
  { kind: 'ophanim', everyNRounds: 1, offset: 0, label: 'Ophanim gate' },
  { kind: 'colossus', everyNRounds: 1, offset: 0, label: 'Colossus gate' },
  { kind: 'warded', everyNRounds: 1, offset: 0, label: 'Warded gate' },
  { kind: 'swarm', everyNRounds: 1, offset: 0, label: 'Swarm gate' },
  { kind: 'herald', everyNRounds: 1, offset: 0, label: 'Herald gate' },
];

/** GDD §15: Muster costs 1 Food + 1 Metal; the intended maximum is 5 dice. */
export const MUSTER_COST = { food: 1, metal: 1 } as const;
export const MAX_ARMY = 5;

/** GDD §15 and §16: Prestige for a kill, and for a Tower support hit. */
export const COMBAT_PRESTIGE = 1;
