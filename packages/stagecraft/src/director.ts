import { BABEL_COORD, type Coord, type GameEvent, type GameState } from '@babel-game/game-core';
import { STILL, type Beat, type Script, type Spotlight, type Tempo } from './beat.js';
import { advance, frameOf, reelFrom, sceneDiff, sceneOf, type Reel } from './scene.js';

/**
 * Which events are worth stopping on, and where to look when they happen.
 *
 * Read against the reel as it stood *before* the event, because half of these
 * are about something that is no longer there afterwards: a Host that has just
 * died is not on the board to be pointed at.
 */
function spotFor(event: GameEvent, before: Reel): Omit<Spotlight, 'cause'> | null {
  const here = (...at: readonly Coord[]) => at;
  const standing = (id: string): readonly Coord[] => {
    const host = before.scene.hosts.find((h) => h.id === id);
    return host ? [host.at] : [];
  };

  switch (event.type) {
    case 'tilePlaced':
      return { kind: 'tile', at: here(event.at), hostIds: [] };
    case 'buildingConstructed':
      return { kind: 'build', at: here(event.at), hostIds: [] };
    case 'wallsBuilt':
      return { kind: 'walls', at: event.edges.flatMap((edge) => [edge.a, edge.b]), hostIds: [] };
    case 'babelPieceBuilt':
      return { kind: 'babel', at: here(BABEL_COORD), hostIds: [] };
    case 'babelPieceLost':
      return { kind: 'babelLost', at: here(BABEL_COORD), hostIds: [event.hostId] };
    case 'buildingRazed':
      return { kind: 'razed', at: here(event.at), hostIds: [event.hostId] };
    case 'beaconPlaced':
      return { kind: 'beacon', at: here(event.at), hostIds: [] };
    case 'heavenPhase':
      return { kind: 'heaven', at: [], hostIds: [] };
    case 'hostSpawned':
      return { kind: 'spawn', at: here(event.at), hostIds: [event.id] };
    case 'hostMoved':
      return { kind: 'march', at: here(event.from, event.to), hostIds: [event.id] };
    case 'wallBroken':
      return {
        kind: 'wallBroken',
        at: here(event.edge.a, event.edge.b),
        hostIds: [event.hostId],
      };
    case 'attackRolled':
      return { kind: 'dice', at: [], hostIds: [] };
    case 'towerSupport':
      return {
        kind: 'tower',
        at: here(event.at),
        hostIds: event.targetId ? [event.targetId] : [],
      };
    /* A hit that leaves the Host standing is a Shield coming off; every other
       hit the core resolves as a kill, which gets its own beat. */
    case 'hostHit':
      return event.shieldBroken
        ? { kind: 'shield', at: standing(event.id), hostIds: [event.id] }
        : null;
    case 'hostKilled':
      return { kind: 'slain', at: standing(event.id), hostIds: [event.id] };
    case 'hostSplit':
      return { kind: 'split', at: here(event.at), hostIds: [...event.into] };
    case 'foundationOccupied':
      return { kind: 'foundation', at: here(BABEL_COORD), hostIds: [event.hostId] };
    case 'confusionRevealed':
      return { kind: 'confusion', at: [], hostIds: [] };
    case 'confusionCancelled':
      return { kind: 'cancel', at: [], hostIds: [] };
    case 'stageEscalated':
      return { kind: 'stage', at: [], hostIds: [] };
    case 'schemePlayed':
      return { kind: 'scheme', at: [], hostIds: [] };
    case 'humanityWins':
      return { kind: 'win', at: [], hostIds: [] };
    case 'humanityLoses':
      return { kind: 'loss', at: [], hostIds: [] };
    default:
      return null;
  }
}

/**
 * Turn one command's transition into something the screen can play.
 *
 * The contract, in full:
 *
 * - every beat's frame is a whole `GameState`, so the board renders a frame
 *   exactly where it used to render the live state;
 * - the last beat is always the real `after`, so the screen cannot come to
 *   rest anywhere but the truth;
 * - if folding the events does not reproduce `after`, the whole script
 *   collapses to a single cut. A wrong picture is worse than no picture, and
 *   `degraded` says so out loud for a test to catch.
 */
export function direct(
  before: GameState,
  events: readonly GameEvent[],
  after: GameState,
  tempo: Tempo = STILL,
): Script {
  const cut: Beat = { frame: after, spot: null, hold: 0, focus: [] };
  let reel = reelFrom(before);
  const beats: Beat[] = [];
  /* Carried forward, so a beat with nowhere of its own to point keeps the
     camera where the last one left it. */
  let focus: readonly Coord[] = [];

  for (const event of events) {
    const spot = spotFor(event, reel);
    reel = advance(reel, event);
    if (!spot) continue;
    const hold = tempo[spot.kind];
    if (hold <= 0) continue;
    if (spot.at.length > 0) focus = spot.at;
    beats.push({
      frame: frameOf(after, reel.scene),
      spot: { ...spot, cause: event },
      hold,
      focus,
    });
  }

  const drift = sceneDiff(reel.scene, sceneOf(after));
  if (drift !== null) return { beats: [cut], degraded: true, drift };

  return { beats: [...beats, cut], degraded: false, drift: null };
}
