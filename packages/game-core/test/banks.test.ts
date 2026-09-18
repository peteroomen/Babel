import { describe, expect, it } from 'vitest';
import { CANON_RULES } from '@babel-game/game-data';
import { RIVER_SHAPE_EDGES } from '@babel-game/game-data';
import { basePayout, bankPlacementPayout } from '../src/economy/payout.js';
import { resolveBankHarvest } from '../src/economy/harvest.js';
import { getLegalBuildSites } from '../src/buildings/index.js';
import { bankDistancesToBabel, bankStepOptions, dryRegions, regionTransitions } from '../src/heaven/banks.js';
import { babelRiverDistancesThroughBabel } from '../src/rivers/index.js';
import { riverGainFor } from '../src/rivers/index.js';
import { setupGame } from '../src/state/setup.js';
import type { Board } from '../src/map/placement.js';
import type { LeaderState } from '../src/state/types.js';

const bankRules = { ...CANON_RULES, bankMode: 'resources' as const };

describe('experimental river banks', () => {
  it('connects the south source lane through Babel and keeps the source on one region', () => {
    const state = setupGame(['a', 'b'], 'bank-test', bankRules);
    const distance = bankDistancesToBabel(state.board);
    expect(distance['0,3@0']).toBe(3);
    expect(bankStepOptions(state.board, { x: 0, y: 4, region: 0 })).toEqual([
      { x: 0, y: 3, region: 0 },
      { x: 0, y: 3, region: 1 },
    ]);
    expect(regionTransitions(state.board, { x: 0, y: 4, region: 0 })).toContainEqual({
      x: 0, y: 3, region: 0,
    });
    expect(dryRegions(state.board, { x: 0, y: 4 })).toEqual([{ x: 0, y: 4, region: 0 }]);
    expect(Math.max(...Object.values(babelRiverDistancesThroughBabel(state.board)))).toBe(4);
    expect(state.beacons).toEqual([{ x: 0, y: 4, region: 0 }]);
  });

  it('keeps a clean bank payout equal to the ordinary direct-neighbour payout', () => {
    const board: Board = {
      '3,3': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '3,2': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '3,4': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '4,3': { terrain: 'farmland', river: 'none', rotation: 0 },
      '2,3': { terrain: 'farmland', river: 'none', rotation: 0 },
    };
    const draw = { terrain: 'farmland' as const, river: 'straight' as const };
    const ordinary = basePayout(board, { x: 3, y: 3 }, draw);
    const banked = bankPlacementPayout(board, [], { x: 3, y: 3 }, draw);
    expect(banked).toEqual(ordinary);
  });

  it('suppresses a whole occupied bank feature but leaves the opposite bank clean', () => {
    const board: Board = {
      '3,3': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '3,2': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '3,4': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '4,3': { terrain: 'farmland', river: 'none', rotation: 0 },
      '2,3': { terrain: 'farmland', river: 'none', rotation: 0 },
      '1,3': { terrain: 'farmland', river: 'none', rotation: 0 },
    };
    const sameBank = [{ id: 'h0', kind: 'ophanim' as const, at: { x: 1, y: 3 }, region: 0, shieldUp: false }];
    const otherBank = [{ id: 'h1', kind: 'ophanim' as const, at: { x: 4, y: 3 }, region: 0, shieldUp: false }];
    const both = [...sameBank, ...otherBank];
    expect(bankPlacementPayout(board, sameBank, { x: 3, y: 3 }, { terrain: 'farmland', river: 'straight' })).toEqual({ resource: 'food', amount: 4 });
    expect(bankPlacementPayout(board, otherBank, { x: 3, y: 3 }, { terrain: 'farmland', river: 'straight' })).toEqual({ resource: 'food', amount: 4 });
    expect(bankPlacementPayout(board, both, { x: 3, y: 3 }, { terrain: 'farmland', river: 'straight' })).toBeNull();
  });

  it('deduplicates one foreign owner across both clean river banks', () => {
    const board: Board = {
      '3,3': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '3,2': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '3,4': { terrain: 'farmland', river: 'straight', rotation: 0 },
      '4,3': { terrain: 'farmland', river: 'none', rotation: 0 },
      '2,3': { terrain: 'farmland', river: 'none', rotation: 0 },
    };
    const trigger = resolveBankHarvest(board, {
      '2,3': { type: 'farmstead', owner: 'p1', region: 0 },
      '4,3': { type: 'farmstead', owner: 'p1', region: 0 },
    }, [], { x: 3, y: 3 }, { terrain: 'farmland', river: 'straight' }, 'p0');
    expect(trigger?.owners).toEqual(['p1']);
    expect(trigger?.placerBonus).toBe(1);
  });

  it('enumerates both physical banks for one harvester tile without allowing two buildings', () => {
    const board: Board = { '0,0': { terrain: 'farmland', river: 'straight', rotation: 0 } };
    const leader: LeaderState = {
      id: 'p0', name: 'A', resources: { food: 1, wood: 2, brick: 0, metal: 0 },
      prestige: 0, army: 1, schemeHand: [],
    };
    const sites = getLegalBuildSites(board, {}, leader, 'resources');
    expect(sites).toHaveLength(2);
    expect(sites.map((site) => site.region)).toEqual([0, 1]);
  });

  it('never doubles a clean tile collection across any river shape or rotation', () => {
    for (const shape of Object.keys(RIVER_SHAPE_EDGES) as Array<keyof typeof RIVER_SHAPE_EDGES>) {
      if (shape === 'none') continue;
      for (const rotation of [0, 1, 2, 3] as const) {
        const board: Board = { '5,5': { terrain: 'farmland', river: shape, rotation } };
        expect(bankPlacementPayout(board, [], { x: 5, y: 5 }, { terrain: 'farmland', river: shape })).toEqual({
          resource: 'food', amount: 1,
        });
      }
    }
  });

  it('treats a new river edge pointing into Babel as joined only in bank mode', () => {
    const draw = { terrain: 'farmland' as const, river: 'straight' as const };
    const at = { x: 0, y: 1 };
    expect(riverGainFor({}, at, draw, 0).joined).toBe(false);
    expect(riverGainFor({}, at, draw, 0, undefined, true).joined).toBe(true);
  });
});
