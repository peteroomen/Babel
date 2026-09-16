import { describe, expect, it } from 'vitest';
import {
  CANON_RULES,
  LEGACY_V01_RULES,
  TIERED_BEACONS,
  type ResourceType,
  type RuleSet,
} from '@babel-game/game-data';
import {
  applyMove,
  currentPlayer,
  beaconSpawnsThisRound,
  beaconTier,
  getLegalActions,
  getLegalTilePlacements,
  hasAnyLegalPlacement,
  hostDefence,
  isPassableAt,
  piecesPerStage,
  totalPieces,
  validateAssignments,
  setupGame,
  type GameState,
  type Host,
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

describe('levers on the resource pile', () => {
  it('a free Barter leaves the turn open, once', () => {
    const state = withHand(
      atAction(setupGame(['Ada', 'Peter'], 'free', rules({ barterIsFree: true }))),
      { wood: 8 },
    );
    const me = currentPlayer(state);
    const four = ['wood', 'wood', 'wood', 'wood'] as const;

    const after = applyMove(state, { type: 'barter', player: me, spend: four, gain: 'metal' }).state;
    /* Still this Leader's turn, still owing an action. */
    expect(currentPlayer(after)).toBe(me);
    expect(after.turnStep).toBe('action');
    expect(after.leaders[me]!.resources).toMatchObject({ wood: 4, metal: 1 });
    expect(after.freeBarterUsed).toBe(true);

    /* Exactly one, or a Leader could grind a whole hand down in a single turn. */
    expect(getLegalActions(after, me).find((a) => a.type === 'barter')).toBeUndefined();
    expect(() =>
      applyMove(after, { type: 'barter', player: me, spend: four, gain: 'metal' }),
    ).toThrow(/already taken your free Barter/);
  });

  it('a paid Barter still ends the turn', () => {
    const state = withHand(atAction(setupGame(['Ada', 'Peter'], 'paid')), { wood: 8 });
    const me = currentPlayer(state);
    const after = applyMove(state, {
      type: 'barter',
      player: me,
      spend: ['wood', 'wood', 'wood', 'wood'],
      gain: 'metal',
    }).state;
    expect(currentPlayer(after)).not.toBe(me);
  });

  it('builds several Babel pieces in one action, paying each Stage in turn', () => {
    const state = withHand(
      atAction(setupGame(['Ada', 'Peter'], 'many', rules({ babelPiecesPerAction: 3 }))),
      { brick: 9, wood: 9, food: 9, metal: 9 },
    );
    const me = currentPlayer(state);
    const babel = getLegalActions(state, me).find((a) => a.type === 'buildBabel');
    expect(babel).toMatchObject({ pieces: 3 });

    const after = applyMove(state, { type: 'buildBabel', player: me }).state;
    expect(after.babel.stack).toEqual([me, me, me]);
    /* 2 Leaders build 3 pieces per Stage, so the third piece escalates. */
    expect(after.stage).toBe(2);
    /* The first three pieces are Stage I at 1 Brick + 1 Wood + 1 Food each. */
    expect(after.leaders[me]!.resources).toMatchObject({ brick: 6, wood: 6, food: 6 });
    expect(after.leaders[me]!.prestige).toBe(6);
  });

  it('stops early when the hand runs out mid-action', () => {
    const state = withHand(
      atAction(setupGame(['Ada', 'Peter'], 'short', rules({ babelPiecesPerAction: 5 }))),
      { brick: 2, wood: 2, food: 2, metal: 0 },
    );
    const me = currentPlayer(state);
    const after = applyMove(state, { type: 'buildBabel', player: me }).state;
    expect(after.babel.stack).toHaveLength(2);
    expect(after.leaders[me]!.resources).toMatchObject({ brick: 0, wood: 0, food: 0 });
  });

  it('spoils what a Leader holds over the cap, at the end of their turn', () => {
    const state = withHand(atAction(setupGame(['Ada', 'Peter'], 'cap', rules({ resourceCap: 5 }))), {
      wood: 9,
      food: 3,
    });
    const me = currentPlayer(state);
    const after = applyMove(state, { type: 'pass', player: me }).state;
    expect(after.leaders[me]!.resources).toMatchObject({ wood: 5, food: 3 });
    expect(after.log).toContainEqual({
      type: 'resourcesSpoiled',
      player: me,
      lost: { wood: 4 },
    });
  });

  it('charges Army upkeep each Heaven Phase, and starves an Army that cannot pay', () => {
    const base = setupGame(['Ada', 'Peter'], 'upkeep', rules({ armyUpkeepFood: 1 }));
    const me = currentPlayer(base);
    const other = base.order.find((id) => id !== me)!;
    const state: GameState = {
      ...base,
      phase: 'heaven',
      leaders: {
        ...base.leaders,
        [me]: { ...base.leaders[me]!, army: 3, resources: { food: 5, wood: 0, brick: 0, metal: 0 } },
        [other]: {
          ...base.leaders[other]!,
          army: 4,
          resources: { food: 1, wood: 0, brick: 0, metal: 0 },
        },
      },
    };
    const after = applyMove(state, { type: 'resolveHeaven', player: me }).state;

    /* Paid in full: three dice kept, three Food gone. */
    expect(after.leaders[me]!.army).toBe(3);
    expect(after.leaders[me]!.resources.food).toBe(2);
    /* Could only feed one die, so the rest starve rather than going into debt. */
    expect(after.leaders[other]!.army).toBe(1);
    expect(after.leaders[other]!.resources.food).toBe(0);
  });
});

describe('Heaven with more than one kind of gate', () => {
  const tiered = rules({ beaconTiers: TIERED_BEACONS });

  it('sends a different Host from each Beacon, by the order they were sited', () => {
    /* GDD §13 numbers Beacons by siting order; the ruleset maps that to a gate. */
    expect(beaconTier(0, tiered)?.kind).toBe('ophanim');
    expect(beaconTier(1, tiered)?.kind).toBe('zealot');
    expect(beaconTier(2, tiered)?.kind).toBe('flier');
    /* A fourth Beacon cycles rather than running out of gates. */
    expect(beaconTier(3, tiered)?.kind).toBe('ophanim');
    expect(beaconTier(0, CANON_RULES)).toBeNull();
  });

  it('staggers the slower gates so they alternate rather than arrive together', () => {
    const rounds = [1, 2, 3, 4, 5, 6];
    const first = rounds.map((r) => beaconSpawnsThisRound(0, r, tiered));
    const second = rounds.map((r) => beaconSpawnsThisRound(1, r, tiered));
    const third = rounds.map((r) => beaconSpawnsThisRound(2, r, tiered));

    expect(first).toEqual([true, true, true, true, true, true]);
    expect(second).toEqual([false, true, false, true, false, true]);
    expect(third).toEqual([true, false, true, false, true, false]);
    /* Never both slow gates in the same round. */
    for (const r of rounds) expect(second[r - 1] && third[r - 1]).toBe(false);
  });

  it('makes the tougher kinds need a better roll', () => {
    const base = hostDefence(3, 1, tiered, 'ophanim');
    expect(hostDefence(3, 1, tiered, 'zealot')).toBe(base + 1);
    expect(hostDefence(3, 1, tiered, 'flier')).toBe(base + 1);
    /* And the blunt knob stacks on top of the kind. */
    expect(hostDefence(3, 1, rules({ hostDefenceBonus: [2, 0, 0] }), 'zealot')).toBe(base + 3);
  });

  it('lets a Throne cross the rivers that stop everything else', () => {
    const board = {
      '0,-1': { terrain: 'farmland', river: 'straight', rotation: 0 },
    } as const;
    /* A river tile is impassable on foot and irrelevant in the air. */
    expect(isPassableAt(board, { x: 0, y: -1 })).toBe(false);
    expect(
      isPassableAt(board, { x: 0, y: -1 }, { impassable: ['lake'], flies: true }),
    ).toBe(true);
  });

  it('will not let a die spent on a Zealot be one that only beat an Ophanim', () => {
    const hosts: Host[] = [
      { id: 'soft', kind: 'ophanim', at: { x: 0, y: 1 }, shieldUp: false },
      { id: 'hard', kind: 'zealot', at: { x: 0, y: 2 }, shieldUp: false },
    ];
    const scored = {
      /* One die clears Defence 6, the other only Defence 5. */
      rolls: [4, 3],
      bonus: 2,
      defenceOf: (host: Host) => (host.kind === 'zealot' ? 6 : 5),
    };
    expect(validateAssignments(hosts, { soft: 1, hard: 1 }, 2, scored)).toBeNull();
    /* Both hits on the Zealot needs two dice that beat 6, and only one did. */
    expect(validateAssignments(hosts, { hard: 2 }, 2, scored)).toMatch(/not enough dice/);
  });
});

describe('Munitions', () => {
  it('buys extra Attack dice out of the pile', () => {
    const munitions = { cost: { metal: 1, wood: 1 }, maxExtraDice: 3 };
    const base = atAction(setupGame(['Ada', 'Peter'], 'muni', rules({ munitions })));
    const me = currentPlayer(base);
    const state = withHand(
      {
        ...base,
        hosts: [{ id: 'h1', kind: 'ophanim', at: { x: 0, y: -1 }, shieldUp: false }],
        leaders: { ...base.leaders, [me]: { ...base.leaders[me]!, army: 1 } },
      },
      { metal: 4, wood: 4 },
    );

    const after = applyMove(state, { type: 'attack', player: me, extraDice: 2 }).state;
    const rolled = after.log.find((e) => e.type === 'attackRolled');
    /* One Army die plus two bought. */
    expect(rolled?.type === 'attackRolled' && rolled.rolls.length).toBe(3);
    expect(after.leaders[me]!.resources).toMatchObject({ metal: 2, wood: 2 });
  });

  it('refuses more than the rules allow, or than the Leader can pay for', () => {
    const munitions = { cost: { metal: 1, wood: 1 }, maxExtraDice: 3 };
    const base = atAction(setupGame(['Ada', 'Peter'], 'muni', rules({ munitions })));
    const me = currentPlayer(base);
    const poor = withHand(
      {
        ...base,
        hosts: [{ id: 'h1', kind: 'ophanim', at: { x: 0, y: -1 }, shieldUp: false }],
      },
      { metal: 1, wood: 1 },
    );
    expect(() => applyMove(poor, { type: 'attack', player: me, extraDice: 3 })).toThrow(
      /cannot afford/,
    );
  });

  it('is refused entirely where the rules have no Munitions', () => {
    const base = atAction(setupGame(['Ada', 'Peter'], 'none'));
    const me = currentPlayer(base);
    const state = withHand(
      { ...base, hosts: [{ id: 'h1', kind: 'ophanim', at: { x: 0, y: -1 }, shieldUp: false }] },
      { metal: 4, wood: 4 },
    );
    expect(() => applyMove(state, { type: 'attack', player: me, extraDice: 1 })).toThrow(
      /no Munitions/,
    );
  });
});

describe('Babel can be made shorter', () => {
  it('overrides the pieces each Stage needs', () => {
    const short = rules({ piecesPerStage: 2 });
    expect(piecesPerStage(3, short)).toBe(2);
    expect(totalPieces(3, short)).toBe(6);
    /* The scaling table still governs when no override is given. */
    expect(piecesPerStage(3)).toBe(5);
    expect(totalPieces(3)).toBe(15);
  });
});
