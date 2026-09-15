import { describe, expect, it } from 'vitest';
import {
  applyMove,
  currentPlayer,
  isLegalPlacement,
  playerView,
  setupGame,
  type Command,
  type GameState,
} from '../src/index.js';

const run = (state: GameState, commands: readonly Command[]): GameState =>
  commands.reduce((s, c) => applyMove(s, c).state, state);

/** Place the drawn tile somewhere legal, then pass. */
function playTurn(state: GameState): GameState {
  const me = currentPlayer(state);
  const spot = [
    { x: 0, y: -2 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 2, y: 0 },
    { x: 0, y: 2 },
  ].find((c) => isLegalPlacement(state, c));
  if (!spot) throw new Error('no legal placement in fixture');
  return run(state, [
    { type: 'placeTile', player: me, at: spot },
    { type: 'takeAction', player: me, action: 'pass' },
  ]);
}

describe('setup', () => {
  it('rejects player counts outside 2-4', () => {
    expect(() => setupGame(['solo'], 's')).toThrow();
    expect(() => setupGame(['a', 'b', 'c', 'd', 'e'], 's')).toThrow();
  });

  it('starts every Leader on 2 Wood, 1 Food, Army 1, 0 Prestige', () => {
    const state = setupGame(['Ada', 'Peter'], 'seed');
    for (const leader of Object.values(state.leaders)) {
      expect(leader.resources).toEqual({ food: 1, wood: 2, brick: 0, metal: 0 });
      expect(leader.army).toBe(1);
      expect(leader.prestige).toBe(0);
    }
  });

  it('places the fixed river Farmland north of Babel', () => {
    const state = setupGame(['Ada', 'Peter'], 'seed');
    expect(state.board['0,-1']).toEqual({ terrain: 'farmland', riverEdges: ['n', 's'] });
  });

  it('is fully reproducible from its seed', () => {
    const a = setupGame(['Ada', 'Peter', 'Rook'], 'same');
    const b = setupGame(['Ada', 'Peter', 'Rook'], 'same');
    expect(a).toEqual(b);
  });
});

describe('placement legality', () => {
  const state = setupGame(['Ada', 'Peter'], 'seed');

  it('allows a tile orthogonally adjacent to Babel', () => {
    expect(isLegalPlacement(state, { x: 1, y: 0 })).toBe(true);
  });

  it('allows a tile orthogonally adjacent to an existing tile', () => {
    expect(isLegalPlacement(state, { x: 0, y: -2 })).toBe(true);
  });

  it('rejects a floating tile', () => {
    expect(isLegalPlacement(state, { x: 5, y: 5 })).toBe(false);
  });

  it('rejects a diagonal-only placement', () => {
    expect(isLegalPlacement(state, { x: 1, y: -2 })).toBe(false);
  });

  it('rejects an occupied square and the Babel square itself', () => {
    expect(isLegalPlacement(state, { x: 0, y: -1 })).toBe(false);
    expect(isLegalPlacement(state, { x: 0, y: 0 })).toBe(false);
  });
});

describe('turn structure', () => {
  it('enforces draw, place, then exactly one action', () => {
    const state = setupGame(['Ada', 'Peter'], 'seed');
    const me = currentPlayer(state);
    expect(state.turnStep).toBe('place');
    expect(() => applyMove(state, { type: 'takeAction', player: me, action: 'pass' })).toThrow(
      /place your tile first/,
    );

    const placed = applyMove(state, { type: 'placeTile', player: me, at: { x: 1, y: 0 } }).state;
    expect(placed.turnStep).toBe('action');
    expect(() =>
      applyMove(placed, { type: 'placeTile', player: me, at: { x: -1, y: 0 } }),
    ).toThrow(/already placed/);
  });

  it('refuses commands from a player whose turn it is not', () => {
    const state = setupGame(['Ada', 'Peter'], 'seed');
    const other = state.order.find((id) => id !== currentPlayer(state)) as string;
    expect(() =>
      applyMove(state, { type: 'placeTile', player: other, at: { x: 1, y: 0 } }),
    ).toThrow(/not your turn/);
  });

  it('draws a fresh tile for each player at the start of their turn', () => {
    let state = setupGame(['Ada', 'Peter'], 'seed');
    expect(state.drawnTile).not.toBeNull();
    state = playTurn(state);
    expect(state.drawnTile).not.toBeNull();
    expect(state.turnStep).toBe('place');
  });

  it('runs the Heaven Phase and rotates first player at the round boundary', () => {
    let state = setupGame(['Ada', 'Peter', 'Rook'], 'seed');
    const firstPlayerAtStart = state.firstPlayerIndex;
    for (let i = 0; i < 3; i++) state = playTurn(state);

    expect(state.round).toBe(2);
    expect(state.firstPlayerIndex).toBe((firstPlayerAtStart + 1) % 3);
    expect(state.currentPlayerIndex).toBe(state.firstPlayerIndex);
    expect(state.log.some((e) => e.type === 'heavenPhase')).toBe(true);
  });

  it('gives every Leader exactly one turn per round', () => {
    let state = setupGame(['Ada', 'Peter', 'Rook', 'Vex'], 'seed');
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(currentPlayer(state));
      state = playTurn(state);
    }
    expect(new Set(seen).size).toBe(4);
    expect(state.round).toBe(2);
  });
});

describe('determinism', () => {
  it('replays identically from the same seed and command sequence', () => {
    const play = () => {
      let state = setupGame(['Ada', 'Peter'], 'replay-seed');
      for (let i = 0; i < 6; i++) state = playTurn(state);
      return state;
    };
    expect(play()).toEqual(play());
  });

  it('keeps state JSON-serializable for a future server', () => {
    let state = setupGame(['Ada', 'Peter'], 'seed');
    for (let i = 0; i < 4; i++) state = playTurn(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('hidden information', () => {
  it('hides other Leaders Scheme hands from a player view', () => {
    const base = setupGame(['Ada', 'Peter'], 'seed');
    const state: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, schemeHand: ['frenzied-works'] },
        p1: { ...base.leaders['p1']!, schemeHand: ['common-tongue'] },
      },
    };

    const ada = playerView(state, 'p0');
    expect(ada.leaders['p0']!.schemeHand).toEqual(['frenzied-works']);
    expect(ada.leaders['p1']!.schemeHand).toEqual([]);
  });
});
