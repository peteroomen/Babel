import { CANON_RULES, RESOURCE_TYPES, type ResourceType } from '@babel-game/game-data';
import { ARCHETYPES, type Archetype } from '@babel-game/game-ai';
import type { GameRecord } from './play.js';
import type { Variant } from './variants.js';

/**
 * The two river-bank experiments are deliberately small RuleSet changes. The
 * core owns the starting lane and the bank semantics; this file only describes
 * the cells and records their outcomes.
 */
export const BANK_VARIANTS: readonly Variant[] = [
  {
    id: 'currentCANON',
    label: 'Current canon v0.5',
    note: 'Control: the live canon RuleSet.',
    rules: CANON_RULES,
  },
  {
    id: 'bank-hosts',
    label: 'Banked Host routing',
    note: 'Hosts follow the bank graph; resources retain tile-wide collection.',
    rules: { ...CANON_RULES, bankMode: 'hosts' },
  },
  {
    id: 'bank-hosts-resources',
    label: 'Banked Hosts and resources',
    note: 'Hosts follow banks and river resources collect from both banks.',
    rules: { ...CANON_RULES, bankMode: 'resources' },
  },
];

export type RosterMode = 'fixed' | 'diverse' | 'balanced';

type ResourceCounts = Record<ResourceType, number>;
type SourceCounts = Record<string, ResourceCounts>;
type NumberCounts = Record<string, number>;

export type CompactBankGame = {
  variant: string;
  seed: string;
  roster: readonly Archetype[];
  outcome: GameRecord['outcome'];
  rounds: number;
  winningRound: number | null;
  totalTurns: number;
  actionCounts: Readonly<Record<string, number>>;
  hostsSpawned: number;
  hostsKilled: number;
  beaconDeferrals: number;
  zeroHostGame: boolean;
  resourcesGained: Readonly<SourceCounts>;
  resourcesGainedPerTurn: Readonly<SourceCounts>;
  harvestTriggers: number;
  harvestTriggersByResource: Readonly<NumberCounts>;
  placementSuppressed: number;
  placementSuppressedByReason: Readonly<NumberCounts>;
  resourceWantAccess: {
    wanting: number;
    satisfied: number;
    rate: number;
    byResource: Readonly<Record<string, { wanting: number; satisfied: number; rate: number }>>;
  };
  /** Null means the current event schema did not expose bank choices. */
  bankChoiceUsage: BankChoiceUsage | null;
};

export type BankChoiceUsage = {
  choices: number;
  byRegion: Readonly<NumberCounts>;
  hostRoutingChoices: number;
  harvesterBankChoices: number;
};

export type BankCellSummary = {
  variant: string;
  players: number;
  games: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  winRateWilson95: { low: number; high: number };
  meanWinningRounds: number | null;
  totalTurns: number;
  meanTurns: number;
  actionCounts: Readonly<NumberCounts>;
  actionShares: Readonly<NumberCounts>;
  zeroHostGames: number;
  meanHostsSpawned: number;
  meanHostsKilled: number;
  meanBeaconDeferrals: number;
  resourcesGained: Readonly<SourceCounts>;
  resourcesGainedPerTurn: Readonly<SourceCounts>;
  harvestTriggers: number;
  harvestTriggersByResource: Readonly<NumberCounts>;
  placementSuppressed: number;
  placementSuppressedByReason: Readonly<NumberCounts>;
  resourceWantAccess: {
    wanting: number;
    satisfied: number;
    rate: number;
    byResource: Readonly<Record<string, { wanting: number; satisfied: number; rate: number }>>;
  };
  bankChoiceUsage: BankChoiceUsage | null;
};

const zeroResources = (): ResourceCounts =>
  Object.fromEntries(RESOURCE_TYPES.map((resource) => [resource, 0])) as ResourceCounts;

const emptySources = (): SourceCounts => ({
  placement: zeroResources(),
  harvest: zeroResources(),
  barter: zeroResources(),
});

