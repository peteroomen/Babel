import { describe, expect, it } from 'vitest';
import { CANON_RULES } from '@babel-game/game-data';
import {
  getLegalTilePlacements,
  previewPlacement,
  setupGame,
  type GameState,
} from '@babel-game/game-core';
import { bestPlacement, threatDistance } from '../src/policy.js';

const bankRules = { ...CANON_RULES, bankMode: 'resources' as const };

const withHost = (
  state: GameState,
  at: { x: number; y: number },
  region = 0,
): GameState => ({
  ...state,
  hosts: [{ id: 'h1', kind: 'ophanim', at, region, shieldUp: false, damage: 0 }],
});

describe('bank-aware AI policy', () => {
  it('uses the bank graph for a walking Host and reports off-graph Hosts as infinitely far', () => {
    const state = setupGame(['a', 'b'], 'bank-threat', { ...CANON_RULES, bankMode: 'hosts' });
    expect(threatDistance(withHost(state, { x: 0, y: 1 }))).toBe(1);
    expect(threatDistance(withHost(state, { x: 9, y: 9 }))).toBe(Infinity);
  });

  it('scores every legal bank rotation against the occupied-bank payout', () => {
    const initial = setupGame(['a', 'b'], 'bank-placement', bankRules);
    const state = withHost(initial, { x: 0, y: -1 }, 1);
    const draw = { terrain: 'farmland' as const, river: 'straight' as const };
    const chosen = bestPlacement(state, 'p0', draw, 'architect', () => 0);
    expect(chosen).not.toBeNull();
    const options = getLegalTilePlacements(state.board, draw, bankRules).find(
      (option) => option.at.x === chosen!.at.x && option.at.y === chosen!.at.y,
    );
    expect(options).toBeDefined();
    expect(options!.rotations).toContain(chosen!.rotation);
    const first = options!.rotations[0]!;
    const firstPayout = previewPlacement(state, chosen!.at, draw, first);
    const selectedPayout = previewPlacement(state, chosen!.at, draw, chosen!.rotation);
    expect(selectedPayout?.amount ?? 0).toBeGreaterThanOrEqual(firstPayout?.amount ?? 0);
  });
});

