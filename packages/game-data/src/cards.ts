import type { Stage } from './babel.js';

/**
 * Schemes. GDD §18: three effects, two copies each, six cards total.
 *
 * Schemes are meant to feel powerful and rule-breaking. Theft and nastier
 * interaction are deferred (§18, §23) until the base game proves it needs them.
 */
export const SCHEME_IDS = ['false-prophet', 'common-tongue', 'frenzied-works'] as const;
export type SchemeId = (typeof SCHEME_IDS)[number];

export type SchemeSpec = {
  readonly label: string;
  /** One sentence, mechanically legible. GDD §0: one joke is enough. */
  readonly text: string;
  /** When the card may be played. */
  readonly timing: 'heaven' | 'confusion' | 'afterAction';
};

export const SCHEMES: Record<SchemeId, SchemeSpec> = {
  'false-prophet': {
    label: 'False Prophet',
    text: 'During the Heaven Phase, send one Host to any adjacent legal tile instead of toward Babel. That ends its movement for the phase.',
    timing: 'heaven',
  },
  'common-tongue': {
    label: 'Common Tongue',
    text: 'Play as Confusion is revealed: cancel that Confusion card for the round.',
    timing: 'confusion',
  },
  'frenzied-works': {
    label: 'Frenzied Works',
    text: 'After your normal action, immediately take one more. The bonus action cannot buy a Scheme.',
    timing: 'afterAction',
  },
};

/** GDD §18: two copies of each effect. */
export const SCHEME_DECK: readonly SchemeId[] = SCHEME_IDS.flatMap((id) => [id, id]);

/** GDD §18: buying a Scheme costs 1 Food + 1 Metal and draws blind. */
export const SCHEME_COST = { food: 1, metal: 1 } as const;

/**
 * Confusion. GDD §19: six unique effects, nine cards at maximum difficulty.
 *
 * Each changes the round in one sentence. The deck grows as Babel escalates,
 * so Heaven gets stranger as well as stronger.
 */
export const CONFUSION_IDS = [
  'silent-workshops',
  'lost-ledgers',
  'fractured-command',
  'stalled-works',
  'march-of-heaven',
  'broken-swords',
] as const;
export type ConfusionId = (typeof CONFUSION_IDS)[number];

export type ConfusionSpec = {
  readonly label: string;
  readonly text: string;
  /** The Stage at which this card joins the deck. */
  readonly addedAtStage: Stage;
  /** Copies added when it joins. */
  readonly copies: number;
};

export const CONFUSION: Record<ConfusionId, ConfusionSpec> = {
  'silent-workshops': {
    label: 'Silent Workshops',
    text: 'Harvesting buildings do not trigger this round.',
    addedAtStage: 1,
    copies: 2,
  },
  'lost-ledgers': {
    label: 'Lost Ledgers',
    text: 'The Leader placing a tile takes no base terrain payout this round. Foreign harvesting buildings still resolve.',
    addedAtStage: 1,
    copies: 2,
  },
  'fractured-command': {
    label: 'Fractured Command',
    text: 'Each action may be chosen by only one Leader this round. Passing is always allowed.',
    addedAtStage: 1,
    copies: 2,
  },
  'stalled-works': {
    label: 'Stalled Works',
    text: 'Nobody may take the Babel action this round.',
    addedAtStage: 2,
    copies: 1,
  },
  'march-of-heaven': {
    label: 'March of Heaven',
    text: 'Every Host already on the board gets +1 movement this Heaven Phase.',
    addedAtStage: 2,
    copies: 1,
  },
  'broken-swords': {
    label: 'Broken Swords',
    text: 'Nobody may take the Attack action this round.',
    addedAtStage: 3,
    copies: 1,
  },
};

/** The cards that join the deck when a given Stage begins. GDD §19. */
export const confusionCardsForStage = (stage: Stage): ConfusionId[] =>
  CONFUSION_IDS.flatMap((id) =>
    CONFUSION[id].addedAtStage === stage
      ? Array<ConfusionId>(CONFUSION[id].copies).fill(id)
      : [],
  );

/**
 * Which of the seven action categories a command belongs to, for Fractured
 * Command. GDD §11 lists Build, Babel, Attack, Muster, Scheme, Barter, Pass —
 * so a Tower and a Wall are both "Build", like a harvesting building.
 */
export const ACTION_CATEGORIES = [
  'build',
  'babel',
  'attack',
  'muster',
  'scheme',
  'barter',
  'pass',
] as const;
export type ActionCategory = (typeof ACTION_CATEGORIES)[number];
