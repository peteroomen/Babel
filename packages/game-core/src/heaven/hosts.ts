import { HOSTS, SERAPH_CHANCE_STAGE_III, type HostKind } from '@babel-game/game-data';
import { coordKey, type Coord, type RegionCoord } from '../map/edges.js';
import type { BankMode } from '@babel-game/game-data';
import type { Board } from '../map/placement.js';
import { nextInt, type RngState } from '../rng/index.js';
import { BABEL_COORD } from '../state/babel.js';
import type { Host } from '../state/types.js';
import { distancesToBabel, ON_FOOT, stepOptions } from './path.js';
import { bankStepOptions, normalizeRegion } from './banks.js';

/** GDD §10: a Host anywhere in a feature shuts the whole feature down. */
export const occupiedKeys = (hosts: readonly Host[]): string[] =>
  hosts.map((host) => coordKey(host.at));

/** GDD §2: a Host standing on Babel itself is occupying the Foundation. */
export const isFoundationOccupied = (hosts: readonly Host[]): boolean =>
  hosts.some((host) => coordKey(host.at) === coordKey(BABEL_COORD));

export const hostAtBabel = (hosts: readonly Host[]): Host | undefined =>
  hosts.find((host) => coordKey(host.at) === coordKey(BABEL_COORD));

/**
 * Pick the kind of Host a Beacon spawns. GDD §14: roughly a quarter of Hosts
 * spawned at Stage III are Seraphs; before that every Host is an Ophanim.
 */
export function rollHostKind(rng: RngState, stage: number): [HostKind, RngState] {
  if (stage < 3) return ['ophanim', rng];
  const [roll, next] = nextInt(rng, 100);
  return [roll < SERAPH_CHANCE_STAGE_III * 100 ? 'seraph' : 'ophanim', next];
}

export function newHost(id: string, kind: HostKind, at: RegionCoord): Host {
  return { id, kind, at: { x: at.x, y: at.y }, ...(at.region === undefined ? {} : { region: at.region }), shieldUp: HOSTS[kind].shield, damage: 0 };
}

/**
 * The route each Host takes this Heaven Phase, as a list of squares to step
 * through.
 *
 * GDD §14 lets the players choose between equally short routes. This computes
 * a deterministic default from the seeded RNG so a phase always resolves, and
 * `stepOptions` exposes the alternatives so players can override it (RD-008).
 * A Host that reaches Babel stops there; the strike is resolved separately.
 */
export function defaultRoute(
  board: Board,
  host: Host,
  rng: RngState,
  bankMode?: BankMode,
): { route: RegionCoord[]; rng: RngState; hadChoice: boolean } {
  const how = { ...ON_FOOT, flies: HOSTS[host.kind].flies };
  const distance = distancesToBabel(board, how);
  const route: Coord[] = [];
  let at: RegionCoord = { ...host.at, ...(host.region === undefined ? {} : { region: host.region }) };
  let state = rng;
  let hadChoice = false;

  for (let step = 0; step < HOSTS[host.kind].movement; step++) {
    const options = bankMode && !HOSTS[host.kind].flies
      ? bankStepOptions(board, normalizeRegion(board, at))
      : stepOptions(board, at, distance, how);
    if (options.length === 0) break;
    if (options.length > 1) hadChoice = true;

    const [pick, next] = nextInt(state, options.length);
    state = next;
    at = options[pick] as Coord;
    route.push(at);

    /* Reaching Babel ends the Host's movement for the phase. */
    if (coordKey(at) === coordKey(BABEL_COORD)) break;
  }

  return { route, rng: state, hadChoice };
}

/** Whether a proposed override is a legal route for this Host. */
export function isLegalRoute(board: Board, host: Host, route: readonly RegionCoord[], bankMode?: BankMode): boolean {
  if (route.length > HOSTS[host.kind].movement) return false;
  const how = { ...ON_FOOT, flies: HOSTS[host.kind].flies };
  const distance = distancesToBabel(board, how);
  let at: RegionCoord = { ...host.at, ...(host.region === undefined ? {} : { region: host.region }) };
  for (const [index, step] of route.entries()) {
    const usesBanks = Boolean(bankMode && !HOSTS[host.kind].flies);
    const options = usesBanks
      ? bankStepOptions(board, normalizeRegion(board, at))
      : stepOptions(board, at, distance, how);
    if (!options.some((option) => coordKey(option) === coordKey(step) &&
      (!usesBanks || (step as RegionCoord).region !== undefined && (option as RegionCoord).region === (step as RegionCoord).region))) return false;
    at = step;
    /* Movement stops on reaching Babel, so nothing may follow it. */
    if (coordKey(at) === coordKey(BABEL_COORD) && index !== route.length - 1) return false;
  }
  return true;
}
