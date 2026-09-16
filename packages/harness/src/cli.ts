import { RESOURCE_TYPES, type Stage } from '@babel-game/game-data';
import { CLASSIC_TABLE, ARCHETYPE_LABEL } from '@babel-game/game-ai';
import { playGame } from './play.js';
import { summarise, type Summary } from './metrics.js';
import { LAKE_VARIANTS, LEVER_VARIANTS, VARIANTS, type Variant } from './variants.js';

/**
 * Run the Milestone 6 comparison and print it.
 *
 *   npm run model                 -- the four Barter/Reserve variants
 *   npm run model -- --games 400  -- more seeds per variant
 *   npm run model -- --levers     -- Attack cost and Barter cost instead
 *   npm run model -- --lake       -- the terrain-weight question instead
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
const variants: readonly Variant[] = flag('lake')
  ? LAKE_VARIANTS
  : flag('levers')
    ? LEVER_VARIANTS
    : VARIANTS;

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
      ...CLASSIC_TABLE.map((archetype) => [
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
const summaries = variants.map((variant) => {
  const played = Array.from({ length: games }, (_, i) => playGame(variant, `s${i}`));
  return summarise(variant.id, played);
});

if (flag('json')) {
  console.log(JSON.stringify({ games, summaries }, null, 2));
} else {
  console.log(
    `BABEL model — ${games} games per variant, ${CLASSIC_TABLE.length} Leaders ` +
      `(${CLASSIC_TABLE.map((a) => ARCHETYPE_LABEL[a]).join(', ')})`,
  );
  for (const variant of variants) console.log(`  ${variant.id.padEnd(10)} ${variant.note}`);
  report(summaries, Object.fromEntries(variants.map((v) => [v.id, v.label])));
  console.log(`\nRun in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
