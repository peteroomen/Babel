import { describe, expect, it } from 'vitest';
import {
  applyMove,
  currentPlayer,
  getLegalTilePlacements,
  setupGame,
  type GameState,
} from '../src/index.js';

/** Force a known tile into the active player's hand. */
function withDrawn(state: GameState, draw: GameState['drawnTile']): GameState {
  return { ...state, drawnTile: draw };
}

describe('placement pays the placing Leader', () => {
  it('credits the base payout to the Leader who placed the tile', () => {
    const base = setupGame(['Ada', 'Peter'], 'economy');
    const me = currentPlayer(base);
    const before = base.leaders[me]!.resources.wood;

    const state = withDrawn(base, { terrain: 'forest', river: 'none' });
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: me,
      at: { x: 1, y: 0 },
      rotation: 0,
    });

    expect(after.leaders[me]!.resources.wood).toBe(before + 1);
    expect(events).toContainEqual({
      type: 'resourcesGained',
      player: me,
      resource: 'wood',
      amount: 1,
      source: 'placement',
    });
  });

  it('pays adjacency: a Farmland next to the start tile pays 2 Food', () => {
    const base = setupGame(['Ada', 'Peter'], 'economy');
    const me = currentPlayer(base);
    const before = base.leaders[me]!.resources.food;

    /* 1,-1 sits east of GDD §5's Farmland start tile. */
    const state = withDrawn(base, { terrain: 'farmland', river: 'none' });
    const after = applyMove(state, {
      type: 'placeTile',
      player: me,
      at: { x: 1, y: -1 },
      rotation: 0,
    }).state;

    expect(after.leaders[me]!.resources.food).toBe(before + 2);
  });

  it('pays nothing for Desert and logs no suppression', () => {
    const base = setupGame(['Ada', 'Peter'], 'economy');
    const me = currentPlayer(base);
    const before = { ...base.leaders[me]!.resources };

    const state = withDrawn(base, { terrain: 'desert', river: 'none' });
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: me,
      at: { x: 1, y: 0 },
      rotation: 0,
    });

    expect(after.leaders[me]!.resources).toEqual(before);
    expect(events.some((e) => e.type === 'resourcesGained')).toBe(false);
    expect(events.some((e) => e.type === 'payoutSuppressed')).toBe(false);
  });

  it('suppresses and logs the payout inside an occupied feature', () => {
    const base = setupGame(['Ada', 'Peter'], 'economy');
    const me = currentPlayer(base);
    const before = base.leaders[me]!.resources.food;

    /* A Host standing on the start tile occupies its whole Farmland feature. */
    const state = withDrawn(
      {
        ...base,
        hosts: [{ id: 'h1', kind: 'ophanim', at: { x: 0, y: -1 }, shieldUp: false }],
      },
      { terrain: 'farmland', river: 'none' },
    );
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: me,
      at: { x: 1, y: -1 },
      rotation: 0,
    });

    expect(after.leaders[me]!.resources.food).toBe(before);
    expect(events).toContainEqual({
      type: 'payoutSuppressed',
      player: me,
      at: { x: 1, y: -1 },
      reason: 'featureOccupied',
    });
  });

  it('leaves other Leaders resources untouched', () => {
    const base = setupGame(['Ada', 'Peter'], 'economy');
    const me = currentPlayer(base);
    const other = base.order.find((id) => id !== me) as string;
    const before = { ...base.leaders[other]!.resources };

    const option = getLegalTilePlacements(base.board, base.drawnTile!)[0]!;
    const after = applyMove(base, {
      type: 'placeTile',
      player: me,
      at: option.at,
      rotation: option.rotations[0]!,
    }).state;

    expect(after.leaders[other]!.resources).toEqual(before);
  });
});
