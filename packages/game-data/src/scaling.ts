/**
 * Player-count scaling. GDD §4. Solo controls two Leaders and uses the
 * 2-Leader row.
 */
export type LeaderCount = 2 | 3 | 4;

export type ScalingRow = {
  /** Babel pieces required per Stage. */
  piecesPerStage: number;
  /** Cumulative Beacons in play once each Stage begins. */
  beaconsByStage: readonly [number, number, number];
  /** Round at whose end the first Beacon is placed. */
  firstBeaconRound: number;
  /** Host Defence target by Stage, tested as d6 + 2 >= defence. */
  hostDefenceByStage: readonly [number, number, number];
};

export const SCALING: Record<LeaderCount, ScalingRow> = {
  2: {
    piecesPerStage: 3,
    beaconsByStage: [1, 1, 2],
    firstBeaconRound: 3,
    hostDefenceByStage: [4, 5, 6],
  },
  3: {
    piecesPerStage: 5,
    beaconsByStage: [1, 2, 3],
    firstBeaconRound: 2,
    hostDefenceByStage: [5, 6, 7],
  },
  4: {
    piecesPerStage: 6,
    beaconsByStage: [1, 3, 4],
    firstBeaconRound: 2,
    hostDefenceByStage: [5, 6, 7],
  },
};
