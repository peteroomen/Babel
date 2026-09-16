import { writeFileSync, readFileSync } from 'node:fs';
import { CLASSIC_TABLE, ARCHETYPE_LABEL } from '@babel-game/game-ai';
import { playGame } from './play.js';
import { summarise, type Summary } from './metrics.js';
import { CELLS, FACTORS, cellId, cellVariant, isOn } from './sweep.js';

/**
 * Run the factorial sweep, or report on runs already done.
 *
 *   npm run sweep -- --cells 0-15 --games 12 --out a.json
 *   npm run sweep -- --cells 16-31 --games 12 --out b.json
 *   npm run sweep -- --report a.json b.json
 *
 * Split into blocks because a whole sweep is a few hundred games and a single
 * process should not run for twenty minutes unattended.
 */
const argv = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : argv[at + 1];
};

type Cell = { mask: number; summary: Summary };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function table(rows: readonly (readonly string[])[]): string {
  const widths = rows[0]!.map((_, c) => Math.max(...rows.map((r) => (r[c] ?? '').length)));
  return rows
    .map((row, i) => {
      const line = row
        .map((cell, c) => (c === 0 ? cell.padEnd(widths[c]!) : cell.padStart(widths[c]!)))
        .join('  ');
      return i === 0 ? `${line}\n${widths.map((w) => '-'.repeat(w)).join('  ')}` : line;
    })
    .join('\n');
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The share of a cell's actions spent on one kind. */
const act = (s: Summary, key: string) => s.actionMix[key] ?? 0;

function report(cells: readonly Cell[]): void {
  const games = cells[0]?.summary.games ?? 0;
  console.log(
    `BABEL factorial sweep — ${cells.length} of ${CELLS} cells, ${games} games each, ` +
      `${CLASSIC_TABLE.length} Leaders (${CLASSIC_TABLE.map((a) => ARCHETYPE_LABEL[a]).join(', ')})`,
  );

  /* Main effect: the mean of every cell with the lever on, minus the mean of
     every cell with it off. Each lever is therefore measured across every
     setting of the others rather than against one arbitrary baseline. */
  console.log('\nMAIN EFFECTS — each lever averaged over every setting of the others');
  const metrics = [
    ['win rate', (s: Summary) => s.sharedWinRate, pct],
    ['Barter share', (s: Summary) => act(s, 'barter'), pct],
    ['rounds', (s: Summary) => s.meanRounds, (v: number) => v.toFixed(1)],
    ['Babel pieces', (s: Summary) => s.meanBabelPieces, (v: number) => v.toFixed(1)],
    ['surplus', (s: Summary) => s.surplus, (v: number) => v.toFixed(0)],
  ] as const;

  const rows: string[][] = [['Lever', ...metrics.map(([name]) => `Δ ${name}`)]];
  FACTORS.forEach((factor, i) => {
    const on = cells.filter((c) => isOn(c.mask, i));
    const off = cells.filter((c) => !isOn(c.mask, i));
    if (on.length === 0 || off.length === 0) return;
    rows.push([
      factor.label,
      ...metrics.map(([, get, fmt]) => {
        const delta = mean(on.map((c) => get(c.summary))) - mean(off.map((c) => get(c.summary)));
        return `${delta >= 0 ? '+' : ''}${fmt(delta)}`;
      }),
    ]);
  });
  console.log(table(rows));

  /* Two levers can each help and still cancel. The interaction is the observed
     both-on result minus what adding the two main effects would predict. */
  console.log('\nINTERACTIONS on win rate (observed minus additive prediction)');
  const base = mean(cells.filter((c) => c.mask === 0).map((c) => c.summary.sharedWinRate));
  const inter: string[][] = [['Pair', 'both on', 'predicted', 'interaction']];
  for (let i = 0; i < FACTORS.length; i++) {
    for (let j = i + 1; j < FACTORS.length; j++) {
      const both = cells.filter((c) => isOn(c.mask, i) && isOn(c.mask, j));
      const onlyI = cells.filter((c) => isOn(c.mask, i) && !isOn(c.mask, j));
      const onlyJ = cells.filter((c) => !isOn(c.mask, i) && isOn(c.mask, j));
      const neither = cells.filter((c) => !isOn(c.mask, i) && !isOn(c.mask, j));
      if (!both.length || !onlyI.length || !onlyJ.length || !neither.length) continue;
      const w = (g: Cell[]) => mean(g.map((c) => c.summary.sharedWinRate));
      const observed = w(both);
      const predicted = w(onlyI) + w(onlyJ) - w(neither);
      inter.push([
        `${FACTORS[i]!.key} + ${FACTORS[j]!.key}`,
        pct(observed),
        pct(predicted),
        `${observed - predicted >= 0 ? '+' : ''}${pct(observed - predicted)}`,
      ]);
    }
  }
  inter.sort((a, b) => Math.abs(parseFloat(b[3]!)) - Math.abs(parseFloat(a[3]!)));
  console.log(table(inter.slice(0, 7)));
  void base;

  const ranked = [...cells].sort((a, b) => b.summary.sharedWinRate - a.summary.sharedWinRate);
  const line = (c: Cell) =>
    [
      cellId(c.mask),
      pct(c.summary.sharedWinRate),
      pct(act(c.summary, 'barter')),
      c.summary.meanRounds.toFixed(0),
      c.summary.meanBabelPieces.toFixed(1),
      c.summary.surplus.toFixed(0),
      pct(c.summary.timeoutRate),
    ];
  const head = ['Cell', 'win', 'barter', 'rounds', 'pieces', 'surplus', 'timeout'];
  console.log('\nBEST CELLS');
  console.log(table([head, ...ranked.slice(0, 8).map(line)]));
  console.log('\nWORST CELLS');
  console.log(table([head, ...ranked.slice(-5).map(line)]));
  console.log(`\nKEY: ${FACTORS.map((f) => `${f.key} = ${f.label}`).join(' · ')}`);
}

const reportAt = argv.indexOf('--report');
if (reportAt !== -1) {
  const cells = argv
    .slice(reportAt + 1)
    .filter((a) => !a.startsWith('--'))
    .flatMap((file) => JSON.parse(readFileSync(file, 'utf8')) as Cell[]);
  report(cells);
} else {
  const games = Number(option('games') ?? 12);
  const [from, to] = (option('cells') ?? `0-${CELLS - 1}`).split('-').map(Number) as [number, number];
  const started = Date.now();
  const cells: Cell[] = [];
  for (let mask = from; mask <= to; mask++) {
    const variant = cellVariant(mask);
    const played = Array.from({ length: games }, (_, i) => playGame(variant, `w${i}`));
    cells.push({ mask, summary: summarise(variant.id, played) });
    console.error(`  ${cellId(mask).padEnd(6)} done (${cells.length}/${to - from + 1})`);
  }
  const out = option('out');
  if (out) writeFileSync(out, JSON.stringify(cells));
  console.error(`swept ${cells.length} cells in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  report(cells);
}
