import { describe, expect, it } from 'vitest';

/**
 * Harness tests play real games, but capped short.
 *
 * These cover the machinery — determinism, recording, summarising — not
 * outcomes. A full game is ~200 turns of synchronous work, which is what the
 * `npm run model` CLI is for; running several of them here blocked Vitest's
 * worker long enough to trip its own RPC timeout.
 */
const ROUNDS = 12;
const play = (variant: Parameters<typeof playGame>[0], seed: string) =>
  playGame(variant, seed, undefined, { rounds: ROUNDS });
import { LAKE_VARIANTS, VARIANTS, playGame, summarise } from '../src/index.js';

const control = VARIANTS[0]!;

describe('the harness', () => {
  it('offers the four variants Milestone 6 asks to compare', () => {
    expect(VARIANTS.map((v) => v.id)).toEqual([
      'control',
      'same-kind',
      'reserve1',
      'reserve2',
    ]);
    expect(control.rules.barterMode).toBe('mixed');
    expect(control.rules.reserveSlots).toBe(0);
  });

  it('keeps the Lake candidates on one axis', () => {
    /* Only the terrain weights may differ, or the comparison confounds the
       Lake question with the Barter and Reserve ones. */
    const [first, ...rest] = LAKE_VARIANTS;
    for (const variant of rest) {
      expect(variant.rules.barterMode).toBe(first!.rules.barterMode);
      expect(variant.rules.reserveSlots).toBe(first!.rules.reserveSlots);
    }
    /* Weight comes off Desert, so the yielding terrains keep their share. */
    for (const variant of LAKE_VARIANTS) {
      const total = Object.values(variant.rules.terrainWeights).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
    }
  });

  it('replays a game identically from the same seed', () => {
    const a = play(control, 'repeat');
    const b = play(control, 'repeat');
    expect(a.outcome).toBe(b.outcome);
    expect(a.rounds).toBe(b.rounds);
    expect(a.turns.length).toBe(b.turns.length);
    expect(a.prestige).toEqual(b.prestige);
  });

  it('plays every variant to a real conclusion', () => {
    for (const variant of VARIANTS) {
      const game = play(variant, 'v');
      expect(['win', 'loss', 'timeout']).toContain(game.outcome);
      expect(game.turns.length).toBeGreaterThan(12);
      /* Every turn ends on exactly one action. */
      for (const turn of game.turns) expect(turn.action).toBeTruthy();
    }
  });

  it('only records Reserve activity for variants that have one', () => {
    expect(play(VARIANTS[0]!, 'r').turns.every((t) => t.swap === null)).toBe(true);
    expect(play(VARIANTS[2]!, 'r').turns.every((t) => t.swap !== null)).toBe(true);
  });
});

describe('the summary', () => {
  const games = ['a', 'b'].map((seed) => play(control, seed));
  const summary = summarise(control.id, games);

  it('splits outcomes into shares that account for every game', () => {
    const decided = games.filter((g) => g.outcome !== 'timeout').length;
    expect(summary.sharedWinRate + summary.timeoutRate).toBeLessThanOrEqual(1.0001);
    expect(summary.games).toBe(games.length);
    expect(decided + games.filter((g) => g.outcome === 'timeout').length).toBe(games.length);
  });

  it('gives an action mix summing to one', () => {
    const total = Object.values(summary.actionMix).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('counts resources against the turns that wanted them', () => {
    expect(summary.turnsWanting).toBeGreaterThan(0);
    expect(summary.accessRate).toBeGreaterThanOrEqual(0);
    expect(summary.accessRate).toBeLessThanOrEqual(1);
  });

  it('attributes every resource to a source', () => {
    const { placement, harvest, barter } = summary.bySource;
    expect(placement).toBeGreaterThan(0);
    expect(placement + harvest + barter).toBeGreaterThan(0);
  });

  it('reports no Reserve statistics for a variant without one', () => {
    expect(summary.reserve).toBeNull();
    expect(summarise('reserve1', ['a'].map((s) => play(VARIANTS[2]!, s))).reserve).not.toBeNull();
  });
});