const addResource = (counts: SourceCounts, source: string, resource: string, amount: number): void => {
  if (!RESOURCE_TYPES.includes(resource as ResourceType) || !Number.isFinite(amount)) return;
  const bucket = counts[source] ?? (counts[source] = zeroResources());
  bucket[resource as ResourceType] += amount;
};

const cloneSources = (sources: SourceCounts): SourceCounts =>
  Object.fromEntries(
    Object.entries(sources).map(([source, resources]) => [source, { ...resources }]),
  ) as SourceCounts;

const scaleSources = (sources: SourceCounts, divisor: number): SourceCounts => {
  const result = cloneSources(sources);
  for (const resources of Object.values(result)) {
    for (const resource of RESOURCE_TYPES) resources[resource] = divisor === 0 ? 0 : resources[resource] / divisor;
  }
  return result;
};

const increment = (map: NumberCounts, key: string, amount = 1): void => {
  map[key] = (map[key] ?? 0) + amount;
};

const asRecord = (event: unknown): Record<string, unknown> =>
  event !== null && typeof event === 'object' ? (event as Record<string, unknown>) : {};

const stringValue = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const numberValue = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const wilson = (wins: number, total: number): { low: number; high: number } => {
  if (total === 0) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return { low: (centre - spread) / denominator, high: (centre + spread) / denominator };
};

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);

const turnsByResource = (game: GameRecord): Record<string, { wanting: number; satisfied: number; rate: number }> => {
  const result: Record<string, { wanting: number; satisfied: number; rate: number }> = {};
  for (const resource of RESOURCE_TYPES) result[resource] = { wanting: 0, satisfied: 0, rate: 0 };
  for (const turn of game.turns) {
    if (!turn.wanted) continue;
    const entry = result[turn.wanted] ?? { wanting: 0, satisfied: 0, rate: 0 };
    entry.wanting += 1;
    if (turn.satisfied) entry.satisfied += 1;
    entry.rate = ratio(entry.satisfied, entry.wanting);
    result[turn.wanted] = entry;
  }
  return result;
};

/**
 * Extract optional bank telemetry from fields that mean an actual choice.
 * Ordinary banked movement is intentionally ignored: a `hostMoved` event is
 * a bank route choice only when it has `hadChoice` and its destination carries
 * a region. Harvester choices are counted from `buildingConstructed.region`;
 * until core emits both fields, the result stays null rather than guessing.
 */
const bankTelemetry = (events: readonly unknown[]): BankChoiceUsage | null => {
  const byRegion: NumberCounts = {};
  let choices = 0;
  let hostRoutingChoices = 0;
  let harvesterBankChoices = 0;
  for (const raw of events) {
    const event = asRecord(raw);
    const type = stringValue(event.type) ?? '';
    const destination = asRecord(event.to);
    const hostRegion = destination.region;
    const explicitRegion = event.region;
    const explicitChoice = type === 'bankChoice' || type === 'bankChosen' || type === 'bankSelected';
    const region = explicitRegion ?? event.bank ?? event.selectedRegion ?? hostRegion;
    const hasRegion = typeof region === 'number' || typeof region === 'string';
    const hostRoute = type === 'hostMoved' && event.hadChoice === true &&
      (typeof hostRegion === 'number' || typeof hostRegion === 'string');
    const harvester = type === 'buildingConstructed' && event.hadBankChoice === true &&
      (typeof explicitRegion === 'number' || typeof explicitRegion === 'string');
    if (explicitChoice || hostRoute || harvester) {
      choices += 1;
      if (hostRoute) hostRoutingChoices += 1;
      if (harvester) harvesterBankChoices += 1;
      if (hasRegion) increment(byRegion, String(region));
    }
  }
  return choices === 0 ? null : { choices, byRegion, hostRoutingChoices, harvesterBankChoices };
};

