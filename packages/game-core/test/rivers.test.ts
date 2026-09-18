import { describe, expect, it } from 'vitest';
import { CANON_RULES, CANON_WALLS, V05_RULES, type RuleSet } from '@babel-game/game-data';
import {
  applyMove,
  babelRiverDistances,
  babelRiverReach,
  babelRiverTiles,
  coordKey,
  getLegalActions,
  riverGainFor,
  riverPrestigeFor,
  setupGame,
  type Board,
  type GameState,
  type PlacedTile,
} from '../src/index.js';

/** GDD §5's fixed opening: a Farmland tile north of Babel, river running in. */
const START: Board = { '0,-1': { terrain: 'farmland', river: 'straight', rotation: 0 } };

const board = (tiles: Record<string, PlacedTile>): Board => ({ ...START, ...tiles });

/**
 * A chain running north with a spur pointing east off its middle tile.
 *
 *   (0,-3) straight   distance 3, and the head of the river
 *   (0,-2) tee        distance 2, with an unused arm facing east
 *   (0,-1) the fixed opening tile, distance 1
 *
 * A tile hung on that eastern arm sits at distance 3 as well, so it lengthens
 * the river without lengthening its reach — which is exactly the case the two
 * readings of the rule disagree about.
 */
const BRANCHED: Board = {
  ...START,
  '0,-2': { terrain: 'farmland', river: 'tee', rotation: 1 },
  '0,-3': { terrain: 'forest', river: 'straight', rotation: 0 },
};

const RIVER_RULES = (over: Partial<NonNullable<RuleSet['riverPrestige']>> = {}): RuleSet => ({
  ...V05_RULES,
  riverPrestige: { perTile: 1, requireReach: true, cap: null, milestone: null, ...over },
});

describe('the river that reaches Babel', () => {
  it('starts one tile long, at the fixed opening tile', () => {
    expect(babelRiverTiles(START)).toBe(1);
    expect(babelRiverReach(START)).toBe(1);
    expect(babelRiverDistances(START)[coordKey({ x: 0, y: -1 })]).toBe(1);
  });

  it('counts a chain running north, tile by tile', () => {
    const chain = board({
      '0,-2': { terrain: 'forest', river: 'straight', rotation: 0 },
      '0,-3': { terrain: 'farmland', river: 'straight', rotation: 0 },
    });
    expect(babelRiverTiles(chain)).toBe(3);
    expect(babelRiverReach(chain)).toBe(3);
  });

  it('ignores water that does not reach Babel', () => {
    const elsewhere = board({
      /* A straight pair two squares east, connected to each other and to
         nothing else. Real river, somebody else's problem. */
      '2,-1': { terrain: 'forest', river: 'straight', rotation: 0 },
      '2,-2': { terrain: 'forest', river: 'straight', rotation: 0 },
    });
    expect(babelRiverTiles(elsewhere)).toBe(1);
  });

  it('tells a longer river from a wider one', () => {
    /* A tee two tiles up branches east; the chain runs on north past it. Water
       hung off the branch is a tile the river did not have, at a distance the
       river had already reached — wider, not longer. */
    const forked = BRANCHED;
    const reach = babelRiverReach(forked);
    const widened = {
      ...forked,
      '1,-2': { terrain: 'forest', river: 'source', rotation: 3 } as PlacedTile,
    };
    expect(babelRiverTiles(widened)).toBe(babelRiverTiles(forked) + 1);
    expect(babelRiverReach(widened)).toBe(reach);
  });
});

