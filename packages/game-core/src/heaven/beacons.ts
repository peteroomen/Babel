import { SCALING, type LeaderCount, type Stage } from '@babel-game/game-data';
import { BABEL_COORD } from '../state/babel.js';
import { coordKey, neighbours, type Coord } from '../map/edges.js';
import { isBabel, tileAt, type Board } from '../map/placement.js';
import { distancesToBabel, isPassableAt } from './path.js';

/**
 * A frontier tile: a placed land tile touching at least one unexplored square.
 *
 * GDD §13 requires a Beacon to sit on "an existing frontier land tile", which
 * is what pushes players to create distant sacrificial terrain and deliberate
 * invasion lanes rather than letting Heaven appear in the middle of the city.
 */
export function isFrontierTile(board: Board, at: Coord): boolean {
  if (!tileAt(board, at)) return false;
  return neighbours(at).some(
    (candidate) => !tileAt(board, candidate) && !isBabel(candidate),
  );
}

/**
 * Every square a Beacon may legally be placed on. GDD §13: an existing
 * frontier land tile, not river or Lake, with at least one legal land route to
 * Babel. A square already holding a Beacon is excluded.
 */
export function getLegalBeaconSites(board: Board, beacons: readonly Coord[]): Coord[] {
  const distance = distancesToBabel(board);
  const taken = new Set(beacons.map(coordKey));

  return Object.keys(board)
    .map((key) => {
      const [x, y] = key.split(',').map(Number) as [number, number];
      return { x, y };
    })
    .filter((at) => {
      if (taken.has(coordKey(at))) return false;
      /* Not a river or Lake tile, and reachable overland. */
      if (!isPassableAt(board, at)) return false;
      if (!(coordKey(at) in distance)) return false;
      return isFrontierTile(board, at);
    })
    .sort((a, b) => coordKey(a).localeCompare(coordKey(b)));
}

/**
 * How many Beacons should be in play. GDD §4 and §13: the count comes from the
 * player-count scaling table by Stage, but the first one only appears at the
 * end of a given round.
 */
export function requiredBeacons(
  leaderCount: number,
  stage: Stage,
  round: number,
): number {
  const row = SCALING[leaderCount as LeaderCount];
  if (round < row.firstBeaconRound) return 0;
  return row.beaconsByStage[stage - 1] ?? 0;
}

export const hostDefence = (leaderCount: number, stage: Stage): number =>
  SCALING[leaderCount as LeaderCount].hostDefenceByStage[stage - 1] ?? 5;

export { BABEL_COORD };
