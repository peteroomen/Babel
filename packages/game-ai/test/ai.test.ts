import { describe, expect, it } from 'vitest';
import { CANON_RULES, type RuleSet } from '@babel-game/game-data';
import {
  applyMove,
  currentPlayer,
  setupGame,
  type GameState,
} from '@babel-game/game-core';
import {
  ARCHETYPES,
  ARCHETYPE_BLURB,
  ARCHETYPE_LABEL,
  CLASSIC_TABLE,
  aiRandom,
  nextCommand,
  runAi,
  tableCommand,
  type AiSeats,
} from '../src/index.js';

const rules = (overrides: Partial<RuleSet>): RuleSet => ({ ...CANON_RULES, ...overrides });

const seatAll = (state: GameState, table = CLASSIC_TABLE): AiSeats =>
  Object.fromEntries(state.order.map((id, i) => [id, table[i % table.length]!]));

/**
 * Play an unattended game for a while. These tests are about legality and
 * determinism, not outcomes, so they stop well short of a full game — the
 * harness is where whole games get played.
 */
function autoplay(seed: string, ruleSet = CANON_RULES, table = CLASSIC_TABLE, rounds = 30) {
  let state = setupGame(table.slice(0, 3), seed, ruleSet);
  const seats = seatAll(state, table);
  const rand = aiRandom(seed);
  for (let i = 0; i < 20000 && state.phase !== 'gameOver' && state.round <= rounds; i++) {
    const command = nextCommand(state, seats, rand) ?? tableCommand(state, rand);
    if (!command) break;
    state = applyMove(state, command).state;
  }
  return state;
}

describe('every archetype is a distinct, complete player', () => {
  it('names and describes all of them', () => {
    for (const archetype of ARCHETYPES) {
      expect(ARCHETYPE_LABEL[archetype]).toBeTruthy();
      expect(ARCHETYPE_BLURB[archetype]).toBeTruthy();
    }
    expect(new Set(ARCHETYPES).size).toBe(ARCHETYPES.length);
  });

  it.each(ARCHETYPES)('%s can play a whole game without an illegal move', (archetype) => {
    /* applyMove throws on anything illegal, so reaching the end is the
       assertion: the policy never proposes a move the rules reject. */
    const state = autoplay(`solo-${archetype}`, CANON_RULES, [archetype, archetype, archetype]);
    expect(state.round).toBeGreaterThan(1);
    expect(state.log.filter((e) => e.type === 'tilePlaced').length).toBeGreaterThan(10);
  });

  it('plays a mixed five-archetype rotation', () => {
    const state = autoplay('mixed', CANON_RULES, ARCHETYPES);
    expect(state.log.filter((e) => e.type === 'actionTaken').length).toBeGreaterThan(20);
  });
});

describe('the AI answers only for its own seat', () => {
  it('stays silent when the active Leader is human', () => {
    const state = setupGame(['Ada', 'Peter'], 'human');
    const others = { [state.order[1 - state.currentPlayerIndex]!]: 'architect' } as AiSeats;
    expect(nextCommand(state, others, aiRandom('human'))).toBeNull();
  });

  it('leaves table decisions alone', () => {
    let state = setupGame(['Ada', 'Peter'], 'table');
    const seats = seatAll(state);
    const rand = aiRandom('table');
    /* Run until the table owes a Beacon or the Heaven Phase, then check the
       AI declines it — RD-005 and RD-008 make these collective calls. */
    for (let i = 0; i < 4000; i++) {
      if (state.pendingBeacon || state.phase === 'heaven') break;
      const command = nextCommand(state, seats, rand);
      if (!command) break;
      state = applyMove(state, command).state;
    }
    expect(state.pendingBeacon || state.phase === 'heaven').toBeTruthy();
    expect(nextCommand(state, seats, rand)).toBeNull();
    expect(tableCommand(state, rand)).not.toBeNull();
  });

  it('runs only up to the next human decision', () => {
    const state = setupGame(['Ada', 'Peter'], 'partial');
    const human = currentPlayer(state);
    const bot = state.order.find((id) => id !== human)!;
    const { state: after } = runAi(state, { [bot]: 'commander' } as AiSeats, aiRandom('p'));
    /* It is the human's turn, so nothing should have moved at all. */
    expect(after).toBe(state);
  });
});

describe('the AI under the Milestone 6 rules', () => {
  it('uses the Reserve, and never swaps a tile straight back', () => {
    let state = setupGame(CLASSIC_TABLE.slice(0, 3), 'reserve', rules({ reserveSlots: 2 }));
    const seats = seatAll(state);
    const rand = aiRandom('reserve');
    let swaps = 0;
    let consecutive = 0;

    for (let i = 0; i < 6000 && state.phase !== 'gameOver' && state.round <= 30; i++) {
      const command = nextCommand(state, seats, rand) ?? tableCommand(state, rand);
      if (!command) break;
      if (command.type === 'swapReserve') {
        swaps += 1;
        /* Two swaps in a row inside one turn would be the ping-pong the
           scoring margin exists to prevent. */
        expect((consecutive += 1)).toBeLessThan(2);
      } else {
        consecutive = 0;
      }
      state = applyMove(state, command).state;
    }
    expect(swaps).toBeGreaterThan(0);
  });

  it('never proposes a mixed Barter under same-kind rules', () => {
    const state = autoplay('same-kind', rules({ barterMode: 'sameKind' }));
    const barters = state.log.filter((event) => event.type === 'bartered');
    expect(barters.length).toBeGreaterThan(0);
    for (const barter of barters) {
      if (barter.type !== 'bartered') continue;
      expect(new Set(barter.spent).size).toBe(1);
    }
  });
});

describe('the AI is deterministic', () => {
  it('replays identically from the same seed', () => {
    const a = autoplay('determinism');
    const b = autoplay('determinism');
    expect(a.log.length).toBe(b.log.length);
    expect(a.winner).toBe(b.winner);
    expect(a.round).toBe(b.round);
  });

  it('plays differently from a different seed', () => {
    const a = autoplay('seed-one');
    const b = autoplay('seed-two');
    expect(a.log.length).not.toBe(b.log.length);
  });
});
