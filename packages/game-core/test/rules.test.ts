import { describe, expect, it } from 'vitest';
import { CANON_RULES, type ResourceType, type RuleSet } from '@babel-game/game-data';
import {
  applyMove,
  currentPlayer,
  getLegalActions,
  getLegalTilePlacements,
  hasAnyLegalPlacement,
  setupGame,
  type GameState,
} from '../src/index.js';
import { playRounds, settleTable } from './helpers.js';

const rules = (overrides: Partial<RuleSet>): RuleSet => ({ ...CANON_RULES, ...overrides });

/** Put a known hand in front of the active Leader. */
function withHand(state: GameState, hand: Partial<Record<ResourceType, number>>): GameState {
  const me = currentPlayer(state);
  const leader = state.leaders[me]!;
  return {
    ...state,
    leaders: {
      ...state.leaders,
      [me]: { ...leader, resources: { food: 0, wood: 0, brick: 0, metal: 0, ...hand } },
    },
  };
}

/** Advance to the action step, so Barter is available to test. */
function atAction(state: GameState): GameState {
  const me = currentPlayer(state);
  const option = getLegalTilePlacements(state.board, state.drawnTile!)[0];
  if (!option) throw new Error('no legal placement to get past the place step');
  return applyMove(state, {
    type: 'placeTile',
    player: me,
    at: option.at,
    rotation: option.rotations[0]!,
  }).state;
}

describe('the ruleset travels with the game', () => {
  it('defaults to canon v0.1', () => {
    const state = setupGame(['Ada', 'Peter'], 'seed');
    expect(state.rules).toEqual(CANON_RULES);
    expect(state.rules.barterMode).toBe('mixed');
    expect(state.reserve).toEqual([]);
  });

  it('rejects a Reserve larger than the guard allows', () => {
    expect(() => setupGame(['Ada', 'Peter'], 'seed', rules({ reserveSlots: 9 }))).toThrow(
      /reserveSlots/,
    );
  });

  it('leaves canon play unchanged — a pass-only game still ends in defeat', () => {
    const state = playRounds(setupGame(['Ada', 'Peter'], 'canon'), 200);
    expect(state.phase).toBe('gameOver');
    expect(state.lossReason).toBe('foundationBreached');
  });
});

describe('same-kind Barter', () => {
  const open = () =>
    atAction(setupGame(['Ada', 'Peter'], 'barter', rules({ barterMode: 'sameKind' })));

  it('accepts three of one resource', () => {
    const state = withHand(open(), { wood: 3 });
    const me = currentPlayer(state);
    const after = applyMove(state, {
      type: 'barter',
      player: me,
      spend: ['wood', 'wood', 'wood'],
      gain: 'metal',
    }).state;
    expect(after.leaders[me]!.resources).toMatchObject({ wood: 0, metal: 1 });
  });

  it('refuses a mixed spend', () => {
    const state = withHand(open(), { wood: 2, food: 1 });
    const me = currentPlayer(state);
    expect(() =>
      applyMove(state, {
        type: 'barter',
        player: me,
        spend: ['wood', 'wood', 'food'],
        gain: 'metal',
      }),
    ).toThrow(/three of the same/);
  });

  it('is not offered to a Leader holding three resources across two kinds', () => {
    const state = withHand(open(), { wood: 2, food: 1 });
    const legal = getLegalActions(state, currentPlayer(state));
    expect(legal.find((action) => action.type === 'barter')).toBeUndefined();
  });

  it('is still offered to that Leader under canon rules', () => {
    const state = withHand(atAction(setupGame(['Ada', 'Peter'], 'barter')), {
      wood: 2,
      food: 1,
    });
    const barter = getLegalActions(state, currentPlayer(state)).find(
      (action) => action.type === 'barter',
    );
    expect(barter).toBeDefined();
    /* Canon reports every resource held as spendable; same-kind reports only
       the stacks deep enough to convert. */
    expect(barter).toMatchObject({ spendable: ['food', 'wood'] });
  });

  it('reports only stacks of three as spendable', () => {
    const state = withHand(open(), { wood: 4, food: 2, brick: 3 });
    const barter = getLegalActions(state, currentPlayer(state)).find(
      (action) => action.type === 'barter',
    );
    expect(barter).toMatchObject({ spendable: ['wood', 'brick'] });
  });
});

describe('the shared tile Reserve', () => {
  const open = (slots: number) =>
    setupGame(['Ada', 'Peter'], 'reserve', rules({ reserveSlots: slots }));

  it('is dealt full at setup', () => {
    expect(open(1).reserve).toHaveLength(1);
    expect(open(2).reserve).toHaveLength(2);
  });

  it('only ever holds tiles that can actually be placed', () => {
    let state = open(2);
    for (let turn = 0; turn < 30 && state.phase !== 'gameOver'; turn++) {
      state = settleTable(state);
      if (state.phase === 'gameOver' || !state.drawnTile) break;
      /* Milestone 6: a slot must never go permanently dead. */
      for (const tile of state.reserve) {
        expect(hasAnyLegalPlacement(state.board, tile)).toBe(true);
      }
      expect(state.reserve).toHaveLength(2);

      const me = currentPlayer(state);
      const option = getLegalTilePlacements(state.board, state.drawnTile)[0]!;
      state = applyMove(state, {
        type: 'placeTile',
        player: me,
        at: option.at,
        rotation: option.rotations[0]!,
      }).state;
      state = applyMove(state, { type: 'pass', player: me }).state;
    }
  });

  it('swaps the draw for a slot, and leaves the cast-off behind', () => {
    const state = open(1);
    const me = currentPlayer(state);
    const drawn = state.drawnTile!;
    const offered = state.reserve[0]!;

    const after = applyMove(state, { type: 'swapReserve', player: me, slot: 0 }).state;
    expect(after.drawnTile).toEqual(offered);
    expect(after.reserve[0]).toEqual(drawn);
    /* Free, and not the action: the Leader still owes a placement. */
    expect(after.turnStep).toBe('place');
  });

  it('is refused when the rules have no Reserve', () => {
    const state = setupGame(['Ada', 'Peter'], 'reserve');
    expect(() =>
      applyMove(state, { type: 'swapReserve', player: currentPlayer(state), slot: 0 }),
    ).toThrow(/no Reserve/);
  });

  it('is refused once the tile is placed', () => {
    const state = open(1);
    const me = currentPlayer(state);
    const placed = atAction(state);
    expect(() => applyMove(placed, { type: 'swapReserve', player: me, slot: 0 })).toThrow(
      /already placed/,
    );
  });

  it('is refused for a slot that does not exist', () => {
    const state = open(1);
    expect(() =>
      applyMove(state, { type: 'swapReserve', player: currentPlayer(state), slot: 3 }),
    ).toThrow(/no Reserve tile/);
  });
});

describe('terrain weights are part of the ruleset', () => {
  it('draws Lake once it has a weight, and never before', () => {
    const canon = playRounds(setupGame(['Ada', 'Peter'], 'lake'), 60);
    expect(canon.log.some((e) => e.type === 'tileDrawn' && e.terrain === 'lake')).toBe(false);

    const wet = playRounds(
      setupGame(
        ['Ada', 'Peter'],
        'lake',
        rules({ terrainWeights: { ...CANON_RULES.terrainWeights, lake: 40, desert: 0 } }),
      ),
      60,
    );
    expect(wet.log.some((e) => e.type === 'tileDrawn' && e.terrain === 'lake')).toBe(true);
  });
});
