import { HOSTS, type HostKind } from '@babel-game/game-data';
import { confusionIs } from '../cards/index.js';
import { isPassableAt } from './path.js';
import { coordKey, type Coord } from '../map/edges.js';
import { hasWallBetween, removeWallBetween, canonicalWall } from '../walls/index.js';
import { nextInt } from '../rng/index.js';
import { stepOptions } from './path.js';
import { BABEL_COORD } from '../state/babel.js';
import type { GameEvent, GameState, Host } from '../state/types.js';
import { beaconSpawnsThisRound, beaconTier, getLegalBeaconSites, requiredBeacons } from './beacons.js';
import { hostAtBabel, newHost, rollHostKind } from './hosts.js';

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

  /* 1. Movement, one point at a time so Walls can interrupt it. */
  const moved: Host[] = [];
  const arrivals: Host[] = [];
  let walls = [...state.walls];
  /* A Colossus pulls buildings down as it comes, so the standing set changes
     during movement rather than only at the end of the phase. */
  let standing = { ...state.buildings };

  /* GDD §19 March of Heaven: every Host already on the board gets +1 movement. */
  const marching = confusionIs(state, 'march-of-heaven') ? 1 : 0;

  for (const host of state.hosts) {
    let current = host;
    const preferred = [...(plan[host.id] ?? [])];

    /**
     * GDD §18 False Prophet: one Host is sent to any adjacent legal tile
     * instead of following the shortest route, and that ends its movement.
     */
    if (state.falseProphet?.hostId === host.id) {
      const to = state.falseProphet.to;
      if (isPassableAt(state.board, to, state.rules.impassableTerrain)) {
        events.push({
          type: 'hostMoved',
          id: host.id,
          from: current.at,
          to,
          hadChoice: true,
        });
        current = { ...current, at: to };
      }
      if (coordKey(current.at) === coordKey(BABEL_COORD)) arrivals.push(current);
      else moved.push(current);
      continue;
    }

    /* A Throne's map is not everyone else's: it flies, so the rivers that
       define the walking routes are simply not there for it. */
    const how = {
      impassable: state.rules.impassableTerrain,
      flies: HOSTS[host.kind].flies,
    };
    for (let point = 0; point < HOSTS[host.kind].movement + marching; point++) {
      const options = stepOptions(state.board, current.at, undefined, how);
      if (options.length === 0) break;

      /* Take the next square the players asked for, if it is a legal step. */
      const wanted = preferred.shift();
      const chosen =
        wanted && options.some((option) => coordKey(option) === coordKey(wanted))
          ? wanted
          : (() => {
              const [pick, next] = nextInt(rng, options.length);
              rng = next;
              return options[pick] as Coord;
            })();

      /**
       * GDD §17: a Host crossing a Wall destroys it, spends that movement, and
       * stays where it is. A Movement-1 Host therefore loses the whole phase at
       * a Wall; a Movement-2 Seraph breaks it and crosses with its second.
       */
      if (hasWallBetween(walls, current.at, chosen)) {
        events.push({
          type: 'wallBroken',
          hostId: host.id,
          edge: canonicalWall(current.at, chosen),
        });
        walls = removeWallBetween(walls, current.at, chosen);
        continue;
      }

      events.push({
        type: 'hostMoved',
        id: host.id,
        from: current.at,
        to: chosen,
        hadChoice: options.length > 1,
      });
      current = { ...current, at: chosen };

      /**
       * A Colossus goes after the economy rather than the Tower: it stops at
       * the first building it reaches and pulls it down. Ignoring one costs a
       * Leader something other than Babel, which is the point — every other
       * Host can be answered by racing it to the Foundation.
       */
      if (HOSTS[host.kind].razes) {
        const key = coordKey(current.at);
        const razed = standing[key];
        if (razed) {
          events.push({
            type: 'buildingRazed',
            hostId: host.id,
            at: current.at,
            owner: razed.owner,
            building: razed.type,
          });
          standing = Object.fromEntries(
            Object.entries(standing).filter(([at]) => at !== key),
          );
          break;
        }
      }

      /* Reaching Babel ends this Host's movement for the phase. */
      if (coordKey(current.at) === coordKey(BABEL_COORD)) break;
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
        walls,
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

  /**
   * 3. Beacons spawn. GDD §13.
   *
   * Under the tiered rules a Beacon's index — the order it was sited — decides
   * both what it sends and how often, so the first gate on the board keeps
   * sending what the table already knows how to fight while the later ones open
   * new problems on their own cadence. Otherwise every Beacon sends one Host
   * every round, as the GDD describes.
   */
  let hostSeq = state.hostSeq;
  const spawned: Host[] = [];
  const charge = [...state.beaconCharge];
  const income = state.rules.beaconIncome;

  state.beacons.forEach((beacon, index) => {
    const tier = beaconTier(index, state.rules);

    /* Pick what this gate sends before working out whether it can afford it. */
    let kind: HostKind;
    if (tier) {
      kind = tier.kind;
    } else {
      const [rolled, next] = rollHostKind(rng, state.stage);
      rng = next;
      kind = rolled;
    }

    if (income === null) {
      /* GDD §13 as written: one Host per Beacon per round, subject to the
         gate's own cadence where the rules give it one. */
      if (!beaconSpawnsThisRound(index, state.round, state.rules)) return;
    } else {
      /* Paced by threat points instead: the gate saves its income until it can
         afford what it sends, so an expensive kind is rare without needing a
         cadence, and one number thins the whole board. */
      charge[index] = (charge[index] ?? 0) + income;
      const price = HOSTS[kind].cost;
      if (charge[index]! < price) return;
      charge[index] = charge[index]! - price;
    }

    hostSeq += 1;
    const host = newHost(`h${hostSeq}`, kind, beacon);
    spawned.push(host);
    events.push({ type: 'hostSpawned', id: host.id, kind, at: beacon });
  });

  /**
   * Army upkeep, where the rules charge it.
   *
   * Muster is otherwise a one-off: an Army is bought once and never costs
   * anything again, which is a large part of why Food is the resource least
   * spent. Charged here, at the round boundary, a standing Army is a recurring
   * bill. A Leader who cannot pay keeps only the dice their Food covers — the
   * Army starves rather than going into debt.
   */
  let leaders = state.leaders;
  const upkeep = state.rules.armyUpkeepFood;
  if (upkeep > 0) {
    for (const id of state.order) {
      const leader = leaders[id];
      if (!leader || leader.army === 0) continue;
      const affordable = Math.min(leader.army, Math.floor(leader.resources.food / upkeep));
      const diceLost = leader.army - affordable;
      const food = affordable * upkeep;
      if (food === 0 && diceLost === 0) continue;
      events.push({ type: 'upkeepPaid', player: id, food, diceLost });
      leaders = {
        ...leaders,
        [id]: {
          ...leader,
          army: affordable,
          resources: { ...leader.resources, food: leader.resources.food - food },
        },
      };
    }
  }

  return {
    state: {
      ...state,
      rng,
      walls,
      hostSeq,
      leaders,
      beaconCharge: charge,
      buildings: standing,
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
    requiredBeacons(state.order.length, state.stage, state.round, state.rules) - state.beacons.length,
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

  const sites = getLegalBeaconSites(state.board, state.beacons, state.rules.impassableTerrain);
  if (sites.length === 0) {
    return {
      state: { ...state, pendingBeacon: null },
      events: [{ type: 'beaconDeferred', owed }],
    };
  }
  return { state: { ...state, pendingBeacon: { sites } }, events: [] };
}
