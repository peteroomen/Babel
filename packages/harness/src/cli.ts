import { RESOURCE_TYPES, type Stage } from '@babel-game/game-data';
import { ARCHETYPES, CLASSIC_TABLE, ARCHETYPE_LABEL, type Archetype } from '@babel-game/game-ai';
import { playGame } from './play.js';
import { summarise, type Summary } from './metrics.js';
import {
  ROSTER_VARIANTS,
  DEFENCE_VARIANTS,
  DIFFICULTY_VARIANTS,
  HEAVEN_VARIANTS,
  HEIGHT_VARIANTS,
} from './rounds.js';
import {
  BABEL_VARIANTS,
  GEO_VARIANTS,
  SINK_VARIANTS,
  STACK_VARIANTS,
  CONFIRM_VARIANTS,
  LAKE_VARIANTS,
  LEVER_VARIANTS,
  CANON_VARIANTS,
  RIVER_CONFIRM_VARIANTS,
  RIVER_MILESTONE_VARIANTS,
  RIVER_VARIANTS,
  VARIANTS,
  WALL_CONFIRM_VARIANTS,
  WALL_VARIANTS,
  type Variant,
} from './variants.js';

/**
 * Run the Milestone 6 comparison and print it.
 *
 *   npm run model                 -- the four Barter/Reserve variants
 *   npm run model -- --games 400  -- more seeds per variant
 *   npm run model -- --levers     -- Attack cost and Barter cost instead
 *   npm run model -- --babel      -- Babel cost curves instead
 *   npm run model -- --confirm    -- control vs the leading candidate only
 *   npm run model -- --stack      -- the leading candidates alone and together
 *   npm run model -- --geo        -- rivers, Desert and the map
 *   npm run model -- --sink       -- the Monument
 *   npm run model -- --river      -- Prestige for lengthening Babel's river
 *   npm run model -- --walls      -- do Walls earn their rules text?
 *   npm run model -- --lake       -- the terrain-weight question instead
 *   npm run model -- --canon      -- v0.4 as adopted, against the v0.3 it replaces
 *   npm run model -- --paired     -- every variant from the same seeds
 *   npm run model -- --table a,b,c -- choose the archetypes at the table
 *   npm run model -- --json       -- machine-readable, for diffing runs
 */
const argv = process.argv.slice(2);
const flag = (name: string): boolean => argv.includes(`--${name}`);
const option = (name: string, fallback: number): number => {
  const at = argv.indexOf(`--${name}`);
  if (at === -1) return fallback;
  const value = Number(argv[at + 1]);
  return Number.isFinite(value) ? value : fallback;
};

const games = option('games', 200);

/**
 * Who is sitting at the table, e.g. `--table engineer,commander,architect`.
 *
 * The default three are the roster every earlier round was measured with, so a
 * new run stays comparable by default. It matters for any question about a
 * subsystem only one archetype plays: asking whether Walls are worth their
 * rules text at a table with no Engineer at it answers a narrower question than
 * it appears to.
 */
