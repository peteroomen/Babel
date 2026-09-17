import { HOSTS } from '@babel-game/game-data';
import {
  coordKey,
  newHost,
  removeWallBetween,
  wallEdgeKey,
  type Building,
  type Coord,
  type GameEvent,
  type GameState,
  type Host,
  type PlacedTile,
  type PlayerId,
  type WallEdge,
} from '@babel-game/game-core';

/**
 * The part of the world that animates.
 *
 * Deliberately not the whole `GameState`. Whose turn it is, which phase we are
 * in, what the decks hold and what the action bar offers are *interface*, and
 * an interface that lags is an interface that lies — a player must never be
 * shown a control that belongs to a moment that has already passed. So a frame
 * takes all of that from the state the command actually produced, and rolls
 * back only the things that occupy space on the board.
 */
export type Scene = {
  readonly board: Readonly<Record<string, PlacedTile>>;
  readonly buildings: Readonly<Record<string, Building>>;
  readonly walls: readonly WallEdge[];
  readonly beacons: readonly Coord[];
  readonly hosts: readonly Host[];
  /** Babel's stack: who built each piece, oldest first. */
  readonly babel: readonly PlayerId[];
};

export const sceneOf = (state: GameState): Scene => ({
  board: state.board,
  buildings: state.buildings,
  walls: state.walls,
  beacons: state.beacons,
  hosts: state.hosts,
  babel: state.babel.stack,
});

/** Put a scene back into a state, so a frame is an ordinary `GameState`. */
export const frameOf = (base: GameState, scene: Scene): GameState => ({
  ...base,
  board: scene.board,
  buildings: scene.buildings,
  walls: scene.walls,
  beacons: scene.beacons,
  hosts: scene.hosts,
  babel: { stack: scene.babel },
});

/**
 * A scene plus what it needs to remember about the recent dead.
 *
 * A Swarm's `hostSplit` names the Hosts it leaves behind but not what kind
 * they are, because by then the core has already emitted `hostKilled` and the
 * parent is gone. Rather than hard-code the answer — which would be this layer
 * quietly deciding a rule — the reel keeps each killed Host until the command
 * finishes, and asks its spec what it leaves behind.
 */
export type Reel = {
  readonly scene: Scene;
  readonly buried: Readonly<Record<string, Host>>;
};

export const reelFrom = (state: GameState): Reel => ({
  scene: sceneOf(state),
  buried: {},
});

const withoutKey = <T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

const mapHost = (hosts: readonly Host[], id: string, change: (host: Host) => Host): Host[] =>
  hosts.map((host) => (host.id === id ? change(host) : host));

/**
 * Advance the reel by one event.
 *
 * The switch is exhaustive on purpose: adding an event to `game-core` should
 * fail this build rather than silently desynchronise the screen. Events that
 * move nothing on the board are listed explicitly for the same reason — a new
 * one has to be classified by a person, not defaulted through.
 */
