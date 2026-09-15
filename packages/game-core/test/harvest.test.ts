import { describe, expect, it } from 'vitest';
import {
  applyMove,
  setupGame,
  type Board,
  type Building,
  type GameState,
} from '../src/index.js';

const forest = { terrain: 'forest', river: 'none', rotation: 0 } as const;

/**
 * A Forest gap at 5,5 with a Forest either side, so placing there pays
 * 1 + 2 adjacent = 3 Wood and merges the two into one feature.
 */
const BOARD: Board = { '4,5': forest, '6,5': forest };

function table(
  names: string[],
  buildings: Record<string, Building>,
  occupied: string[] = [],
): GameState {
  const base = setupGame(names, 'harvest');
  return {
    ...base,
    board: { ...BOARD },
    buildings,
    occupiedTiles: occupied,
    /* Put the Forest tile in the active Leader's hand and let them act. */
    drawnTile: { terrain: 'forest', river: 'none' },
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    turnStep: 'place',
  };
}

const place = (state: GameState, player: string) =>
  applyMove(state, { type: 'placeTile', player, at: { x: 5, y: 5 }, rotation: 0 });

const woodOf = (state: GameState, id: string) => state.leaders[id]!.resources.wood;

describe('foreign expansion trigger (GDD §9)', () => {
  it('matches the worked example in the GDD', () => {
    /* Ada places; Peter and Rook each own a Sawmill in the Forest. */
    const state = table(['Ada', 'Peter', 'Rook'], {
      '4,5': { type: 'sawmill', owner: 'p1' },
      '6,5': { type: 'sawmill', owner: 'p2' },
    });
    const before = {
      ada: woodOf(state, 'p0'),
      peter: woodOf(state, 'p1'),
      rook: woodOf(state, 'p2'),
    };

    const { state: after, events } = place(state, 'p0');

    /* Ada: 3 Wood base + 1 infrastructure bonus = 4. Peter and Rook: 3 each. */
    expect(woodOf(after, 'p0') - before.ada).toBe(4);
    expect(woodOf(after, 'p1') - before.peter).toBe(3);
    expect(woodOf(after, 'p2') - before.rook).toBe(3);

    const trigger = events.find((e) => e.type === 'harvestTriggered');
    expect(trigger).toMatchObject({
      placer: 'p0',
      resource: 'wood',
      amount: 3,
      placerBonus: 1,
    });
  });

  it('does not stack the placer bonus with the number of owners', () => {
    const two = table(['Ada', 'Peter', 'Rook'], {
      '4,5': { type: 'sawmill', owner: 'p1' },
      '6,5': { type: 'sawmill', owner: 'p2' },
    });
    const one = table(['Ada', 'Peter', 'Rook'], {
      '4,5': { type: 'sawmill', owner: 'p1' },
    });

    /* Two foreign owners pay the placer exactly what one does: base + 1. */
    expect(woodOf(place(two, 'p0').state, 'p0')).toBe(woodOf(place(one, 'p0').state, 'p0'));
  });

  it('does not trigger from the placing Leader’s own building', () => {
    const state = table(['Ada', 'Peter'], { '4,5': { type: 'sawmill', owner: 'p0' } });
    const before = woodOf(state, 'p0');
    const { state: after, events } = place(state, 'p0');

    /* Base payout only: no bonus, no trigger. */
    expect(woodOf(after, 'p0') - before).toBe(3);
    expect(events.some((e) => e.type === 'harvestTriggered')).toBe(false);
  });

  it('pays a Leader once when a merge leaves them two buildings in one feature (RD-006)', () => {
    const state = table(['Ada', 'Peter'], {
      '4,5': { type: 'sawmill', owner: 'p1' },
      '6,5': { type: 'sawmill', owner: 'p1' },
    });
    const before = woodOf(state, 'p1');
    const { state: after, events } = place(state, 'p0');

    expect(woodOf(after, 'p1') - before).toBe(3);
    expect(events.filter((e) => e.type === 'resourcesGained' && e.player === 'p1')).toHaveLength(
      1,
    );
  });

  it('GDD §10: an occupied feature pays nobody', () => {
    const state = table(
      ['Ada', 'Peter'],
      { '4,5': { type: 'sawmill', owner: 'p1' } },
      ['6,5'],
    );
    const before = { ada: woodOf(state, 'p0'), peter: woodOf(state, 'p1') };
    const { state: after, events } = place(state, 'p0');

    expect(woodOf(after, 'p0')).toBe(before.ada);
    expect(woodOf(after, 'p1')).toBe(before.peter);
    expect(events.some((e) => e.type === 'harvestTriggered')).toBe(false);
    expect(events.some((e) => e.type === 'payoutSuppressed')).toBe(true);
  });

  it('pays nothing extra when no foreign building stands in the feature', () => {
    const state = table(['Ada', 'Peter'], {});
    const before = woodOf(state, 'p0');
    const { state: after } = place(state, 'p0');
    expect(woodOf(after, 'p0') - before).toBe(3);
  });

  it('awards no Prestige for a trigger, only resources (GDD §9)', () => {
    const state = table(['Ada', 'Peter'], { '4,5': { type: 'sawmill', owner: 'p1' } });
    const { state: after, events } = place(state, 'p0');
    expect(events.some((e) => e.type === 'prestigeGained')).toBe(false);
    expect(after.leaders['p1']!.prestige).toBe(0);
  });
});
