import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const runBanks = (args: readonly string[], allowFailure = false): string => {
  if (allowFailure) {
    const result = spawnSync('npm', ['run', 'banks', '--', ...args], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    return `${result.stdout}\n${result.stderr}`;
  }
  return execFileSync('npm', ['run', 'banks', '--', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
};

describe('banks CLI sharding and merge', () => {
  it('uses absolute seed and roster indices for an offset shard', () => {
    const directory = mkdtempSync(join(tmpdir(), 'babel-banks-offset-'));
    runBanks([
      '--games', '1',
      '--players', '2',
      '--variants', 'bank-hosts',
      '--seed-prefix', 'cli-offset',
      '--start-index', '2',
      '--output', directory,
    ]);
    const cell = JSON.parse(readFileSync(join(directory, 'p2-bank-hosts.json'), 'utf8')) as {
      startIndex: number;
      games: Array<{ seed: string; roster: string[] }>;
    };
    expect(cell.startIndex).toBe(2);
    expect(cell.games[0]).toMatchObject({
      seed: 'cli-offset-p2-g2',
      roster: ['architect', 'engineer'],
    });
  }, 120_000);

  it('merges contiguous shards and rejects duplicates or metadata mismatches', () => {
    const directory = mkdtempSync(join(tmpdir(), 'babel-banks-merge-'));
    const source = JSON.parse(
      readFileSync(join(root, 'docs/experiments/banks/validation/p2-bank-hosts.json'), 'utf8'),
    ) as { variant: string; players: number; rosterMode: string; seedPrefix: string; games: unknown[] };
    const metadata = {
      experimental: true,
      paired: true,
      variant: 'bank-hosts',
      players: source.players,
      rosterMode: source.rosterMode,
      seedPrefix: source.seedPrefix,
    };
    const shard0 = join(directory, 'shard0.json');
    const shard1 = join(directory, 'shard1.json');
    writeFileSync(shard0, JSON.stringify({ ...metadata, startIndex: 0, games: [source.games[0]] }));
    writeFileSync(shard1, JSON.stringify({ ...metadata, startIndex: 1, games: [source.games[1]] }));

    const output = join(directory, 'merged');
    runBanks(['--merge-inputs', `${shard1},${shard0}`, '--output', output]);
    const merged = JSON.parse(readFileSync(join(output, 'p2-bank-hosts.json'), 'utf8')) as {
      startIndex: number;
      games: Array<{ seed: string }>;
    };
    expect(merged.startIndex).toBe(0);
    expect(merged.games.map((game) => game.seed)).toEqual([
      'banks-20260918-validation-p2-g0',
      'banks-20260918-validation-p2-g1',
    ]);

    const duplicate = runBanks(['--merge-inputs', `${shard0},${shard0}`, '--output', join(directory, 'duplicate')], true);
    expect(duplicate).toContain('unique contiguous indices');

    const mismatch = join(directory, 'mismatch.json');
    writeFileSync(mismatch, JSON.stringify({ ...metadata, seedPrefix: 'different', startIndex: 1, games: [source.games[1]] }));
    const mismatchOutput = runBanks(['--merge-inputs', `${shard0},${mismatch}`, '--output', join(directory, 'mismatch-out')], true);
    expect(mismatchOutput).toContain('metadata mismatch for seedPrefix');
  }, 120_000);
});