export function compactBankGame(game: GameRecord): CompactBankGame {
  const actionCounts: NumberCounts = {};
  const gained = emptySources();
  const harvestTriggersByResource: NumberCounts = {};
  const placementSuppressedByReason: NumberCounts = {};
  let hostsSpawned = 0;
  let hostsKilled = 0;
  let beaconDeferrals = 0;
  let harvestTriggers = 0;
  let placementSuppressed = 0;

  for (const turn of game.turns) increment(actionCounts, turn.action);
  for (const raw of game.events as readonly unknown[]) {
    const event = asRecord(raw);
    const type = stringValue(event.type) ?? '';
    if (type === 'hostSpawned') hostsSpawned += 1;
    if (type === 'hostKilled') hostsKilled += 1;
    if (type === 'beaconDeferred') beaconDeferrals += numberValue(event.owed, 1);
    if (type === 'resourcesGained') {
      addResource(gained, stringValue(event.source) ?? 'unknown', stringValue(event.resource) ?? '', numberValue(event.amount));
    } else if (type === 'bartered') {
      addResource(gained, 'barter', stringValue(event.gained) ?? '', 1);
    }
    if (type === 'harvestTriggered') {
      harvestTriggers += 1;
      increment(harvestTriggersByResource, stringValue(event.resource) ?? 'unknown');
    }
    if (type === 'payoutSuppressed' || type === 'placementSuppressed' || type === 'resourcePayoutSuppressed') {
      placementSuppressed += 1;
      increment(placementSuppressedByReason, stringValue(event.reason) ?? 'unknown');
    }
  }

  const totalTurns = game.turns.length;
  const resourceWantAccess = turnsByResource(game);
  const wanting = Object.values(resourceWantAccess).reduce((sum, item) => sum + item.wanting, 0);
  const satisfied = Object.values(resourceWantAccess).reduce((sum, item) => sum + item.satisfied, 0);
  return {
    variant: game.variant,
    seed: game.seed,
    roster: Object.values(game.seats),
    outcome: game.outcome,
    rounds: game.rounds,
    winningRound: game.outcome === 'win' ? game.rounds : null,
    totalTurns,
    actionCounts,
    hostsSpawned,
    hostsKilled,
    beaconDeferrals,
    zeroHostGame: hostsSpawned === 0,
    resourcesGained: gained,
    resourcesGainedPerTurn: scaleSources(gained, totalTurns),
    harvestTriggers,
    harvestTriggersByResource,
    placementSuppressed,
    placementSuppressedByReason,
    resourceWantAccess: { wanting, satisfied, rate: ratio(satisfied, wanting), byResource: resourceWantAccess },
    bankChoiceUsage: bankTelemetry(game.events as readonly unknown[]),
  };
}

const addSources = (target: SourceCounts, source: SourceCounts): void => {
  for (const [name, resources] of Object.entries(source)) {
    const bucket = target[name] ?? (target[name] = zeroResources());
    for (const resource of RESOURCE_TYPES) bucket[resource] += resources[resource] ?? 0;
  }
};

const sumNumbers = (games: readonly CompactBankGame[], get: (game: CompactBankGame) => number): number =>
  games.reduce((sum, game) => sum + get(game), 0);

