import { describe, expect, it } from 'vitest';
import { RIVER_SHAPES, type RiverShape } from '@babel-game/game-data';
import { canBuildHarvester } from '../src/buildings/index.js';
import { getConnectedDryFeature, placementDryFeatureGroups } from '../src/features/banks.js';
import { resolveBankHarvest } from '../src/economy/harvest.js';
import { bankPlacementPayout, basePayout } from '../src/economy/payout.js';
import {
  EDGES,
  OPPOSITE,
  ROTATIONS,
  coordKey,
  riverEdgesOf,
  rotateEdge,
  type Edge,
  type Rotation,
} from '../src/map/edges.js';
import type { Board } from '../src/map/placement.js';
import type { Building, Host, LeaderState, PlacedTile, TileDraw } from '../src/state/types.js';

const farm = (river: RiverShape = 'none', rotation: Rotation = 0): PlacedTile => ({
  terrain: 'farmland',
  river,
  rotation,
});

const node = (x: number, y: number, region = 0) => ({ x, y, region });

const host = (id: string, x: number, y: number, region = 0): Host => ({
  id,
  kind: 'ophanim',
  at: { x, y },
  region,
  shieldUp: false,
});

const farmstead = (owner: string, region?: number): Building => ({
  type: 'farmstead',
  owner,
  ...(region === undefined ? {} : { region }),
});

const leader = (id: string): LeaderState => ({
  id,
  name: id,
  resources: { food: 20, wood: 20, brick: 20, metal: 20 },
  prestige: 0,
  army: 1,
  schemeHand: [],
});

const sourceRotationFor = (edge: Edge): Rotation =>
  ROTATIONS.find((rotation) => rotateEdge('n', rotation) === OPPOSITE[edge]) as Rotation;

