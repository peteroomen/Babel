import {
  CANON_RULES,
  HOSTS,
  SCALING,
  type BeaconTier,
  type HostKind,
  type LeaderCount,
  type RuleSet,
  type Stage,
} from '@babel-game/game-data';
import { BABEL_COORD } from '../state/babel.js';
import { coordKey, neighbours, type Coord, type RegionCoord } from '../map/edges.js';
import { isBabel, tileAt, type Board } from '../map/placement.js';
import { distancesToBabel, isPassableAt } from './path.js';
import { bankDistancesToBabel, dryRegions, regionKey } from './banks.js';

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
export function getLegalBeaconSites(
  board: Board,
  beacons: readonly Coord[],
  impassable: readonly string[] = CANON_RULES.impassableTerrain,
  bankMode?: RuleSet['bankMode'],
): Coord[] {
  const distance = distancesToBabel(board, impassable);
  const bankDistance = bankMode ? bankDistancesToBabel(board) : null;
  const taken = new Set(beacons.map(coordKey));

  return Object.keys(board)
    .map((key): RegionCoord => {
      const [x, y] = key.split(',').map(Number) as [number, number];
      return { x, y };
    })
    .flatMap((at) => {
      if (taken.has(coordKey(at))) return [];
      if (!isFrontierTile(board, at)) return [];
      if (bankMode) {
        if (impassable.includes(board[coordKey(at)]!.terrain)) return [];
        return dryRegions(board, at).filter((region) => regionKey(region) in (bankDistance ?? {}));
      }
      /* Not a river or Lake tile, and reachable overland. */
      if (!isPassableAt(board, at, impassable)) return [];
      if (!(coordKey(at) in distance)) return [];
      return [at];
    })
    .sort((a, b) => `${coordKey(a)}@${a.region ?? 0}`.localeCompare(`${coordKey(b)}@${b.region ?? 0}`));
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
  rules: RuleSet = CANON_RULES,
): number {
  const row = SCALING[leaderCount as LeaderCount];
  if (round < row.firstBeaconRound) return 0;
  return (row.beaconsByStage[stage - 1] ?? 0) + rules.beaconBonus;
}

/**
 * The roll a die must beat. A Host kind may add to it, so an armoured or
 * airborne Host is harder to bring down than the Ophanim the table is used to.
 */
export const hostDefence = (
  leaderCount: number,
  stage: Stage,
  rules: RuleSet = CANON_RULES,
  kind?: HostKind,
): number =>
  (SCALING[leaderCount as LeaderCount].hostDefenceByStage[stage - 1] ?? 5) +
  (rules.hostDefenceBonus[stage - 1] ?? 0) +
  (kind ? HOSTS[kind].defence : 0);

/** Which gate a Beacon is, by the order it was sited. */
export const beaconTier = (
  index: number,
  rules: RuleSet = CANON_RULES,
): BeaconTier | null =>
  rules.beaconTiers ? (rules.beaconTiers[index % rules.beaconTiers.length] ?? null) : null;

/** Whether the Beacon at this index sends anything this round. */
export function beaconSpawnsThisRound(
  index: number,
  round: number,
  rules: RuleSet = CANON_RULES,
): boolean {
  const tier = beaconTier(index, rules);
  if (!tier) return true;
  return (round + tier.offset) % tier.everyNRounds === 0;
}

export { BABEL_COORD };