export function summariseBankCell(
  variant: string,
  players: number,
  games: readonly CompactBankGame[],
): BankCellSummary {
  const wins = games.filter((game) => game.outcome === 'win').length;
  const losses = games.filter((game) => game.outcome === 'loss').length;
  const timeouts = games.filter((game) => game.outcome === 'timeout').length;
  const totalTurns = sumNumbers(games, (game) => game.totalTurns);
  const actionCounts: NumberCounts = {};
  for (const game of games) for (const [action, count] of Object.entries(game.actionCounts)) increment(actionCounts, action, count);
  const actionShares = Object.fromEntries(Object.entries(actionCounts).map(([action, count]) => [action, ratio(count, totalTurns)]));
  const resourcesGained = emptySources();
  for (const game of games) addSources(resourcesGained, game.resourcesGained as SourceCounts);
  const resourcesGainedPerTurn = scaleSources(resourcesGained, totalTurns);
  const harvestTriggersByResource: NumberCounts = {};
  const placementSuppressedByReason: NumberCounts = {};
  let wanting = 0;
  let satisfied = 0;
  const byResource: Record<string, { wanting: number; satisfied: number; rate: number }> = {};
  for (const resource of RESOURCE_TYPES) byResource[resource] = { wanting: 0, satisfied: 0, rate: 0 };
  for (const game of games) {
    for (const [resource, count] of Object.entries(game.harvestTriggersByResource)) increment(harvestTriggersByResource, resource, count);
    for (const [reason, count] of Object.entries(game.placementSuppressedByReason)) increment(placementSuppressedByReason, reason, count);
    wanting += game.resourceWantAccess.wanting;
    satisfied += game.resourceWantAccess.satisfied;
    for (const [resource, access] of Object.entries(game.resourceWantAccess.byResource)) {
      const item = byResource[resource] ?? { wanting: 0, satisfied: 0, rate: 0 };
      item.wanting += access.wanting;
      item.satisfied += access.satisfied;
      item.rate = ratio(item.satisfied, item.wanting);
      byResource[resource] = item;
    }
  }
  const bankGames = games.filter((game) => game.bankChoiceUsage !== null);
  const bankChoiceUsage = bankGames.length === 0
    ? null
    : {
        choices: sumNumbers(bankGames, (game) => game.bankChoiceUsage?.choices ?? 0),
        byRegion: Object.fromEntries(
          bankGames.flatMap((game) => Object.entries(game.bankChoiceUsage?.byRegion ?? {})).reduce(
            (map, [region, count]) => map.set(region, (map.get(region) ?? 0) + count),
            new Map<string, number>(),
          ),
        ),
        hostRoutingChoices: sumNumbers(bankGames, (game) => game.bankChoiceUsage?.hostRoutingChoices ?? 0),
        harvesterBankChoices: sumNumbers(bankGames, (game) => game.bankChoiceUsage?.harvesterBankChoices ?? 0),
      };
  const winningRounds = games.filter((game) => game.winningRound !== null).map((game) => game.winningRound as number);
  return {
    variant,
    players,
    games: games.length,
    wins,
    losses,
    timeouts,
    winRate: ratio(wins, games.length),
    winRateWilson95: wilson(wins, games.length),
    meanWinningRounds: winningRounds.length === 0 ? null : mean(winningRounds),
    totalTurns,
    meanTurns: mean(games.map((game) => game.totalTurns)),
    actionCounts,
    actionShares,
    zeroHostGames: games.filter((game) => game.zeroHostGame).length,
    meanHostsSpawned: mean(games.map((game) => game.hostsSpawned)),
    meanHostsKilled: mean(games.map((game) => game.hostsKilled)),
    meanBeaconDeferrals: mean(games.map((game) => game.beaconDeferrals)),
    resourcesGained,
    resourcesGainedPerTurn,
    harvestTriggers: sumNumbers(games, (game) => game.harvestTriggers),
    harvestTriggersByResource,
    placementSuppressed: sumNumbers(games, (game) => game.placementSuppressed),
    placementSuppressedByReason,
    resourceWantAccess: { wanting, satisfied, rate: ratio(satisfied, wanting), byResource },
    bankChoiceUsage,
  };
}

const combinations = <T>(items: readonly T[], size: number): T[][] => {
  if (size === 0) return [[]];
  const result: T[][] = [];
  items.forEach((item, index) => {
    for (const tail of combinations(items.slice(index + 1), size - 1)) result.push([item, ...tail]);
  });
  return result;
};

const rotate = (roster: readonly Archetype[], offset: number): readonly Archetype[] =>
  roster.map((_, index) => roster[(index + offset) % roster.length]!);

const fixedRosters: Readonly<Record<number, readonly Archetype[]>> = {
  2: ['architect', 'commander'],
  3: ['architect', 'commander', 'industrialist'],
  4: ['architect', 'commander', 'industrialist', 'engineer'],
};

export const rosterFor = (players: number, mode: RosterMode, index: number): readonly Archetype[] => {
  if (mode === 'fixed') return rotate(fixedRosters[players]!, index % players);
  const balanced = combinations(ARCHETYPES, players);
  const roster = balanced[index % balanced.length]!;
  return rotate(roster, Math.floor(index / balanced.length) % players);
};
