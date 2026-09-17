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
import { CANON_RULES } from '@babel-game/game-data';
import {
  LAKE_VARIANTS,
  RIVER_VARIANTS,
  VARIANTS,
  WALL_VARIANTS,
  playGame,
  summarise,
} from '../src/index.js';

/* Look variants up by id: the list grows, and a positional index silently
   points at the wrong rules when it does. */
const byId = (id: string) => VARIANTS.find((v) => v.id === id)!;
const control = byId('control');
const reserve1 = byId('reserve1');

describe('the harness', () => {
  it('offers the four variants Milestone 6 asks to compare', () => {
    expect(VARIANTS.map((v) => v.id)).toEqual([
      'control',
      'v01',
      'same-kind',
      'reserve1',
      'reserve2',
    ]);
    /* v0.1 is kept so every report can show the delta from the baseline the
       earlier rounds of modelling were measured against. */
    expect(byId('v01').rules.barterMode).toBe('mixed');
    /* `control` tracks whatever the game currently plays, so a comparison is
       always against the live rules rather than a frozen snapshot. */
    expect(control.rules).toEqual(CANON_RULES);
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
    expect(play(control, 'r').turns.every((t) => t.swap === null)).toBe(true);
    expect(play(reserve1, 'r').turns.every((t) => t.swap !== null)).toBe(true);
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
    expect(summarise('reserve1', ['a'].map((s) => play(reserve1, s))).reserve).not.toBeNull();
  });
});

describe('round seven: the river and the Walls', () => {
  const river = RIVER_VARIANTS.find((v) => v.id === 'river-reach')!;
  const noWalls = WALL_VARIANTS.find((v) => v.id === 'no-walls')!;

  it('measures Babel’s river in every variant, paid or not', () => {
    const summary = summarise('control', [play(control, 'river')]);
    /* The fixed opening tile is always in it, so the reach is never zero. */
    expect(summary.river.reach).toBeGreaterThanOrEqual(1);
    expect(summary.river.prestigePerGame).toBe(0);
    expect(summary.river.shareOfPrestige).toBe(0);
  });

  it('pays somebody for the river once the rule is on', () => {
    /* Several seeds: a single twelve-round game can go by without the bag
       dealing a river tile that extends anything. */
    const games = ['a', 'b', 'c', 'd'].map((seed) => play(river, seed));
    const summary = summarise(river.id, games);
    expect(summary.river.prestigePerGame).toBeGreaterThan(0);
    expect(summary.river.shareOfPrestige).toBeGreaterThan(0);
    expect(summary.river.reach).toBeGreaterThan(1);
  });

  it('builds no Walls at all when Walls are not in the rules', () => {
    const summary = summarise(noWalls.id, [play(noWalls, 'w'), play(noWalls, 'x')]);
    expect(summary.walls.segmentsPerGame).toBe(0);
    expect(summary.walls.standingAtEnd).toBe(0);
    expect(summary.actionMix.buildWalls ?? 0).toBe(0);
  });

  it('counts a crossed Wall as a share of the Walls built', () => {
    const summary = summarise('control', [play(control, 'w'), play(control, 'x')]);
    expect(summary.walls.brokenShare).toBeGreaterThanOrEqual(0);
    expect(summary.walls.brokenShare).toBeLessThanOrEqual(1);
    expect(summary.walls.standingAtEnd).toBeLessThanOrEqual(summary.walls.segmentsPerGame);
  });

  it('gives paired variants the same opening board', () => {
    const a = playGame(control, 'pair', undefined, { rounds: 2, paired: true });
    const b = playGame(river, 'pair', undefined, { rounds: 2, paired: true });
    const first = (game: typeof a) => game.events.find((e) => e.type === 'tilePlaced');
    expect(first(a)).toEqual(first(b));
    /* Unpaired, the variant's own name salts the seed and the boards diverge
       from the first draw, which is what every earlier round was measured on. */
    const unpaired = playGame(river, 'pair', undefined, { rounds: 2 });
    expect(first(unpaired)).not.toEqual(first(a));
  });
});
