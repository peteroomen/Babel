import { describe, expect, it } from 'vitest';
import { applyMove, setupGame, type GameState, type PendingVote } from '../src/index.js';

const vote: PendingVote = {
  id: 'beacon-1',
  question: 'Where does the first Beacon go?',
  options: ['north ridge', 'south flats', 'east desert'],
  votes: {},
};

function withVote(names: string[], seed = 'seed'): GameState {
  return { ...setupGame(names, seed), pendingVote: vote };
}

describe('collective decisions', () => {
  it('stays open until every Leader has voted', () => {
    const state = withVote(['Ada', 'Peter', 'Rook']);
    const after = applyMove(state, { type: 'castVote', player: 'p0', option: 0 }).state;
    expect(after.pendingVote).not.toBeNull();
    expect(after.pendingVote!.votes).toEqual({ p0: 0 });
  });

  it('resolves on a clear majority without a coin flip', () => {
    let state = withVote(['Ada', 'Peter', 'Rook']);
    state = applyMove(state, { type: 'castVote', player: 'p0', option: 1 }).state;
    state = applyMove(state, { type: 'castVote', player: 'p1', option: 1 }).state;
    const result = applyMove(state, { type: 'castVote', player: 'p2', option: 2 });

    expect(result.state.pendingVote).toBeNull();
    const resolved = result.events.find((e) => e.type === 'voteResolved');
    expect(resolved).toMatchObject({ choice: 'south flats', byCoinFlip: false });
  });

  it('breaks a tie with the seeded coin flip', () => {
    let state = withVote(['Ada', 'Peter']);
    state = applyMove(state, { type: 'castVote', player: 'p0', option: 0 }).state;
    const result = applyMove(state, { type: 'castVote', player: 'p1', option: 2 });

    const resolved = result.events.find((e) => e.type === 'voteResolved');
    expect(resolved).toMatchObject({ byCoinFlip: true });
    /* The flip only ever picks from the tied options, never an unvoted one. */
    expect(['north ridge', 'east desert']).toContain(
      (resolved as { choice: string }).choice,
    );
  });

  it('breaks ties reproducibly for a given seed', () => {
    const decide = () => {
      let state = withVote(['Ada', 'Peter'], 'tie-seed');
      state = applyMove(state, { type: 'castVote', player: 'p0', option: 0 }).state;
      const result = applyMove(state, { type: 'castVote', player: 'p1', option: 2 });
      return result.events.find((e) => e.type === 'voteResolved');
    };
    expect(decide()).toEqual(decide());
  });

  it('does not favour the lowest option index across many seeded ties', () => {
    const outcomes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      let state = withVote(['Ada', 'Peter'], `seed-${i}`);
      state = applyMove(state, { type: 'castVote', player: 'p0', option: 0 }).state;
      const result = applyMove(state, { type: 'castVote', player: 'p1', option: 2 });
      const resolved = result.events.find((e) => e.type === 'voteResolved') as {
        choice: string;
      };
      outcomes.add(resolved.choice);
    }
    expect(outcomes.size).toBe(2);
  });

  it('lets a Leader change their mind before the vote closes', () => {
    let state = withVote(['Ada', 'Peter', 'Rook']);
    state = applyMove(state, { type: 'castVote', player: 'p0', option: 0 }).state;
    state = applyMove(state, { type: 'castVote', player: 'p0', option: 2 }).state;
    expect(state.pendingVote!.votes).toEqual({ p0: 2 });
  });

  it('rejects unknown players and out-of-range options', () => {
    const state = withVote(['Ada', 'Peter']);
    expect(() => applyMove(state, { type: 'castVote', player: 'ghost', option: 0 })).toThrow();
    expect(() => applyMove(state, { type: 'castVote', player: 'p0', option: 9 })).toThrow();
  });

  it('blocks normal play while a vote is open', () => {
    const state = withVote(['Ada', 'Peter']);
    const me = state.order[state.currentPlayerIndex] as string;
    expect(() =>
      applyMove(state, { type: 'placeTile', player: me, at: { x: 1, y: 0 }, rotation: 0 }),
    ).toThrow(/vote is open/);
  });
});
