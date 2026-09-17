import {
  HOSTS,
  SERAPH_CHANCE_STAGE_III,
  type HostKind,
  type RuleSet,
  type Stage,
} from '@babel-game/game-data';
import { coordKey, type Coord } from '../map/edges.js';
import type { Board } from '../map/placement.js';
import { nextInt, type RngState } from '../rng/index.js';
import { BABEL_COORD } from '../state/babel.js';
import type { Host } from '../state/types.js';
import { distancesToBabel, stepOptions } from './path.js';
import { getConnectedFeature } from '../features/index.js';
import { hostDefence } from './beacons.js';

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

export function newHost(id: string, kind: HostKind, at: Coord): Host {
  return { id, kind, at, shieldUp: HOSTS[kind].shield };
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
): { route: Coord[]; rng: RngState; hadChoice: boolean } {
  const distance = distancesToBabel(board);
  const route: Coord[] = [];
  let at = host.at;
  let state = rng;
  let hadChoice = false;

  for (let step = 0; step < HOSTS[host.kind].movement; step++) {
    const options = stepOptions(board, at, distance);
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
export function isLegalRoute(board: Board, host: Host, route: readonly Coord[]): boolean {
  if (route.length > HOSTS[host.kind].movement) return false;
  const distance = distancesToBabel(board);
  let at = host.at;
  for (const [index, step] of route.entries()) {
    const options = stepOptions(board, at, distance);
    if (!options.some((option) => coordKey(option) === coordKey(step))) return false;
    at = step;
    /* Movement stops on reaching Babel, so nothing may follow it. */
    if (coordKey(at) === coordKey(BABEL_COORD) && index !== route.length - 1) return false;
  }
  return true;
}

/**
 * The Defence a particular Host has on the board right now.
 *
 * `hostDefence` knows about the player count, the Stage and the kind. It does
 * not know about the Herald, whose whole effect is to raise the Defence of
 * everything standing in a feature with it — and the aura never applies to the
 * Herald itself, or a pair of them would be unkillable.
 *
 * This lived inside the Attack command, which meant the screen could not say
 * what a Host was actually worth without working the rule out a second time.
 * Both read it here now, so what a player is shown and what the dice are
 * measured against cannot drift apart.
 */
export function defenceOf(
  state: {
    readonly board: Board;
    readonly hosts: readonly Host[];
    readonly order: readonly string[];
    readonly stage: Stage;
    readonly rules: RuleSet;
  },
  host: Host,
): number {
  const aura = state.hosts
    .filter((other) => other.id !== host.id && HOSTS[other.kind].aura > 0)
    .filter((other) => getConnectedFeature(state.board, other.at).includes(coordKey(host.at)))
    .reduce((sum, other) => sum + HOSTS[other.kind].aura, 0);

  return hostDefence(state.order.length, state.stage, state.rules, host.kind) + aura;
}
