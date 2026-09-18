import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../src/play.js';
import { compactBankGame, summariseBankCell } from '../src/banks.js';

const game = (outcome: GameRecord['outcome'], seed: string, spawned = false): GameRecord =>
  ({
    variant: 'currentCANON',
    seed,
    outcome,
    rounds: outcome === 'win' ? 8 : 12,
    winner: outcome === 'win' ? 'p0' : null,
    seats: { p0: 'architect', p1: 'commander' },
    prestige: { p0: 2, p1: 1 },
    finalResources: {
      p0: { food: 0, wood: 0, brick: 0, metal: 0 },
      p1: { food: 0, wood: 0, brick: 0, metal: 0 },
    },
    stageRounds: { 1: 1 },
    babelPieces: 0,
    turns: [
      {
        round: 1,
        player: 'p0',
        archetype: 'architect',
        action: 'pass',
        wanted: 'food',
        satisfied: true,
        swap: null,
        placed: null,
      },
      {
        round: 1,
        player: 'p1',
        archetype: 'commander',
        action: 'attack',
        wanted: 'wood',
        satisfied: false,
        swap: null,
        placed: null,
      },
    ],
    events: [
      { type: 'resourcesGained', player: 'p0', resource: 'food', amount: 2, source: 'placement' },
      { type: 'resourcesGained', player: 'p1', resource: 'wood', amount: 3, source: 'harvest' },
      { type: 'bartered', player: 'p0', spent: ['food', 'wood', 'wood'], gained: 'brick' },
      { type: 'harvestTriggered', placer: 'p0', owners: ['p1'], resource: 'wood', amount: 3, placerBonus: 1 },
      { type: 'payoutSuppressed', player: 'p0', at: { x: 1, y: 1 }, reason: 'featureOccupied' },
      ...(spawned
        ? [{ type: 'hostSpawned', id: 'h1', kind: 'ophanim', at: { x: 0, y: 1 } }]
        : []),
      { type: 'hostMoved', id: 'h1', from: { x: 0, y: 2 }, to: { x: 0, y: 1, region: 1 }, hadChoice: true },
      { type: 'buildingConstructed', player: 'p1', at: { x: 1, y: 1 }, building: 'harvester', region: 0, hadBankChoice: true },
    ],
    riverReach: 1,
    riverTiles: 1,
    wallsStanding: 0,
    reserveDead: 0,
    reserveTaken: [],
  }) as unknown as GameRecord;

describe('bank experiment metrics', () => {
  it('attributes resource totals and barter gains by source', () => {
    const compact = compactBankGame(game('win', 'resource'));
    expect(compact.resourcesGained.placement!.food).toBe(2);
    expect(compact.resourcesGained.harvest!.wood).toBe(3);
    expect(compact.resourcesGained.barter!.brick).toBe(1);
    expect(compact.resourcesGainedPerTurn.placement!.food).toBe(1);
    expect(compact.harvestTriggersByResource.wood).toBe(1);
    expect(compact.placementSuppressedByReason.featureOccupied).toBe(1);
    expect(compact.resourceWantAccess).toMatchObject({ wanting: 2, satisfied: 1, rate: 0.5 });
  });

  it('reports choices only where event fields expose them', () => {
    const compact = compactBankGame(game('win', 'choices'));
    expect(compact.bankChoiceUsage).toEqual({
      choices: 2,
      byRegion: { '1': 1, '0': 1 },
      hostRoutingChoices: 1,
      harvesterBankChoices: 1,
    });
  });

  it('keeps wins, losses, timeouts, and zero-host games separate', () => {
    const games = [
      compactBankGame(game('win', 'w')),
      compactBankGame(game('loss', 'l', true)),
      compactBankGame(game('timeout', 't')),
    ];
    const summary = summariseBankCell('currentCANON', 2, games);
    expect(summary).toMatchObject({
      games: 3,
      wins: 1,
      losses: 1,
      timeouts: 1,
      zeroHostGames: 2,
      totalTurns: 6,
    });
    expect(summary.winRateWilson95.low).toBeGreaterThan(0);
    expect(summary.winRateWilson95.high).toBeLessThanOrEqual(1);
  });
});
