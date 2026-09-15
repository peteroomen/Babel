import { coordKey, type Coord } from '../map/edges.js';
import { BABEL_COORD } from '../state/babel.js';
import type { GameEvent, GameState, Host } from '../state/types.js';
import { getLegalBeaconSites, requiredBeacons } from './beacons.js';
import { defaultRoute, hostAtBabel, isLegalRoute, newHost, rollHostKind } from './hosts.js';

export type HeavenPlan = Readonly<Record<string, readonly Coord[]>>;

/**
 * Resolve one Heaven Phase. GDD §13 fixes the order:
 *
 *   1. existing Hosts move;
 *   2. Hosts that reach Babel are resolved;
 *   3. every Beacon spawns one new Host.
 *
 * `plan` optionally overrides each Host's route where several equally short
 * routes exist (GDD §14). An override that is not a legal route is ignored in
 * favour of the deterministic default, so a malformed plan cannot corrupt the
 * phase.
 */
export function resolveHeavenPhase(
  state: GameState,
  plan: HeavenPlan = {},
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [{ type: 'heavenPhase', round: state.round }];
  let rng = state.rng;

  /* 1. Movement. */
  const moved: Host[] = [];
  const arrivals: Host[] = [];
  for (const host of state.hosts) {
    const fallback = defaultRoute(state.board, host, rng);
    rng = fallback.rng;

    const override = plan[host.id];
    const route =
      override && isLegalRoute(state.board, host, override) ? override : fallback.route;

    let current = host;
    for (const step of route) {
      events.push({
        type: 'hostMoved',
        id: host.id,
        from: current.at,
        to: step,
        hadChoice: fallback.hadChoice,
      });
      current = { ...current, at: step };
    }

    if (coordKey(current.at) === coordKey(BABEL_COORD)) arrivals.push(current);
    else moved.push(current);
  }

  /* 2. Hosts that reached Babel. GDD §2. */
  let stack = [...state.babel.stack];
  let occupier = hostAtBabel(state.hosts) ?? null;
  const survivors = [...moved];

  for (const host of arrivals) {
    /* A Host already occupying the Foundation simply stays put. */
    if (occupier && occupier.id === host.id) {
      survivors.push(host);
      continue;
    }

    if (stack.length > 0) {
      /* Remove the newest piece and the Host that struck it. */
      const builtBy = stack.pop() as string;
      events.push({ type: 'babelPieceLost', builtBy, remaining: stack.length });
      continue;
    }

    if (!occupier) {
      occupier = host;
      survivors.push(host);
      events.push({ type: 'foundationOccupied', hostId: host.id });
      continue;
    }

    /* GDD §2: a second Host at an already occupied Foundation loses the game. */
    events.push({ type: 'humanityLoses', reason: 'foundationBreached' });
    return {
      state: {
        ...state,
        rng,
        babel: { stack },
        hosts: [...survivors, host],
        phase: 'gameOver',
        winner: null,
        lossReason: 'foundationBreached',
        drawnTile: null,
      },
      events,
    };
  }

  /* 3. Every Beacon spawns one Host. GDD §13. */
  let hostSeq = state.hostSeq;
  const spawned: Host[] = [];
  for (const beacon of state.beacons) {
    const [kind, next] = rollHostKind(rng, state.stage);
    rng = next;
    hostSeq += 1;
    const host = newHost(`h${hostSeq}`, kind, beacon);
    spawned.push(host);
    events.push({ type: 'hostSpawned', id: host.id, kind, at: beacon });
  }

  return {
    state: {
      ...state,
      rng,
      hostSeq,
      babel: { stack },
      hosts: [...survivors, ...spawned],
    },
    events,
  };
}

/** Whether more Beacons are owed right now. GDD §4 and §13. */
export function beaconsOwed(state: GameState): number {
  return Math.max(
    0,
    requiredBeacons(state.order.length, state.stage, state.round) - state.beacons.length,
  );
}

/**
 * Open a Beacon-siting decision if one is owed and the map can take it.
 *
 * RD-009: GDD §13 requires a legal Beacon site to be a frontier land tile that
 * is not river or Lake and has a land route to Babel. Early on, or on a
 * waterlogged map, no such tile need exist, and canon does not say what
 * happens. The Beacon is deferred to the next opportunity rather than dropped:
 * Heaven arrives when the geography allows it, which also rewards players who
 * deliberately keep the frontier hostile.
 */
export function openBeaconDecision(state: GameState): {
  state: GameState;
  events: GameEvent[];
} {
  const owed = beaconsOwed(state);
  if (owed <= 0) return { state: { ...state, pendingBeacon: null }, events: [] };

  const sites = getLegalBeaconSites(state.board, state.beacons);
  if (sites.length === 0) {
    return {
      state: { ...state, pendingBeacon: null },
      events: [{ type: 'beaconDeferred', owed }],
    };
  }
  return { state: { ...state, pendingBeacon: { sites } }, events: [] };
}
