import { describe, expect, it } from 'vitest';
import {
  LEGACY_V01_RULES,
  RESOURCE_TYPES,
  type ResourceType,
} from '@babel-game/game-data';
import {
  applyMove,
  isBabelComplete,
  piecesPerStage,
  piecesToNextEscalation,
  setupGame,
  stageAfterPiece,
  totalPieces,
  type GameState,
} from '../src/index.js';

/** A Leader with enough of everything, ready to act. */
function ready(names: string[], stage: 1 | 2 | 3 = 1): GameState {
  const base = setupGame(names, 'babel');
  return {
    ...base,
    /* Neutralise Confusion so this suite tests one rule at a time. */
    confusion: { card: null, cancelledBy: null },
    stage,
    turnStep: 'action',
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    drawnTile: null,
    leaders: Object.fromEntries(
      Object.entries(base.leaders).map(([id, l]) => [
        id,
        { ...l, resources: { food: 20, wood: 20, brick: 20, metal: 20 } },
      ]),
    ),
  };
}

const build = (state: GameState, player = 'p0') =>
  applyMove(state, { type: 'buildBabel', player });

describe('scaling (GDD §4)', () => {
  it.each([
    [2, 3, 9],
    [3, 5, 15],
    [4, 6, 18],
  ])('%i Leaders build %i pieces per Stage, %i total', (leaders, perStage, total) => {
    expect(piecesPerStage(leaders)).toBe(perStage);
    expect(totalPieces(leaders)).toBe(total);
  });
});

describe('building a Babel piece (GDD §12)', () => {
  it('charges the Stage cost and awards the Stage Prestige', () => {
    const state = ready(['Ada', 'Peter']);
    const { state: after, events } = build(state);

    /* v0.2 Stage I: 1 Brick + 1 Wood + 1 Food, 2 Prestige. */
    const paid = state.rules.babelPieceCost[1];
    expect(after.leaders['p0']!.resources.brick).toBe(20 - (paid.brick ?? 0));
    expect(after.leaders['p0']!.resources.wood).toBe(20 - (paid.wood ?? 0));
    expect(after.leaders['p0']!.resources.food).toBe(20 - (paid.food ?? 0));
    expect(after.leaders['p0']!.prestige).toBe(2);
    expect(after.babel.stack).toEqual(['p0']);
    expect(events).toContainEqual({
      type: 'prestigeGained',
      player: 'p0',
      amount: 2,
      source: 'babel',
    });
  });

  /**
   * v0.2 spreads a piece across three resources per Stage instead of asking for
   * Brick and Food. The totals per piece are unchanged at 3, 5 and 8 — that was
   * the point of the curve, to move the mix without moving the price.
   */
  it.each([
    [1, { brick: 1, wood: 1, food: 1 }, 2],
    [2, { brick: 2, wood: 2, metal: 1 }, 3],
    [3, { brick: 3, wood: 2, metal: 2, food: 1 }, 4],
  ] as const)('Stage %i charges %o for %i Prestige', (stage, cost, prestige) => {
    const state = ready(['Ada', 'Peter'], stage);
    const after = build(state).state;
    for (const resource of RESOURCE_TYPES) {
      expect(20 - after.leaders['p0']!.resources[resource]).toBe(
        (cost as Partial<Record<ResourceType, number>>)[resource] ?? 0,
      );
    }
    expect(after.leaders['p0']!.prestige).toBe(prestige);
    expect(Object.values(cost).reduce((a, b) => a + b, 0)).toBe([3, 5, 8][stage - 1]);
  });

  it('keeps the v0.1 curve available for comparison', () => {
    expect(LEGACY_V01_RULES.babelPieceCost).toEqual({
      1: { brick: 2, food: 1 },
      2: { brick: 4, food: 1 },
      3: { brick: 6, food: 2 },
    });
  });

  it('refuses when the Leader cannot afford a piece', () => {
    const base = ready(['Ada', 'Peter']);
    const broke: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, resources: { food: 0, wood: 0, brick: 0, metal: 0 } },
      },
    };
    expect(() => build(broke)).toThrow(/cannot afford/);
  });

  it('records who built each piece, newest last', () => {
    let state = ready(['Ada', 'Peter']);
    state = build(state, 'p0').state;
    state = { ...state, turnStep: 'action', currentPlayerIndex: 1 };
    state = build(state, 'p1').state;
    expect(state.babel.stack).toEqual(['p0', 'p1']);
  });
});

