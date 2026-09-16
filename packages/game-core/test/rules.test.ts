import { describe, expect, it } from 'vitest';
import {
  CANON_RULES,
  LEGACY_V01_RULES,
  type ResourceType,
  type RuleSet,
} from '@babel-game/game-data';
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
  it('defaults to canon v0.2', () => {
    const state = setupGame(['Ada', 'Peter'], 'seed');
    expect(state.rules).toEqual(CANON_RULES);
    /* v0.2: same-kind Barter at four cards and the broad Babel curve. */
    expect(state.rules.barterMode).toBe('sameKind');
    expect(state.rules.barterCost).toBe(4);
    expect(state.rules.babelPieceCost[1]).toEqual({ brick: 1, wood: 1, food: 1 });
    expect(state.reserve).toEqual([]);
  });

  it('keeps v0.1 available, and it is not what anyone plays', () => {
    const state = setupGame(['Ada', 'Peter'], 'seed', LEGACY_V01_RULES);
    expect(state.rules.barterMode).toBe('mixed');
    expect(state.rules.barterCost).toBe(3);
    expect(LEGACY_V01_RULES).not.toEqual(CANON_RULES);
  });

  it('rejects a Reserve larger than the guard allows', () => {
    expect(() => setupGame(['Ada', 'Peter'], 'seed', rules({ reserveSlots: 9 }))).toThrow(
      /reserveSlots/,
    );
  });

  it('still loses a pass-only game, under either ruleset', () => {
    expect(playRounds(setupGame(['Ada', 'Peter'], 'canon', LEGACY_V01_RULES), 200).lossReason).toBe(
      'foundationBreached',
    );
    const state = playRounds(setupGame(['Ada', 'Peter'], 'canon'), 200);
    expect(state.phase).toBe('gameOver');
    expect(state.lossReason).toBe('foundationBreached');
  });
});

