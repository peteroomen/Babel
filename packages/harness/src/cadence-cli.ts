import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARCHETYPES, type Archetype } from '@babel-game/game-ai';
import { playGame, type GameRecord } from './play.js';
import { CADENCE_VARIANTS } from './cadence.js';

type RosterMode = 'fixed' | 'diverse';
type CompactGame = {
  variant: string;
  seed: string;
  roster: readonly Archetype[];
  outcome: GameRecord['outcome'];
  rounds: number;
  winningRound: number | null;
  turns: number;
  stageReached: number;
  lossStage: number | null;
  hostsSpawned: number;
  hostsKilled: number;
  beaconDeferrals: number;
  zeroHostGame: boolean;
  actionCounts: Readonly<Record<string, number>>;
};

type CellSummary = {
  variant: string;
  players: number;
  games: number;
  win: number;
  loss: number;
  timeout: number;
  winRate: number;
  winRateWilson95: { low: number; high: number };
  meanWinningRounds: number | null;
  medianWinningRounds: number | null;
  totalPlayerTurns: number;
  meanPlayerTurns: number;
  actionShares: Readonly<Record<string, number>>;
  stageReachRate: Readonly<Record<string, number>>;
  lossStageRate: Readonly<Record<string, number>>;
  meanHostsSpawned: number;
  meanHostsKilled: number;
  meanBeaconDeferrals: number;
  zeroHostGames: number;
};

const argv = process.argv.slice(2);
const value = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (argv[index + 1] ?? fallback);
};
const number = (name: string, fallback: number): number => {
  const parsed = Number(value(name, String(fallback)));
  return Number.isFinite(parsed) ? Math.max(1, Math.min(120, Math.floor(parsed))) : fallback;
};
const games = number('games', 12);
const seedPrefix = value('seed-prefix', 'cadence');
const players = Number(value('players', '3'));
if (![2, 3, 4].includes(players)) throw new Error('--players must be 2, 3, or 4');
const rosterMode = value('roster-mode', 'fixed') as RosterMode;
if (rosterMode !== 'fixed' && rosterMode !== 'diverse') {
  throw new Error('--roster-mode must be fixed or diverse');
}
const output = value('output', './tmp/cadence');
mkdirSync(output, { recursive: true });

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
const diverseRosters = combinations(ARCHETYPES, players);
const rosterFor = (index: number): readonly Archetype[] => {
  if (rosterMode === 'fixed') return rotate(fixedRosters[players]!, index % players);
  const rosterIndex = index % diverseRosters.length;
  /* Keep each roster's block together; rotate seats only after every balanced
     roster has appeared once, so a 10-seed pair screen covers all pairs. */
  return rotate(diverseRosters[rosterIndex]!, Math.floor(index / diverseRosters.length) % players);
};

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
const wilson = (wins: number, total: number) => {
  if (total === 0) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return { low: (centre - spread) / denominator, high: (centre + spread) / denominator };
};

const compact = (game: GameRecord): CompactGame => {
  const actionCounts: Record<string, number> = {};
  for (const turn of game.turns) actionCounts[turn.action] = (actionCounts[turn.action] ?? 0) + 1;
  const spawned = game.events.filter((event) => event.type === 'hostSpawned').length;
  const killed = game.events.filter((event) => event.type === 'hostKilled').length;
  const deferrals = game.events.filter((event) => event.type === 'beaconDeferred').length;
  const stageReached = Math.max(...Object.keys(game.stageRounds).map(Number));
  return {
    variant: game.variant,
    seed: game.seed,
    roster: Object.values(game.seats),
    outcome: game.outcome,
    rounds: game.rounds,
    winningRound: game.outcome === 'win' ? game.rounds : null,
    turns: game.turns.length,
    stageReached,
    lossStage: game.outcome === 'loss' ? stageReached : null,
    hostsSpawned: spawned,
    hostsKilled: killed,
    beaconDeferrals: deferrals,
    zeroHostGame: spawned === 0,
    actionCounts,
  };
};

const summariseCell = (variant: string, games_: readonly CompactGame[]): CellSummary => {
  const wins = games_.filter((game) => game.outcome === 'win').length;
  const losses = games_.filter((game) => game.outcome === 'loss').length;
  const timeouts = games_.filter((game) => game.outcome === 'timeout').length;
  const turns = games_.reduce((sum, game) => sum + game.turns, 0);
  const actionTotals: Record<string, number> = {};
  for (const game of games_) {
    for (const [action, count] of Object.entries(game.actionCounts)) {
      actionTotals[action] = (actionTotals[action] ?? 0) + count;
    }
  }
  const actionShares = Object.fromEntries(
    Object.entries(actionTotals).map(([action, count]) => [action, turns === 0 ? 0 : count / turns]),
  );
  const stageReachRate = Object.fromEntries(
    [1, 2, 3].map((stage) => [String(stage), games_.filter((game) => game.stageReached >= stage).length / games_.length]),
  );
  const lossStageRate = Object.fromEntries(
    [1, 2, 3].map((stage) => [String(stage), games_.filter((game) => game.lossStage === stage).length / games_.length]),
  );
  const winningRounds = games_.flatMap((game) => game.winningRound === null ? [] : [game.winningRound]);
  return {
    variant,
    players,
    games: games_.length,
    win: wins,
    loss: losses,
    timeout: timeouts,
    winRate: wins / games_.length,
    winRateWilson95: wilson(wins, games_.length),
    meanWinningRounds: winningRounds.length === 0 ? null : mean(winningRounds),
    medianWinningRounds: median(winningRounds),
    totalPlayerTurns: turns,
    meanPlayerTurns: mean(games_.map((game) => game.turns)),
    actionShares,
    stageReachRate,
    lossStageRate,
    meanHostsSpawned: mean(games_.map((game) => game.hostsSpawned)),
    meanHostsKilled: mean(games_.map((game) => game.hostsKilled)),
    meanBeaconDeferrals: mean(games_.map((game) => game.beaconDeferrals)),
    zeroHostGames: games_.filter((game) => game.zeroHostGame).length,
  };
};

const requested = value('variants', '').split(',').map((id) => id.trim()).filter(Boolean);
const variants = (CADENCE_VARIANTS[players] ?? []).filter(
  (variant) => requested.length === 0 || requested.includes(variant.id),
);
if (variants.length === 0) throw new Error(`No cadence variants selected for ${players} players`);

const summaries: CellSummary[] = [];
for (const variant of variants) {
  const gamesForCell: CompactGame[] = [];
  for (let index = 0; index < games; index++) {
    const roster = rosterFor(index);
    const seed = `${seedPrefix}-p${players}-${index}`;
    const played = playGame(variant, seed, roster, { paired: true });
    gamesForCell.push(compact(played));
    writeFileSync(join(output, `p${players}-${variant.id}.json`), JSON.stringify({
      experimental: true,
      players,
      rosterMode,
      games: gamesForCell,
      summary: summariseCell(variant.id, gamesForCell),
    }, null, 2));
    process.stderr.write(`cadence cell=${variant.id} players=${players} game=${index + 1}/${games}\n`);
  }
  summaries.push(summariseCell(variant.id, gamesForCell));
}
writeFileSync(join(output, `summary-p${players}.json`), JSON.stringify({
  experimental: true,
  players,
  rosterMode,
  seedPrefix,
  games,
  summaries,
}, null, 2));
console.log(JSON.stringify({ players, rosterMode, games, summaries }, null, 2));