const table_ = ((): readonly Archetype[] => {
  const at = argv.indexOf('--table');
  if (at === -1) return CLASSIC_TABLE;
  const names = (argv[at + 1] ?? '').split(',').map((name) => name.trim().toLowerCase());
  const seats = names.filter((name): name is Archetype =>
    (ARCHETYPES as readonly string[]).includes(name),
  );
  if (seats.length < 2 || seats.length !== names.length) {
    throw new Error(`--table wants 2-4 of: ${ARCHETYPES.join(', ')}`);
  }
  return seats;
})();
const SETS: readonly { flag: string; variants: readonly Variant[] }[] = [
  { flag: 'lake', variants: LAKE_VARIANTS },
  { flag: 'levers', variants: LEVER_VARIANTS },
  { flag: 'babel', variants: BABEL_VARIANTS },
  { flag: 'confirm', variants: CONFIRM_VARIANTS },
  { flag: 'stack', variants: STACK_VARIANTS },
  { flag: 'geo', variants: GEO_VARIANTS },
  { flag: 'difficulty', variants: DIFFICULTY_VARIANTS },
  { flag: 'height', variants: HEIGHT_VARIANTS },
  { flag: 'heaven', variants: HEAVEN_VARIANTS },
  { flag: 'defence', variants: DEFENCE_VARIANTS },
  { flag: 'roster', variants: ROSTER_VARIANTS },
  { flag: 'sink', variants: SINK_VARIANTS },
  { flag: 'river', variants: RIVER_VARIANTS },
  { flag: 'walls', variants: WALL_VARIANTS },
  { flag: 'river-confirm', variants: RIVER_CONFIRM_VARIANTS },
  { flag: 'river-milestone', variants: RIVER_MILESTONE_VARIANTS },
  { flag: 'walls-confirm', variants: WALL_CONFIRM_VARIANTS },
  { flag: 'canon', variants: CANON_VARIANTS },
];
const variants: readonly Variant[] = SETS.find((set) => flag(set.flag))?.variants ?? VARIANTS;

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const num = (value: number | null, places = 1): string =>
  value === null ? '—' : value.toFixed(places);

function table(rows: readonly (readonly string[])[]): string {
  const widths = rows[0]!.map((_, column) =>
    Math.max(...rows.map((row) => (row[column] ?? '').length)),
  );
  return rows
    .map((row, index) => {
      const line = row
        .map((cell, column) =>
          column === 0 ? cell.padEnd(widths[column]!) : cell.padStart(widths[column]!),
        )
        .join('  ');
      /* A rule under the header, so a long run stays readable in a terminal. */
      return index === 0 ? `${line}\n${widths.map((w) => '-'.repeat(w)).join('  ')}` : line;
    })
    .join('\n');
}

const ACTIONS = [
  ['attack', 'Attack'],
  ['barter', 'Barter'],
  ['buildBabel', 'Babel'],
  ['buildHarvester', 'Build'],
  ['buildTower', 'Tower'],
  ['buildWalls', 'Walls'],
  ['muster', 'Muster'],
  ['buyScheme', 'Scheme'],
  ['pass', 'Pass'],
] as const;

