import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { playGame, type GameRecord } from './play.js';
import {
  BANK_VARIANTS,
  compactBankGame,
  rosterFor,
  summariseBankCell,
  type CompactBankGame,
  type BankCellSummary,
  type RosterMode,
} from './banks.js';

const argv = process.argv.slice(2);
const option = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (argv[index + 1] ?? fallback);
};
const positiveInt = (name: string, fallback: number, max = 120): number => {
  const parsed = Number(option(name, String(fallback)));
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer`);
  return Math.min(max, Math.floor(parsed));
};
const nonNegativeInt = (name: string, fallback: number): number => {
  const parsed = Number(option(name, String(fallback)));
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative integer`);
  return parsed;
};

const parsePlayers = (raw: string): number[] => {
  const values = raw.toLowerCase() === 'all' ? ['2', '3', '4'] : raw.split(',').map((value) => value.trim());
  const players = [...new Set(values.map(Number))];
  if (players.length === 0 || players.some((count) => ![2, 3, 4].includes(count))) {
    throw new Error('--players must be 2, 3, 4, a comma list, or all');
  }
  return players;
};

const requestedPlayers = parsePlayers(option('players', '2,3,4'));
const gamesPerCell = positiveInt('games', 60);
const seedPrefix = option('seed-prefix', 'banks');
const rosterMode = option('roster-mode', 'diverse') as RosterMode;
if (!['fixed', 'diverse', 'balanced'].includes(rosterMode)) {
  throw new Error('--roster-mode must be fixed, diverse, or balanced');
}
const output = option('output', './tmp/banks');
mkdirSync(output, { recursive: true });

type CellPayload = {
  experimental?: boolean;
  paired?: boolean;
  variant: string;
  players: number;
  rosterMode: RosterMode;
  seedPrefix: string;
  startIndex: number;
  games: CompactBankGame[];
  summary?: BankCellSummary;
};

const writeCell = (
  directory: string,
  payload: Omit<CellPayload, 'summary'>,
): BankCellSummary => {
  const summary = summariseBankCell(payload.variant, payload.players, payload.games);
  const cellPath = join(directory, `p${payload.players}-${payload.variant}.json`);
  const summaryPath = join(directory, `summary-p${payload.players}-${payload.variant}.json`);
  writeFileSync(cellPath, JSON.stringify({ ...payload, summary }, null, 2));
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  return summary;
};

const mergeInputs = option('merge-inputs', '')
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);
if (mergeInputs.length > 0) {
  const cells = mergeInputs.map((path): CellPayload => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      throw new Error(`cannot read merge input ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!parsed || typeof parsed !== 'object') throw new Error(`merge input ${path} is not a cell object`);
    const cell = parsed as Partial<CellPayload>;
    const startIndex = cell.startIndex;
    if (
      typeof cell.variant !== 'string' ||
      typeof cell.players !== 'number' ||
      typeof cell.rosterMode !== 'string' ||
      typeof cell.seedPrefix !== 'string' ||
      typeof startIndex !== 'number' ||
      !Number.isInteger(startIndex) ||
      startIndex < 0 ||
      !Array.isArray(cell.games)
    ) {
      throw new Error(`merge input ${path} lacks valid variant/players/rosterMode/seedPrefix/startIndex/games metadata`);
    }
    return { ...cell, startIndex } as CellPayload;
  });
  const first = cells[0]!;
  for (const cell of cells.slice(1)) {
    for (const key of ['variant', 'players', 'rosterMode', 'seedPrefix'] as const) {
      if (cell[key] !== first[key]) throw new Error(`merge input metadata mismatch for ${key}`);
    }
  }
  const indexed = cells.flatMap((cell) =>
    cell.games.map((game, offset) => ({ index: cell.startIndex + offset, game })),
  );
  indexed.sort((a, b) => a.index - b.index);
  for (let expected = 0; expected < indexed.length; expected++) {
    const actual = indexed[expected]?.index;
    if (actual !== expected) {
      throw new Error(`merge inputs must have unique contiguous indices beginning at 0; expected ${expected}, got ${actual ?? 'none'}`);
    }
  }
  for (const { index, game } of indexed) {
    if (game.variant !== first.variant) throw new Error(`merge game ${index} has variant ${game.variant}, expected ${first.variant}`);
    const expectedSeed = `${first.seedPrefix}-p${first.players}-g${index}`;
    if (game.seed !== expectedSeed) throw new Error(`merge game ${index} has seed ${game.seed}, expected ${expectedSeed}`);
    const expectedRoster = rosterFor(first.players, first.rosterMode, index);
    if (JSON.stringify(game.roster) !== JSON.stringify(expectedRoster)) {
      throw new Error(`merge game ${index} has a roster that does not match its absolute index`);
    }
  }
  const mergedGames = indexed.map(({ game }) => game);
  const summary = writeCell(output, {
    experimental: true,
    paired: true,
    variant: first.variant,
    players: first.players,
    rosterMode: first.rosterMode,
    seedPrefix: first.seedPrefix,
    startIndex: 0,
    games: mergedGames,
  });
  console.log(JSON.stringify({ experimental: true, paired: true, rosterMode: first.rosterMode, seedPrefix: first.seedPrefix, summaries: [summary] }, null, 2));
  process.exit(0);
}

const requestedVariants = option('variants', '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const variants = BANK_VARIANTS.filter((variant) => requestedVariants.length === 0 || requestedVariants.includes(variant.id));
if (variants.length === 0) throw new Error(`No bank variants selected; use one of ${BANK_VARIANTS.map((v) => v.id).join(', ')}`);

const summaries: BankCellSummary[] = [];
const startIndex = nonNegativeInt('start-index', 0);
for (const players of requestedPlayers) {
  for (const variant of variants) {
    const compactGames: CompactBankGame[] = [];
    const persist = (): void => {
      writeCell(output, {
        experimental: true,
        paired: true,
        variant: variant.id,
        players,
        rosterMode,
        seedPrefix,
        startIndex,
        games: compactGames,
      });
    };
    for (let index = 0; index < gamesPerCell; index++) {
      const absoluteIndex = startIndex + index;
      const roster = rosterFor(players, rosterMode, absoluteIndex);
      const seed = `${seedPrefix}-p${players}-g${absoluteIndex}`;
      let game: GameRecord;
      try {
        game = playGame(variant, seed, roster, { paired: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`bank experiment failed variant=${variant.id} seed=${seed}: ${message}`, { cause: error });
      }
      compactGames.push(compactBankGame(game));
      persist();
      process.stderr.write(`banks cell=${variant.id} players=${players} game=${absoluteIndex} (${index + 1}/${gamesPerCell})\n`);
    }
    const summary = summariseBankCell(variant.id, players, compactGames);
    summaries.push(summary);
  }
}

console.log(JSON.stringify({ experimental: true, paired: true, rosterMode, seedPrefix, summaries }, null, 2));
