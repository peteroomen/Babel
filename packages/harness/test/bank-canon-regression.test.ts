import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CADENCE_VARIANTS } from '../src/cadence.js';
import { playGame, type GameRecord } from '../src/play.js';
import type { Archetype } from '@babel-game/game-ai';

type SavedGame = {
  seed: string;
  roster: readonly Archetype[];
  outcome: GameRecord['outcome'];
  rounds: number;
  hostsSpawned: number;
  hostsKilled: number;
  actionCounts: Readonly<Record<string, number>>;
};

const cases = [
  {
    players: 2,
    variant: 'p2-1-0.75-0.75',
    fixture: 'docs/experiments/cadence/validation/p2-p2-1-0.75-0.75.json',
  },
  {
    players: 3,
    variant: 'p3-1-1.5-1.5',
    fixture: 'docs/experiments/cadence/validation/p3-p3-1-1.5-1.5.json',
  },
  {
    players: 4,
    variant: 'p4-1-2-2',
    fixture: 'docs/experiments/cadence/validation/p4-p4-1-2-2.json',
  },
] as const;

const actionCounts = (game: GameRecord): Readonly<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const turn of game.turns) counts[turn.action] = (counts[turn.action] ?? 0) + 1;
  return counts;
};

const hostCount = (game: GameRecord, type: 'hostSpawned' | 'hostKilled'): number =>
  game.events.filter((event) => event.type === type).length;

describe('canon replay regression after bank helper changes', () => {
  it.each(cases)('$variant preserves its saved first two paired games', ({ players, variant, fixture }) => {
    const saved = JSON.parse(readFileSync(join(process.cwd(), fixture), 'utf8')) as { games: SavedGame[] };
    const selected = CADENCE_VARIANTS[players]?.find((candidate) => candidate.id === variant);
    if (!selected) throw new Error(`missing cadence variant ${variant}`);

    for (const expected of saved.games.slice(0, 2)) {
      const actual = playGame(selected, expected.seed, expected.roster, { paired: true });
      expect({ outcome: actual.outcome, rounds: actual.rounds }, `${variant}/${expected.seed}`).toEqual({
        outcome: expected.outcome,
        rounds: expected.rounds,
      });
      expect(hostCount(actual, 'hostSpawned'), `${variant}/${expected.seed} spawned`).toBe(expected.hostsSpawned);
      expect(hostCount(actual, 'hostKilled'), `${variant}/${expected.seed} killed`).toBe(expected.hostsKilled);
      expect(actionCounts(actual), `${variant}/${expected.seed} actions`).toEqual(expected.actionCounts);
    }
  }, 120_000);
});