export function advance(reel: Reel, event: GameEvent): Reel {
  const { scene } = reel;
  const same = (next: Scene): Reel => ({ scene: next, buried: reel.buried });

  switch (event.type) {
    case 'tilePlaced':
      return same({
        ...scene,
        board: {
          ...scene.board,
          [coordKey(event.at)]: {
            terrain: event.terrain,
            river: event.river,
            rotation: event.rotation,
          },
        },
      });

    case 'buildingConstructed':
      return same({
        ...scene,
        buildings: {
          ...scene.buildings,
          [coordKey(event.at)]: { type: event.building, owner: event.player },
        },
      });

    case 'buildingRazed':
      return same({
        ...scene,
        buildings: withoutKey(scene.buildings, coordKey(event.at)),
      });

    case 'wallsBuilt':
      return same({ ...scene, walls: [...scene.walls, ...event.edges] });

    case 'wallBroken':
      return same({
        ...scene,
        walls: removeWallBetween(scene.walls, event.edge.a, event.edge.b),
      });

    case 'beaconPlaced':
      return same({ ...scene, beacons: [...scene.beacons, event.at] });

    case 'hostSpawned':
      return same({
        ...scene,
        hosts: [...scene.hosts, newHost(event.id, event.kind, event.at)],
      });

    case 'hostMoved':
      return same({
        ...scene,
        hosts: mapHost(scene.hosts, event.id, (host) => ({ ...host, at: event.to })),
      });

    /* A hit that does not kill is a Shield coming off. Everything else the
       core resolves as a kill, so there is no damage to carry here. */
    case 'hostHit':
      return event.shieldBroken
        ? same({
            ...scene,
            hosts: mapHost(scene.hosts, event.id, (host) => ({ ...host, shieldUp: false })),
          })
        : reel;

    case 'hostKilled': {
      const dying = scene.hosts.find((host) => host.id === event.id);
      return {
        scene: { ...scene, hosts: scene.hosts.filter((host) => host.id !== event.id) },
        buried: dying ? { ...reel.buried, [event.id]: dying } : reel.buried,
      };
    }

    case 'hostSplit': {
      const parent = reel.buried[event.from];
      const spec = parent ? HOSTS[parent.kind].splitsInto : null;
      if (!spec) return reel;
      return same({
        ...scene,
        hosts: [...scene.hosts, ...event.into.map((id) => newHost(id, spec.kind, event.at))],
      });
    }

    case 'babelPieceBuilt':
      return same({ ...scene, babel: [...scene.babel, event.player] });

    /* GDD §2: Heaven takes the newest piece off the top of the stack, and the
       strike spends the Host that made it. */
    case 'babelPieceLost':
      return same({
        ...scene,
        babel: scene.babel.slice(0, -1),
        hosts: scene.hosts.filter((host) => host.id !== event.hostId),
      });

    /* Everything below happens to Leaders, decks, or the record — not to the
       board. Purses stay out of the scene until Milestone 7 slice E, because
       the core does not event what an action *costs*, only what it pays. */
    case 'roundStarted':
    case 'tileDrawn':
    case 'tileDiscarded':
    case 'resourcesGained':
    case 'payoutSuppressed':
    case 'actionTaken':
    case 'harvestTriggered':
    case 'resourcesSpoiled':
    case 'upkeepPaid':
    case 'stageEscalated':
    case 'bartered':
    case 'prestigeGained':
    case 'humanityWins':
    case 'turnEnded':
    case 'heavenPhase':
    case 'beaconDeferred':
    case 'foundationOccupied':
    case 'humanityLoses':
    case 'attackRolled':
    case 'mustered':
    case 'confusionRevealed':
    case 'confusionCancelled':
    case 'confusionAdded':
    case 'schemeBought':
    case 'schemePlayed':
    case 'schemeDeckEmpty':
    case 'reserveSwapped':
    case 'reserveRefreshed':
    case 'towerSupport':
    case 'voteOpened':
    case 'voteCast':
    case 'voteResolved':
      return reel;

    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

const tileKey = (tile: PlacedTile): string => `${tile.terrain}/${tile.river}/${tile.rotation}`;
const buildingKey = (building: Building): string => `${building.type}/${building.owner}`;
const hostKey = (host: Host): string => `${host.kind}@${coordKey(host.at)}/${host.shieldUp}`;

function recordDiff<T>(
  what: string,
  mine: Readonly<Record<string, T>>,
  theirs: Readonly<Record<string, T>>,
  show: (value: T) => string,
): string | null {
  const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
  for (const key of keys) {
    const a = mine[key];
    const b = theirs[key];
    if (a === undefined) return `${what} ${key}: missing, expected ${show(b as T)}`;
    if (b === undefined) return `${what} ${key}: ${show(a)}, expected nothing`;
    if (show(a) !== show(b)) return `${what} ${key}: ${show(a)}, expected ${show(b)}`;
  }
  return null;
}

/**
 * Why two scenes differ, in one line, or null when they agree.
 *
 * Hosts are compared by id rather than by position in the array: the Heaven
 * Phase rebuilds its list as survivors followed by new arrivals, so the order
 * legitimately differs from the order the events walked them in. Babel's stack
 * *is* ordered — it is a stack — so that one is compared as written.
 */
export function sceneDiff(mine: Scene, theirs: Scene): string | null {
  const byId = (hosts: readonly Host[]): Record<string, Host> =>
    Object.fromEntries(hosts.map((host) => [host.id, host]));

  return (
    recordDiff('tile', mine.board, theirs.board, tileKey) ??
    recordDiff('building', mine.buildings, theirs.buildings, buildingKey) ??
    recordDiff('host', byId(mine.hosts), byId(theirs.hosts), hostKey) ??
    (mine.walls.map(wallEdgeKey).sort().join(' ') !==
    theirs.walls.map(wallEdgeKey).sort().join(' ')
      ? `walls: ${mine.walls.length}, expected ${theirs.walls.length}`
      : null) ??
    (mine.beacons.map(coordKey).sort().join(' ') !==
    theirs.beacons.map(coordKey).sort().join(' ')
      ? `beacons: ${mine.beacons.length}, expected ${theirs.beacons.length}`
      : null) ??
    (mine.babel.join(' ') !== theirs.babel.join(' ')
      ? `Babel: ${mine.babel.length} pieces, expected ${theirs.babel.length}`
      : null)
  );
}