describe('river bank resource collection', () => {
  it('matches canonical payout on an unoccupied legal board for every shape and rotation', () => {
    for (const river of RIVER_SHAPES) {
      for (const rotation of ROTATIONS) {
        const at = { x: 50, y: 50 };
        const board: Record<string, PlacedTile> = { [coordKey(at)]: farm(river, rotation) };
        for (const edge of EDGES) {
          const next = { x: at.x + (edge === 'e' ? 1 : edge === 'w' ? -1 : 0), y: at.y + (edge === 's' ? 1 : edge === 'n' ? -1 : 0) };
          const neighbourRiver = riverEdgesOf(river, rotation).includes(edge)
            ? 'source'
            : 'none';
          board[coordKey(next)] = farm(
            neighbourRiver,
            neighbourRiver === 'source' ? sourceRotationFor(edge) : 0,
          );
        }

        const draw: TileDraw = { terrain: 'farmland', river };
        const label = `${river} rotation ${rotation}`;
        expect(bankPlacementPayout(board, [], at, draw), label).toEqual(basePayout(board, at, draw));
        expect(bankPlacementPayout(board, [], at, draw), label).toEqual({ resource: 'food', amount: 5 });
      }
    }
  });

  it('connects a source to both banks of the matching river neighbour', () => {
    const source = { x: 60, y: 60 };
    const board: Board = {
      [coordKey(source)]: farm('source', 0),
      '60,59': farm('straight', 0),
    };
    const connected = getConnectedDryFeature(board, { ...source, region: 0 });
    expect(connected.map((at) => `${at.x},${at.y}@${at.region ?? 0}`).sort()).toEqual([
      '60,59@0',
      '60,59@1',
      '60,60@0',
    ]);
  });

  it('suppresses one occupied bank feature while the other bank pays all its neighbours', () => {
    const board: Board = {
      '70,70': farm('straight'),
      '70,69': farm('straight'),
      '70,71': farm('straight'),
      '69,70': farm(),
      '71,70': farm(),
      '68,70': farm(),
      '72,70': farm(),
    };
    const draw: TileDraw = { terrain: 'farmland', river: 'straight' };
    expect(bankPlacementPayout(board, [host('west', 68, 70)], { x: 70, y: 70 }, draw)).toEqual({
      resource: 'food',
      amount: 4,
    });
    expect(
      bankPlacementPayout(board, [host('west', 68, 70), host('east', 72, 70)], { x: 70, y: 70 }, draw),
    ).toBeNull();
  });

  it('lets a nonriver placement trigger only the harvester on its connected bank', () => {
    const at = { x: 103, y: 100 };
    const board: Board = {
      '103,100': farm(),
      '102,100': farm(),
      '104,100': farm('straight'),
      '105,100': farm(),
    };
    const trigger = resolveBankHarvest(
      board,
      {
        '102,100': farmstead('west'),
        /* This tile is on the opposite bank of the river at 104,100. */
        '105,100': farmstead('east'),
      },
      [],
      at,
      { terrain: 'farmland', river: 'none' },
      'placer',
    );
    expect(trigger).toEqual({ owners: ['west'], resource: 'food', amount: 3, placerBonus: 1 });
  });

  it('pays each foreign owner once across clean banks and omits an occupied-bank owner', () => {
    const at = { x: 110, y: 110 };
    const board: Board = {
      '110,110': farm('straight'),
      '110,109': farm('straight'),
      '110,111': farm('straight'),
      '109,110': farm(),
      '111,110': farm(),
      '108,110': farm(),
    };
    const draw: TileDraw = { terrain: 'farmland', river: 'straight' };
    const cleanBuildings: Record<string, Building> = {
      '109,110': farmstead('p1'),
      '111,110': farmstead('p1'),
      '110,109': farmstead('p2', 1),
    };
    expect(resolveBankHarvest(board, cleanBuildings, [], at, draw, 'placer')).toEqual({
      owners: ['p1', 'p2'],
      resource: 'food',
      amount: 5,
      placerBonus: 1,
    });

    const occupiedSideBuildings: Record<string, Building> = {
      '109,110': farmstead('occupied-side'),
      '111,110': farmstead('p2'),
      '110,109': farmstead('p2', 1),
    };
    expect(
      resolveBankHarvest(board, occupiedSideBuildings, [host('west', 108, 110)], at, draw, 'placer'),
    ).toEqual({ owners: ['p2'], resource: 'food', amount: 4, placerBonus: 1 });
  });

  it('reconnects banks through an external dry same-terrain loop and restores the full payout', () => {
    const at = { x: 120, y: 120 };
    const board: Board = {
      '120,120': farm('straight'),
      '120,119': farm('bend', 1),
      '120,121': farm('bend', 3),
      '119,120': farm(),
      '121,120': farm(),
      '119,119': farm(),
      '118,119': farm(),
      '118,120': farm(),
      '118,121': farm(),
      '118,122': farm(),
      '119,122': farm(),
      '120,122': farm(),
      '121,122': farm(),
      '121,121': farm(),
    };
    const groups = placementDryFeatureGroups(board, at);
    expect(groups).toHaveLength(1);
    const draw: TileDraw = { terrain: 'farmland', river: 'straight' };
    expect(bankPlacementPayout(board, [], at, draw)).toEqual(basePayout(board, at, draw));
    expect(bankPlacementPayout(board, [], at, draw)).toEqual({ resource: 'food', amount: 5 });
  });

  it('caps a harvester at one building per bank feature and one building per tile', () => {
    const board: Board = {
      '130,130': farm('straight'),
      '129,130': farm(),
      '128,130': farm(),
      '131,130': farm(),
      '132,130': farm(),
    };
    const p0 = leader('p0');
    expect(canBuildHarvester(board, {}, p0, { x: 130, y: 130 }, 'farmstead', 'resources', 0)).toBeNull();

    const westBuilding: Record<string, Building> = { '128,130': farmstead('p0') };
    expect(
      canBuildHarvester(board, westBuilding, p0, { x: 129, y: 130 }, 'farmstead', 'resources', 0),
    ).toBe('alreadyOwnsInFeature');
    expect(
      canBuildHarvester(board, westBuilding, p0, { x: 131, y: 130 }, 'farmstead', 'resources', 0),
    ).toBeNull();

    const centerBuilding: Record<string, Building> = { '130,130': farmstead('p0', 0) };
    expect(
      canBuildHarvester(board, centerBuilding, p0, { x: 130, y: 130 }, 'farmstead', 'resources', 1),
    ).toBe('tileOccupiedByBuilding');
  });
});