describe('stage escalation (GDD §12)', () => {
  it('escalates when the final piece of a Stage is built', () => {
    let state = ready(['Ada', 'Peter']);
    /* 2 Leaders: 3 pieces per Stage. */
    for (let i = 0; i < 2; i++) {
      const result = build(state);
      expect(result.events.some((e) => e.type === 'stageEscalated')).toBe(false);
      state = { ...result.state, turnStep: 'action', currentPlayerIndex: 0, drawnTile: null };
    }

    const third = build(state);
    expect(third.events).toContainEqual({ type: 'stageEscalated', from: 1, to: 2 });
    expect(third.state.stage).toBe(2);
  });

  it('never reverses, even if Babel is knocked back below the threshold', () => {
    /* Stage II reached, then Heaven removes pieces (Milestone 3). */
    const knockedBack = { stack: ['p0'] };
    expect(stageAfterPiece(knockedBack, 2, 2)).toBe(2);
    expect(stageAfterPiece(knockedBack, 3, 2)).toBe(3);
  });

  it('counts down to the next escalation', () => {
    const babel = { stack: [] };
    expect(piecesToNextEscalation(babel, 1, 2)).toBe(3);
    expect(piecesToNextEscalation({ ...babel, stack: ['p0', 'p1'] }, 1, 2)).toBe(1);
    /* Stage III has no further escalation. */
    expect(piecesToNextEscalation(babel, 3, 2)).toBeNull();
  });

  it('refuses to build while a Host occupies the Foundation (GDD §2)', () => {
    const state = ready(['Ada', 'Peter']);
    const besieged: GameState = {
      ...state,
      babel: { stack: [] },
      hosts: [{ id: 'h1', kind: 'ophanim', at: { x: 0, y: 0 }, shieldUp: false }],
    };
    expect(() => build(besieged)).toThrow(/Foundation is occupied/);
  });
});

describe('shared victory (GDD §2)', () => {
  it('ends the game when the final piece is placed', () => {
    let state = ready(['Ada', 'Peter'], 3);
    state = { ...state, babel: { stack: Array(8).fill('p1') } };

    const { state: after, events } = build(state);

    expect(isBabelComplete(after.babel, 2)).toBe(true);
    expect(after.phase).toBe('gameOver');
    expect(events.some((e) => e.type === 'humanityWins')).toBe(true);
  });

  it('awards the individual win to the highest Prestige', () => {
    let state = ready(['Ada', 'Peter'], 3);
    state = {
      ...state,
      babel: { stack: Array(8).fill('p1') },
      leaders: {
        ...state.leaders,
        p0: { ...state.leaders['p0']!, prestige: 10 },
        p1: { ...state.leaders['p1']!, prestige: 3 },
      },
    };
    /* p0 builds the last piece for 4 more, finishing on 14 against 3. */
    expect(build(state).state.winner).toBe('p0');
  });

  it('declares no individual winner on a Prestige tie', () => {
    let state = ready(['Ada', 'Peter'], 3);
    state = {
      ...state,
      babel: { stack: Array(8).fill('p1') },
      leaders: {
        ...state.leaders,
        p0: { ...state.leaders['p0']!, prestige: 0 },
        p1: { ...state.leaders['p1']!, prestige: 4 },
      },
    };
    const { state: after, events } = build(state);
    expect(after.winner).toBeNull();
    expect(events.find((e) => e.type === 'humanityWins')).toMatchObject({
      topPrestige: ['p0', 'p1'],
    });
  });

  it('refuses any further move once the game is over', () => {
    let state = ready(['Ada', 'Peter'], 3);
    state = { ...state, babel: { stack: Array(8).fill('p1') } };
    const after = build(state).state;
    expect(() => applyMove(after, { type: 'pass', player: 'p0' })).toThrow(/game is over/);
  });
});