function report(summaries: readonly Summary[], labels: Readonly<Record<string, string>>): void {
  const head = ['Metric', ...summaries.map((s) => labels[s.variant] ?? s.variant)];

  console.log('\nOUTCOMES');
  console.log(
    table([
      head,
      ['Shared win rate', ...summaries.map((s) => pct(s.sharedWinRate))],
      ['Timeouts', ...summaries.map((s) => pct(s.timeoutRate))],
      ['Mean rounds', ...summaries.map((s) => num(s.meanRounds))],
      ['Mean rounds (wins)', ...summaries.map((s) => num(s.meanRoundsWon))],
      ['Mean Babel pieces', ...summaries.map((s) => num(s.meanBabelPieces))],
    ]),
  );

  console.log('\nACTION MIX');
  console.log(
    table([
      head,
      ...ACTIONS.map(([key, label]) => [
        label,
        ...summaries.map((s) => pct(s.actionMix[key] ?? 0)),
      ]),
    ]),
  );

  console.log('\nRESOURCE AGENCY');
  console.log(
    table([
      head,
      ['Access rate', ...summaries.map((s) => pct(s.accessRate))],
      ['Turns wanting', ...summaries.map((s) => String(s.turnsWanting))],
      ...(['placement', 'harvest', 'barter'] as const).map((source) => [
        `From ${source}`,
        ...summaries.map((s) => {
          const total = s.bySource.placement + s.bySource.harvest + s.bySource.barter;
          return pct(total === 0 ? 0 : s.bySource[source] / total);
        }),
      ]),
      ['Surplus at end', ...summaries.map((s) => num(s.surplus))],
      ...RESOURCE_TYPES.map((resource) => [
        `  ${resource}`,
        ...summaries.map((s) => num(s.surplusByResource[resource])),
      ]),
    ]),
  );

  console.log('\nBABEL PACING (mean round reaching each Stage)');
  console.log(
    table([
      head,
      ...([2, 3] as Stage[]).map((stage) => [
        `Stage ${stage}`,
        ...summaries.map((s) => num(s.stagePacing[stage] ?? null)),
      ]),
    ]),
  );

  console.log('\nPRESTIGE BY STRATEGY (mean, and share of individual wins)');
  console.log(
    table([
      head,
      ...table_.map((archetype) => [
        ARCHETYPE_LABEL[archetype],
        ...summaries.map(
          (s) =>
            `${num(s.prestigeByArchetype[archetype])} (${pct(
              s.prestigeWinsByArchetype[archetype],
            )})`,
        ),
      ]),
    ]),
  );

  console.log('\nBABEL’S RIVER');
  console.log(
    table([
      head,
      ['River Prestige / game', ...summaries.map((s) => num(s.river.prestigePerGame))],
      ['  share of all Prestige', ...summaries.map((s) => pct(s.river.shareOfPrestige))],
      ['Placements paid', ...summaries.map((s) => pct(s.river.rewardedPlacements))],
      ['Reach from Babel (tiles)', ...summaries.map((s) => num(s.river.reach, 2))],
      ['Tiles in Babel’s river', ...summaries.map((s) => num(s.river.tiles, 2))],
      ['Payout per placement', ...summaries.map((s) => num(s.river.payoutPerPlacement, 3))],
    ]),
  );

  console.log('\nWALLS');
  console.log(
    table([
      head,
      ['Wall actions / game', ...summaries.map((s) => num(s.walls.actionsPerGame, 2))],
      ['Segments built / game', ...summaries.map((s) => num(s.walls.segmentsPerGame, 2))],
      ['Segments crossed / game', ...summaries.map((s) => num(s.walls.brokenPerGame, 2))],
      ['  share of segments built', ...summaries.map((s) => pct(s.walls.brokenShare))],
      ['Still standing at end', ...summaries.map((s) => num(s.walls.standingAtEnd, 2))],
    ]),
  );

  const withReserve = summaries.filter((s) => s.reserve !== null);
  if (withReserve.length > 0) {
    console.log('\nRESERVE');
    console.log(
      table([
        ['Metric', ...withReserve.map((s) => labels[s.variant] ?? s.variant)],
        ['Swapped', ...withReserve.map((s) => pct(s.reserve!.swapRate))],
        ['Kept the draw', ...withReserve.map((s) => pct(1 - s.reserve!.swapRate))],
        ['Dead tiles refilled / game', ...withReserve.map((s) => num(s.reserve!.deadPerGame, 2))],
        ['Taken: Hills or Mountain', ...withReserve.map((s) => pct(s.reserve!.stoneShare))],
        ['Taken: Farmland', ...withReserve.map((s) => pct(s.reserve!.takenByTerrain.farmland))],
        ['Taken: Forest', ...withReserve.map((s) => pct(s.reserve!.takenByTerrain.forest))],
        ['Taken: Desert', ...withReserve.map((s) => pct(s.reserve!.takenByTerrain.desert))],
      ]),
    );
  }
}

const started = Date.now();
const paired = flag('paired');
const summaries = variants.map((variant) => {
  const played = Array.from({ length: games }, (_, i) =>
    playGame(variant, `s${i}`, table_, { paired }),
  );
  return summarise(variant.id, played);
});

if (flag('json')) {
  console.log(JSON.stringify({ games, summaries }, null, 2));
} else {
  console.log(
    `BABEL model — ${games} games per variant, ${table_.length} Leaders ` +
      `(${table_.map((a) => ARCHETYPE_LABEL[a]).join(', ')})`,
  );
  for (const variant of variants) console.log(`  ${variant.id.padEnd(10)} ${variant.note}`);
  report(summaries, Object.fromEntries(variants.map((v) => [v.id, v.label])));
  console.log(`\nRun in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
