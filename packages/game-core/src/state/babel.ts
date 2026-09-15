import type { Coord } from '../map/edges.js';

/** GDD §5: Babel's Foundation sits at the centre of the world. */
export const BABEL_COORD: Coord = { x: 0, y: 0 };

/**
 * GDD §5: a fixed Farmland tile with a north-south river sits immediately
 * north of Babel and feeds it. North is -y.
 */
export const START_TILE_COORD: Coord = { x: 0, y: -1 };