describe('same-kind Barter', () => {
  /* Three of a kind, so the rule can be tested independently of v0.2's cost. */
  const open = () =>
    atAction(
      setupGame(['Ada', 'Peter'], 'barter', rules({ barterMode: 'sameKind', barterCost: 3 })),
    );

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

  it('is still offered to that Leader under v0.1 rules', () => {
    const state = withHand(atAction(setupGame(['Ada', 'Peter'], 'barter', LEGACY_V01_RULES)), {
      wood: 2,
      food: 1,
    });
    const barter = getLegalActions(state, currentPlayer(state)).find(
      (action) => action.type === 'barter',
    );
    expect(barter).toBeDefined();
    /* v0.1 reports every resource held as spendable; same-kind reports only
       the stacks deep enough to convert. */
    expect(barter).toMatchObject({ spendable: ['food', 'wood'] });
  });

  it('reports only stacks deep enough to spend', () => {
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

describe('Barter cost is tuneable', () => {
  it('takes four cards when the rules say four', () => {
    const state = withHand(atAction(setupGame(['Ada', 'Peter'], 'four', rules({ barterCost: 4 }))), {
      wood: 4,
    });
    const me = currentPlayer(state);
    expect(() =>
      applyMove(state, { type: 'barter', player: me, spend: ['wood', 'wood', 'wood'], gain: 'brick' }),
    ).toThrow(/exactly 4/);

    const after = applyMove(state, {
      type: 'barter',
      player: me,
      spend: ['wood', 'wood', 'wood', 'wood'],
      gain: 'brick',
    }).state;
    expect(after.leaders[me]!.resources).toMatchObject({ wood: 0, brick: 1 });
  });

  it('is not offered to a Leader three cards deep', () => {
    const state = withHand(atAction(setupGame(['Ada', 'Peter'], 'four', rules({ barterCost: 4 }))), {
      wood: 2,
      food: 1,
    });
    expect(
      getLegalActions(state, currentPlayer(state)).find((a) => a.type === 'barter'),
    ).toBeUndefined();
  });
});

describe('Attack can cost Food per die', () => {
  /** A state with a Host on the board and a known hand, ready to Attack. */
  function readyToAttack(hand: Partial<Record<ResourceType, number>>, ruleSet = CANON_RULES) {
    const base = atAction(setupGame(['Ada', 'Peter'], 'attack', ruleSet));
    const me = currentPlayer(base);
    return withHand(
      {
        ...base,
        hosts: [{ id: 'h1', kind: 'ophanim', at: { x: 0, y: -1 }, shieldUp: false }],
        leaders: { ...base.leaders, [me]: { ...base.leaders[me]!, army: 3 } },
      },
      hand,
    );
  }

  it('is free and rolls the whole Army under canon', () => {
    const state = readyToAttack({ food: 0 });
    const me = currentPlayer(state);
    const attack = getLegalActions(state, me).find((a) => a.type === 'attack');
    expect(attack).toMatchObject({ dice: 3, cost: null });

    const after = applyMove(state, { type: 'attack', player: me }).state;
    const rolled = after.log.find((e) => e.type === 'attackRolled');
    expect(rolled).toMatchObject({ paid: null });
    expect(after.leaders[me]!.resources.food).toBe(0);
  });

  it('rolls and pays for the whole Army when the Food is there', () => {
    const state = readyToAttack({ food: 5 }, rules({ attackDieCost: { resource: 'food', amount: 1 } }));
    const me = currentPlayer(state);
    expect(getLegalActions(state, me).find((a) => a.type === 'attack')).toMatchObject({
      dice: 3,
      cost: { resource: 'food', amount: 3 },
    });

    const after = applyMove(state, { type: 'attack', player: me }).state;
    expect(after.leaders[me]!.resources.food).toBe(2);
    const rolled = after.log.find((e) => e.type === 'attackRolled');
    expect(rolled?.type === 'attackRolled' && rolled.rolls.length).toBe(3);
  });

  it('rolls only what the Food covers', () => {
    const state = readyToAttack({ food: 2 }, rules({ attackDieCost: { resource: 'food', amount: 1 } }));
    const me = currentPlayer(state);
    expect(getLegalActions(state, me).find((a) => a.type === 'attack')).toMatchObject({
      dice: 2,
      cost: { resource: 'food', amount: 2 },
    });
    const after = applyMove(state, { type: 'attack', player: me }).state;
    expect(after.leaders[me]!.resources.food).toBe(0);
  });

  it('cannot Attack at all with nothing to pay', () => {
    /* Otherwise a penniless Leader Attacks for zero dice purely to set the
       Towers off, which is not an Attack. */
    const state = readyToAttack({ food: 0 }, rules({ attackDieCost: { resource: 'food', amount: 1 } }));
    const me = currentPlayer(state);
    expect(getLegalActions(state, me).find((a) => a.type === 'attack')).toBeUndefined();
    expect(() => applyMove(state, { type: 'attack', player: me })).toThrow(/not enough food/);
  });
});

describe('committing fewer Army dice', () => {
  function ready(hand: Partial<Record<ResourceType, number>>, ruleSet = CANON_RULES) {
    const base = atAction(setupGame(['Ada', 'Peter'], 'dice', ruleSet));
    const me = currentPlayer(base);
    return withHand(
      {
        ...base,
        hosts: [{ id: 'h1', kind: 'ophanim', at: { x: 0, y: -1 }, shieldUp: false }],
        leaders: { ...base.leaders, [me]: { ...base.leaders[me]!, army: 4 } },
      },
      hand,
    );
  }

  it('rolls and pays for only the dice asked for', () => {
    const state = ready({ food: 6 }, rules({ attackDieCost: { resource: 'food', amount: 1 } }));
    const me = currentPlayer(state);
    const after = applyMove(state, { type: 'attack', player: me, dice: 2 }).state;
    expect(after.leaders[me]!.resources.food).toBe(4);
    const rolled = after.log.find((e) => e.type === 'attackRolled');
    expect(rolled?.type === 'attackRolled' && rolled.rolls.length).toBe(2);
    expect(rolled).toMatchObject({ paid: { resource: 'food', amount: 2 } });
  });

  it('refuses more dice than the Army or the Food allows', () => {
    const me = currentPlayer(ready({ food: 6 }));
    expect(() =>
      applyMove(ready({ food: 6 }, rules({ attackDieCost: { resource: 'food', amount: 1 } })), {
        type: 'attack',
        player: me,
        dice: 5,
      }),
    ).toThrow(/between 1 and 4/);
    expect(() =>
      applyMove(ready({ food: 2 }, rules({ attackDieCost: { resource: 'food', amount: 1 } })), {
        type: 'attack',
        player: me,
        dice: 3,
      }),
    ).toThrow(/between 1 and 2/);
    expect(() =>
      applyMove(ready({ food: 6 }, rules({ attackDieCost: { resource: 'food', amount: 1 } })), {
        type: 'attack',
        player: me,
        dice: 0,
      }),
    ).toThrow(/between 1 and 4/);
  });

  it('still rolls the whole Army by default under canon', () => {
    const state = ready({ food: 0 });
    const me = currentPlayer(state);
    const after = applyMove(state, { type: 'attack', player: me }).state;
    const rolled = after.log.find((e) => e.type === 'attackRolled');
    expect(rolled?.type === 'attackRolled' && rolled.rolls.length).toBe(4);
  });
});

describe('the Babel cost curve is tuneable', () => {
  const curved = rules({
    babelPieceCost: {
      1: { wood: 2, metal: 1 },
      2: { brick: 3, wood: 2 },
      3: { brick: 4, metal: 3, food: 1 },
    },
  });

  it('charges and checks against the same curve', () => {
    /* The affordability check and the payment must read the same rules. A
       defaulted argument once let the check fall back to canon while the
       payment used the variant, which threw mid-game in the harness. */
    const state = withHand(atAction(setupGame(['Ada', 'Peter'], 'curve', curved)), {
      wood: 2,
      metal: 1,
    });
    const me = currentPlayer(state);
    const babel = getLegalActions(state, me).find((a) => a.type === 'buildBabel');
    expect(babel).toMatchObject({ cost: { wood: 2, metal: 1 } });

    const after = applyMove(state, { type: 'buildBabel', player: me }).state;
    expect(after.babel.stack).toEqual([me]);
    expect(after.leaders[me]!.resources).toMatchObject({ wood: 0, metal: 0 });
  });

  it('refuses a Leader holding only the canon cost', () => {
    const state = withHand(atAction(setupGame(['Ada', 'Peter'], 'curve', curved)), {
      brick: 2,
      food: 1,
    });
    const me = currentPlayer(state);
    expect(
      getLegalActions(state, me).find((a) => a.type === 'buildBabel'),
    ).toBeUndefined();
    expect(() => applyMove(state, { type: 'buildBabel', player: me })).toThrow(/cannot afford/);
  });
});