describe('Prestige for lengthening it', () => {
  const upstream = { x: 0, y: -2 };
  const straight = { terrain: 'farmland', river: 'straight' } as const;

  it('pays under canon, which has carried the rule since v0.4', () => {
    expect(riverPrestigeFor(START, upstream, straight, 0, CANON_RULES)).toBe(1);
  });

  it('pays nothing where the rule is off', () => {
    const off = { ...CANON_RULES, riverPrestige: null };
    expect(riverPrestigeFor(START, upstream, straight, 0, off)).toBe(0);
  });

  it('pays for a placement that pushes the river further upstream', () => {
    expect(riverPrestigeFor(START, upstream, straight, 0, RIVER_RULES())).toBe(1);
  });

  it('does not pay again when a shortcut reduced the current reach below its record', () => {
    /* A saved high-water mark survives loops and shortcuts: growing from the
       current reach 1 to 2 is still below the previously recorded reach 3. */
    expect(riverPrestigeFor(START, upstream, straight, 0, RIVER_RULES(), 0, undefined, 3)).toBe(0);
  });

  it('pays nothing for a river tile that never touches Babel’s water', () => {
    const away = { x: 1, y: -1 };
    const gain = riverGainFor(START, away, straight, 1);
    expect(gain.joined).toBe(false);
    expect(riverPrestigeFor(START, away, straight, 1, RIVER_RULES())).toBe(0);
  });

  it('pays nothing for a riverless tile', () => {
    const plain = { terrain: 'hills', river: 'none' } as const;
    expect(riverPrestigeFor(START, upstream, plain, 0, RIVER_RULES())).toBe(0);
  });

  it('pays for widening only when reach is not required', () => {
    const at = { x: 1, y: -2 };
    /* A source facing west caps the tee's eastern arm: more water, same reach. */
    const cap = { terrain: 'forest', river: 'source' } as const;
    const gain = riverGainFor(BRANCHED, at, cap, 3);
    expect(gain.joined).toBe(true);
    expect(gain.reachAfter).toBe(gain.reachBefore);
    expect(riverPrestigeFor(BRANCHED, at, cap, 3, RIVER_RULES())).toBe(0);
    expect(riverPrestigeFor(BRANCHED, at, cap, 3, RIVER_RULES({ requireReach: false }))).toBe(1);
  });

  it('pays only at a milestone when the rule asks for one', () => {
    /* Reach runs 1 -> 2 -> 3; with a milestone of 3 only the tile that takes
       the river to 3 is paid, and it is paid the full price. */
    const rules = RIVER_RULES({ perTile: 2, milestone: 3 });
    const two = board({ '0,-2': { terrain: 'forest', river: 'straight', rotation: 0 } });
    expect(riverPrestigeFor(START, upstream, straight, 0, rules)).toBe(0);
    expect(riverPrestigeFor(two, { x: 0, y: -3 }, straight, 0, rules)).toBe(2);
  });

  it('stops paying once a Leader hits the cap', () => {
    const rules = RIVER_RULES({ perTile: 2, cap: 8 });
    expect(riverPrestigeFor(START, upstream, straight, 0, rules, 6)).toBe(2);
    /* Seven earned and two owed pays the one point left, not the second. */
    expect(riverPrestigeFor(START, upstream, straight, 0, rules, 7)).toBe(1);
    expect(riverPrestigeFor(START, upstream, straight, 0, rules, 8)).toBe(0);
  });

  it('credits the Leader who placed the tile, once, in the log', () => {
    let state: GameState = setupGame(['A', 'B'], 'river-award', RIVER_RULES());
    /* Hand the Leader a tile that extends the river, rather than waiting for
       the bag to deal one. */
    state = { ...state, drawnTile: { terrain: 'farmland', river: 'straight' } };
    const me = state.order[0]!;
    const before = state.leaders[me]!.prestige;

    const after = applyMove(state, {
      type: 'placeTile',
      player: me,
      at: upstream,
      rotation: 0,
    }).state;

    expect(after.leaders[me]!.prestige).toBe(before + 1);
    expect(after.riverReachRecord).toBe(2);
    const awards = after.log.filter(
      (event) => event.type === 'prestigeGained' && event.source === 'river',
    );
    expect(awards).toHaveLength(1);
  });

  it('preserves a higher river record through a shortcut-era placement', () => {
    let state: GameState = setupGame(['A', 'B'], 'river-record', RIVER_RULES());
    state = {
      ...state,
      riverReachRecord: 3,
      drawnTile: { terrain: 'farmland', river: 'straight' },
    };
    const me = state.order[0]!;
    const after = applyMove(state, {
      type: 'placeTile', player: me, at: upstream, rotation: 0,
    }).state;
    expect(after.leaders[me]!.prestige).toBe(state.leaders[me]!.prestige);
    expect(after.riverReachRecord).toBe(3);
  });
});

describe('the Walls lever', () => {
  /* Walls need two adjacent land tiles to sit between, and four of them to
     have room for a four-segment action, so the opening board is a 2x2 block
     around the fixed start tile. */
  const BLOCK: Record<string, PlacedTile> = {
    '1,-1': { terrain: 'hills', river: 'none', rotation: 0 },
    '0,-2': { terrain: 'forest', river: 'none', rotation: 0 },
    '1,-2': { terrain: 'hills', river: 'none', rotation: 0 },
  };

  const opening = (rules: RuleSet): GameState => {
    const state = setupGame(['A', 'B'], 'walls-lever', rules);
    /* Past the placement step and in funds, so the Wall action stands or falls
       on the rules rather than on the turn or the purse. */
    const me = state.order[0]!;
    return {
      ...state,
      board: board(BLOCK),
      turnStep: 'action',
      drawnTile: null,
      leaders: {
        ...state.leaders,
        [me]: { ...state.leaders[me]!, resources: { food: 4, wood: 4, brick: 4, metal: 4 } },
      },
    };
  };

  const wallAction = (state: GameState) =>
    getLegalActions(state, state.order[0]!).find((action) => action.type === 'buildWalls');

  it('offers no Wall action under canon, which dropped them in v0.4', () => {
    expect(wallAction(opening(CANON_RULES))).toBeUndefined();
  });

  it('offers two segments where a table has switched them back on', () => {
    const walls = wallAction(opening({ ...CANON_RULES, walls: CANON_WALLS }));
    expect(walls?.type === 'buildWalls' && walls.segments).toBe(2);
  });

  it('places as many segments as the ruleset says', () => {
    const rules = { ...CANON_RULES, walls: { cost: { wood: 1 }, segments: 4, prestige: 1 } };
    const walls = wallAction(opening(rules));
    expect(walls?.type === 'buildWalls' && walls.segments).toBe(4);
  });

  it('removes the action entirely when Walls are not in play', () => {
    const state = opening({ ...CANON_RULES, walls: null });
    expect(wallAction(state)).toBeUndefined();
    expect(() =>
      applyMove(state, {
        type: 'buildWalls',
        player: state.order[0]!,
        edges: [{ a: { x: 0, y: -1 }, b: { x: 1, y: -1 } }],
      }),
    ).toThrow(/not in play/);
  });
});
