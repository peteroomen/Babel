import type { ReactElement } from 'react';
import {
  BABEL_COORD,
  coordKey,
  edgeRegions,
  getConnectedFeature,
  getLegalTilePlacements,
  hitsRemaining,
  riverEdgesOf,
  type Coord,
  type Edge,
  type GameState,
  type PlacedTile,
  type RegionCoord,
  type Rotation,
  type TileDraw,
} from '@babel-game/game-core';
import { HOSTS } from '@babel-game/game-data';
import { STAGE_LABEL, type HostKind } from '@babel-game/game-data';
import {
  BEACON_LIGHT,
  BUILDING_GLYPH,
  HEAVEN_GOLD,
  HEAVEN_IVORY,
  INK,
  LEADER_COLOUR,
  RIVER_STROKE,
  SERAPH_CORE,
  TERRAIN_FILL,
  TERRAIN_IMAGE,
  WALL_STROKE,
} from './theme.js';

const CELL = 64;

/**
 * How far the papyrus sheet reaches past the tiles, in squares.
 *
 * The sheet is a rectangle, not the union of the placed squares: a surveyor
 * draws on a sheet of a given size and fills it in, so the paper leads the map
 * rather than following its silhouette. One square of margin is also exactly
 * enough to carry every legal placement, which is always orthogonally adjacent
 * to a tile already down.
 */
const SHEET_PAD = 1;

/** Points for a regular polygon, so a ward ring is one path rather than six. */
function ringPoints(cx: number, cy: number, r: number, sides: number, turn = 0): string {
  return Array.from({ length: sides }, (_, i) => {
    const angle = turn + (i * 2 * Math.PI) / sides;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}

/** A Host glyph on its own, for a legend or a list. */
export function HostIcon({ kind, size = 34 }: { kind: HostKind; size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${CELL} ${CELL}`} aria-hidden="true">
      <HostGlyph kind={kind} shieldUp />
    </svg>
  );
}

/**
 * One Host, drawn so its kind is readable from across the table.
 *
 * Every Host is ivory and gold — that is the family, and it never changes.
 * The *kind* is carried by silhouette rather than colour, because a player
 * deciding which Host to shoot first is reading the board at a glance and from
 * an angle: a Colossus is simply larger, a Swarm is three bodies because
 * killing it leaves three behind, a Warded sits inside a closed ring because
 * Tower dice cannot reach through it, a Herald broadcasts a dashed halo
 * because its entire effect is on its neighbours. Shape alone should be enough
 * to tell you what the thing does.
 */
function HostGlyph({ kind, shieldUp }: { kind: HostKind; shieldUp: boolean }): ReactElement {
  const c = CELL / 2;
  const u = (n: number) => CELL * n;

  /* The shared body: a shadow so the piece lifts off the terrain, then the
     ivory face and its gold rim. Every kind below is a variation on this. */
  const body = (r: number, fill: string = HEAVEN_IVORY) => (
    <>
      <circle cx={c} cy={c} r={r + u(0.03)} fill="#00000055" />
      <circle cx={c} cy={c} r={r} fill={fill} stroke={HEAVEN_GOLD} strokeWidth={3} />
    </>
  );

  switch (kind) {
    /* GDD §14: the Shield is a ring that comes off on the first hit, so it has
       to be visible — it is the difference between one die and two. */
    case 'seraph':
      return (
        <>
          {shieldUp && (
            <circle
              cx={c}
              cy={c}
              r={u(0.33)}
              fill="none"
              stroke={HEAVEN_IVORY}
              strokeWidth={3}
              opacity={0.95}
            />
          )}
          <ellipse
            cx={c}
            cy={c}
            rx={u(0.17)}
            ry={u(0.26)}
            fill={SERAPH_CORE}
            stroke={HEAVEN_GOLD}
            strokeWidth={2}
          />
        </>
      );

    /* Armoured rather than fast: a plate across the face. */
    case 'zealot':
      return (
        <>
          {body(u(0.26))}
          <polygon points={ringPoints(c, c, u(0.19), 5, -Math.PI / 2)} fill={HEAVEN_GOLD} opacity={0.9} />
        </>
      );

    /* Wings, because rivers and Walls are simply not in its way. */
    case 'flier':
      return (
        <>
          <path
            d={`M ${c - u(0.04)} ${c - u(0.02)} Q ${c - u(0.36)} ${c - u(0.26)} ${c - u(0.3)} ${c + u(0.1)} Q ${c - u(0.18)} ${c - u(0.02)} ${c - u(0.04)} ${c + u(0.06)} Z`}
            fill={HEAVEN_IVORY}
            stroke={HEAVEN_GOLD}
            strokeWidth={2}
          />
          <path
            d={`M ${c + u(0.04)} ${c - u(0.02)} Q ${c + u(0.36)} ${c - u(0.26)} ${c + u(0.3)} ${c + u(0.1)} Q ${c + u(0.18)} ${c - u(0.02)} ${c + u(0.04)} ${c + u(0.06)} Z`}
            fill={HEAVEN_IVORY}
            stroke={HEAVEN_GOLD}
            strokeWidth={2}
          />
          {body(u(0.15), SERAPH_CORE)}
        </>
      );

    /* Fragile itself; the halo is the threat, so the halo is what you see. */
    case 'herald':
      return (
        <>
          <circle
            cx={c}
            cy={c}
            r={u(0.42)}
            fill="none"
            stroke={HEAVEN_GOLD}
            strokeWidth={2}
            strokeDasharray="4 4"
            opacity={0.85}
          />
          {body(u(0.2))}
          <path
            d={`M ${c - u(0.1)} ${c + u(0.08)} L ${c + u(0.12) } ${c - u(0.12)} L ${c + u(0.12)} ${c + u(0.08)} Z`}
            fill={HEAVEN_GOLD}
          />
        </>
      );

    /* Four hits and it eats buildings: the biggest thing on the board, with
       the cleft of the wall it just pulled down. */
    case 'colossus':
      return (
        <>
          {body(u(0.36), '#efdcb6')}
          <path
            d={`M ${c - u(0.04)} ${c - u(0.26)} L ${c + u(0.12)} ${c - u(0.05)} L ${c + u(0.01)} ${c - u(0.01)} L ${c + u(0.13)} ${c + u(0.26)} L ${c - u(0.14)} ${c + u(0.02)} L ${c - u(0.02)} ${c - u(0.02)} Z`}
            fill={HEAVEN_GOLD}
          />
        </>
      );

    /* Three bodies, because three is exactly what killing it leaves behind. */
    case 'swarm':
      return (
        <>
          <circle cx={c - u(0.14)} cy={c + u(0.1)} r={u(0.15)} fill="#00000044" />
          <circle cx={c + u(0.14)} cy={c + u(0.1)} r={u(0.15)} fill="#00000044" />
          <circle cx={c} cy={c - u(0.14)} r={u(0.15)} fill="#00000044" />
          <circle cx={c - u(0.14)} cy={c + u(0.08)} r={u(0.14)} fill={HEAVEN_IVORY} stroke={HEAVEN_GOLD} strokeWidth={2} />
          <circle cx={c + u(0.14)} cy={c + u(0.08)} r={u(0.14)} fill={HEAVEN_IVORY} stroke={HEAVEN_GOLD} strokeWidth={2} />
          <circle cx={c} cy={c - u(0.16)} r={u(0.14)} fill={HEAVEN_IVORY} stroke={HEAVEN_GOLD} strokeWidth={2} />
        </>
      );

    /* Sealed against Tower dice, so it is drawn sealed: a closed ward around
       the body that nothing reaches through. */
    case 'warded':
      return (
        <>
          <polygon
            points={ringPoints(c, c, u(0.38), 6, -Math.PI / 2)}
            fill="none"
            stroke={HEAVEN_GOLD}
            strokeWidth={3}
          />
          {body(u(0.22))}
          <polygon points={ringPoints(c, c, u(0.12), 6, -Math.PI / 2)} fill={HEAVEN_GOLD} opacity={0.8} />
        </>
      );

    /* The Ophanim wheel — the shape every other kind is read against. */
    default:
      return (
        <>
          {body(u(0.26))}
          <circle cx={c} cy={c} r={u(0.13)} fill="none" stroke={HEAVEN_GOLD} strokeWidth={2} />
        </>
      );
  }
}


/**
 * Turn the painted tile art by a quarter turn or three, chosen from the tile's
 * own coordinates.
 *
 * There are only six terrain images, so an unrotated board tiles visibly. This
 * is deterministic and purely cosmetic: river geometry keeps its own rotation
 * and the rules never see this value.
 */
function artTurn(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return (hash % 4) * 90;
}

/** A painted terrain square, with the flat colour beneath as a fallback. */
function TerrainTile({
  terrain,
  turn,
  opacity = 1,
}: {
  terrain: keyof typeof TERRAIN_IMAGE;
  turn: number;
  opacity?: number;
}) {
  return (
    <g opacity={opacity}>
      <rect width={CELL} height={CELL} fill={TERRAIN_FILL[terrain]} />
      <image
        href={TERRAIN_IMAGE[terrain]}
        width={CELL}
        height={CELL}
        preserveAspectRatio="xMidYMid slice"
        transform={`rotate(${turn} ${CELL / 2} ${CELL / 2})`}
      />
    </g>
  );
}

/**
 * A surveyor's compass rose, inked onto the desk beside the map.
 *
 * Purely decorative: north on the board is -y, which the rose agrees with, but
 * nothing in the rules reads it.
 */
function CompassRose({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  /* A four-pointed star, as one diamond; two of them at right angles make the
     cardinal points, a shorter pair at 45 degrees the ordinals. */
  const point = (len: number, wide: number) =>
    `M 0 ${-len} L ${wide} 0 L 0 ${len} L ${-wide} 0 Z`;

  return (
    <g transform={`translate(${cx} ${cy})`} aria-hidden>
      <g stroke={INK} fill="none" opacity={0.3}>
        <circle r={r} strokeWidth={1.1} />
        <circle r={r * 0.62} strokeWidth={0.7} />
      </g>
      <g opacity={0.3} fill={INK}>
        <path d={point(r * 0.66, r * 0.1)} transform="rotate(45)" />
        <path d={point(r * 0.66, r * 0.1)} transform="rotate(135)" />
      </g>
      <g opacity={0.45} fill={INK} stroke={INK} strokeWidth={0.6}>
        <path d={point(r * 0.94, r * 0.15)} />
        <path d={point(r * 0.94, r * 0.15)} transform="rotate(90)" />
      </g>
      <circle r={r * 0.09} fill={INK} opacity={0.55} />
      <text
        y={-r - 3.5}
        textAnchor="middle"
        fontSize={Math.max(9, r * 0.46)}
        fill={INK}
        opacity={0.55}
        style={{ fontFamily: 'var(--font-scrawl)' }}
      >
        N
      </text>
    </g>
  );
}

/** The map's title, lettered on a pasted tablet in the desk margin. */
function Cartouche({
  cx,
  cy,
  w,
  h,
  stage,
}: {
  cx: number;
  cy: number;
  w: number;
  h: number;
  stage: string;
}) {
  const hw = w / 2;
  const hh = h / 2;
  /* A flat hexagon: square in the middle, tapered to a point at each end. */
  const nose = Math.min(hh * 1.1, w * 0.12);
  const tablet = `M ${-hw} 0 L ${-hw + nose} ${-hh} L ${hw - nose} ${-hh} L ${hw} 0 L ${
    hw - nose
  } ${hh} L ${-hw + nose} ${hh} Z`;

  return (
    <g transform={`translate(${cx} ${cy})`} aria-hidden>
      <path d={tablet} fill="var(--papyrus-sheet)" opacity={0.55} filter="url(#deckle-fine)" />
      <path d={tablet} fill="none" stroke={INK} strokeWidth={1.2} opacity={0.42} />
      <path
        d={tablet}
        fill="none"
        stroke={INK}
        strokeWidth={0.6}
        opacity={0.3}
        transform="scale(0.93)"
      />
      <text
        y={-h * 0.04}
        textAnchor="middle"
        fontSize={h * 0.46}
        fill={INK}
        opacity={0.72}
        letterSpacing={h * 0.06}
        style={{ fontFamily: 'var(--font-scrawl)' }}
      >
        BABEL
      </text>
      <text
        y={h * 0.31}
        textAnchor="middle"
        fontSize={h * 0.2}
        fill={INK}
        opacity={0.5}
        style={{ fontFamily: 'var(--font-hand)' }}
      >
        {stage}
      </text>
    </g>
  );
}

type Props = {
  className?: string;
  state: GameState;
  selected: Coord | null;
  rotation: Rotation;
  onSelect: (at: Coord) => void;
  /** Squares offered while the Leader is choosing where to build. */
  buildSites?: readonly Coord[];
  onBuildSite?: ((at: Coord) => void) | undefined;
  /** Edges offered while the Leader is choosing where to build Walls. */
  wallEdges?: readonly { a: Coord; b: Coord }[];
  onWallEdge?: ((edge: { a: Coord; b: Coord }) => void) | undefined;
  chosenWalls?: readonly string[];
  /** Squares offered while the table is siting a Beacon. */
  beaconSites?: readonly RegionCoord[];
  onBeaconSite?: ((at: RegionCoord) => void) | undefined;
  /** Hosts singled out while assigning Attack hits. */
  onHost?: ((id: string) => void) | undefined;
  selectedHosts?: Readonly<Record<string, number>>;
};

/** Half-edge segments, drawn from the tile centre out to each river edge. */
function riverPath(river: TileDraw['river'], rotation: Rotation): ReactElement[] {
  const half = CELL / 2;
  const edges = riverEdgesOf(river, rotation);
  if (edges.length === 0) return [];
  /* A dot at the centre keeps bends and T-junctions visually continuous now
     that the segments use butt caps. */
  const junction = (
    <circle key="junction" cx={half} cy={half} r={4.5} fill={RIVER_STROKE} />
  );
  return [
    junction,
    ...edges.map((edge) => {
    const to = {
      n: { x: half, y: 0 },
      e: { x: CELL, y: half },
      s: { x: half, y: CELL },
      w: { x: 0, y: half },
    }[edge];
    /* Butt caps, so the stroke stops exactly at the tile edge. A round cap
       overhangs by half the stroke width and reads as a river leaking into a
       plain neighbour, which RD-001 does not allow. */
    return (
      <line
        key={edge}
        x1={half}
        y1={half}
        x2={to.x}
        y2={to.y}
        stroke={RIVER_STROKE}
        strokeWidth={9}
        strokeLinecap="butt"
      />
      );
    }),
  ];
}

/**
 * A bank's visual centre inside its tile. The core's `edgeRegions` already
 * accounts for shape and rotation; using it here keeps a straight, bend, or
 * tee's bank marker on the same side that Hosts actually walk. Region 0 on a
 * source or ordinary land tile is intentionally centred because there is no
 * second clickable bank to separate from it.
 */
export function bankAnchor(tile: PlacedTile | undefined, region: number | undefined): { x: number; y: number } {
  if (!tile || region === undefined || riverEdgesOf(tile.river, tile.rotation).length === 0) {
    return { x: CELL / 2, y: CELL / 2 };
  }

  const points: { x: number; y: number }[] = [];
  const half = CELL / 2;
  const outward: Record<Edge, { x: number; y: number }> = {
    n: { x: 0, y: -1 },
    e: { x: 1, y: 0 },
    s: { x: 0, y: 1 },
    w: { x: -1, y: 0 },
  };
  const left: Record<Edge, { x: number; y: number }> = {
    n: { x: -1, y: 0 },
    e: { x: 0, y: -1 },
    s: { x: 1, y: 0 },
    w: { x: 0, y: 1 },
  };

  for (const edge of riverEdgesOf(tile.river, tile.rotation)) {
    const sides = edgeRegions(tile.river, tile.rotation, edge);
    const side = sides.indexOf(region);
    /* A source has one dry region on both sides of its single river edge; it
       does not need a marker pushed toward the water. */
    if (side < 0 || sides[0] === sides[1]) continue;
    const normal = outward[edge];
    const tangent = left[edge];
    const sideSign = side === 0 ? 1 : -1;
    points.push({
      x: half + normal.x * CELL * 0.22 + tangent.x * CELL * 0.28 * sideSign,
      y: half + normal.y * CELL * 0.22 + tangent.y * CELL * 0.28 * sideSign,
    });
  }
  if (points.length === 0) return { x: half, y: half };
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

export function Board({
  className,
  state,
  selected,
  rotation,
  onSelect,
  buildSites = [],
  onBuildSite,
  wallEdges = [],
  onWallEdge,
  chosenWalls = [],
  beaconSites = [],
  onBeaconSite,
  onHost,
  selectedHosts = {},
}: Props) {
  const options = state.drawnTile
    ? getLegalTilePlacements(state.board, state.drawnTile, state.rules)
    : [];

  /* GDD §10: a Host anywhere in a feature shuts the whole feature down, so the
     shading has to cover the feature rather than the single occupied tile. */
  const occupiedFeature = new Set(
    state.hosts.flatMap((host) => getConnectedFeature(state.board, host.at)),
  );
  const legalKeys = new Set(options.map((o) => coordKey(o.at)));

  /* Stack only Hosts sharing the same physical bank. Hosts on opposite banks
     retain their distinct anchors instead of being fanned across each other. */
  const stackByRegion = new Map<string, number>();
  const stackOffsets = state.hosts.map((host) => {
    const key = `${coordKey(host.at)}@${host.region ?? 0}`;
    const index = stackByRegion.get(key) ?? 0;
    stackByRegion.set(key, index + 1);
    return index % 3 === 0 ? 0 : index % 3 === 1 ? -9 : 9;
  });

  /* The squares the map actually contains: everything placed, plus Babel. The
     sheet is sized from these alone, so it grows only when the world does. */
  const placed = Object.keys(state.board).map((k) => {
    const [x, y] = k.split(',').map(Number) as [number, number];
    return { x, y };
  });
  const mapped = [...placed, BABEL_COORD];

  const sheetMinX = Math.min(...mapped.map((c) => c.x)) - SHEET_PAD;
  const sheetMaxX = Math.max(...mapped.map((c) => c.x)) + SHEET_PAD;
  const sheetMinY = Math.min(...mapped.map((c) => c.y)) - SHEET_PAD;
  const sheetMaxY = Math.max(...mapped.map((c) => c.y)) + SHEET_PAD;
  const sheetCols = sheetMaxX - sheetMinX + 1;
  const sheetRows = sheetMaxY - sheetMinY + 1;

  /**
   * Desk around the sheet. One square minimum, so the torn edge and its shadow
   * have somewhere to fall and the compass and cartouche have room to sit.
   *
   * The floor keeps the frame stable: without it the opening position — two
   * squares — scales up to fill the whole panel, and every tile lurches smaller
   * as the map grows.
   */
  const MIN_SPAN = 8;
  const padX = Math.max(1, Math.ceil((MIN_SPAN - sheetCols) / 2));
  const padY = Math.max(1, Math.ceil((MIN_SPAN - sheetRows) / 2));

  const minX = sheetMinX - padX;
  const minY = sheetMinY - padY;
  const width = (sheetCols + padX * 2) * CELL;
  const height = (sheetRows + padY * 2) * CELL;

  const px = (c: Coord) => ({ x: (c.x - minX) * CELL, y: (c.y - minY) * CELL });

  const sheet = {
    x: (sheetMinX - minX) * CELL,
    y: (sheetMinY - minY) * CELL,
    width: sheetCols * CELL,
    height: sheetRows * CELL,
  };

  /**
   * The desk ornaments hang off the sheet rather than off the viewBox, so they
   * stay part of the composition however much desk there happens to be.
   *
   * Every offset below is under one square, and the margin is never narrower
   * than that, so neither ornament can stray outside the frame. They also clear
   * the sheet by more than the 11 units #deckle-map can displace its edge by.
   */
  /* The cartouche grows with the sheet, within limits: the whole board scales
     to fit its panel, so a fixed width would shrink away on a large map. Its
     height is then capped by the margin above the sheet, which is one square
     when the map is big, less the clearance the torn edge needs. */
  const CLEARANCE = CELL * 0.2;
  const cartoucheW = Math.min(CELL * 5.5, Math.max(CELL * 3.3, sheet.width * 0.42));
  const cartoucheH = Math.min(cartoucheW * 0.212, sheet.y - CLEARANCE - CELL * 0.08);
  const cartouche = {
    w: cartoucheW,
    h: cartoucheH,
    cy: sheet.y - CLEARANCE - cartoucheH / 2,
  };
  /* The rose sits diagonally off the sheet's bottom-right corner: far enough
     out to clear the tear, near enough in to stay inside the frame when the
     margin is down to its one-square minimum. */
  const compass = {
    cx: sheet.x + sheet.width + CELL * 0.5,
    cy: sheet.y + sheet.height + CELL * 0.5,
    r: CELL * 0.34,
  };

  /* Ruled squares: every cell of the sheet that has nothing on it yet. They
     are the surveyor's guide lines, so they should barely register. */
  const drawn = new Set(mapped.map(coordKey));
  const ruled: Coord[] = [];
  for (let y = sheetMinY; y <= sheetMaxY; y++) {
    for (let x = sheetMinX; x <= sheetMaxX; x++) {
      if (!drawn.has(coordKey({ x, y }))) ruled.push({ x, y });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      /* Fit the board inside whatever space the layout gives it: the page
         itself never scrolls. */
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label="BABEL board"
    >
      {/* Desk furniture, drawn first so the sheet always lies on top of it */}
      <CompassRose cx={compass.cx} cy={compass.cy} r={compass.r} />
      <Cartouche
        cx={sheet.x + sheet.width / 2}
        cy={cartouche.cy}
        w={cartouche.w}
        h={cartouche.h}
        stage={STAGE_LABEL[state.stage]}
      />

      {/* The papyrus the map is drawn on, torn at its edges */}
      <g filter="url(#deckle-map)">
        <rect
          x={sheet.x}
          y={sheet.y}
          width={sheet.width}
          height={sheet.height}
          fill="var(--papyrus-sheet)"
        />
      </g>
      {/* Fibre grain, clipped to the sheet so it never bleeds onto the desk */}
      <g clipPath="url(#sheet-clip)" opacity={0.5} filter="url(#fibre)">
        <rect width={width} height={height} />
      </g>
      <clipPath id="sheet-clip">
        <rect x={sheet.x} y={sheet.y} width={sheet.width} height={sheet.height} />
      </clipPath>

      {/* Ruled squares: where a tile could one day go */}
      <g fill="none" stroke={INK} strokeWidth={0.75} opacity={0.11}>
        {ruled.map((at) => {
          const { x, y } = px(at);
          return <rect key={`rule-${coordKey(at)}`} x={x} y={y} width={CELL} height={CELL} />;
        })}
      </g>

      {/* Placed terrain */}
      {Object.entries(state.board).map(([key, tile]) => {
        const [x, y] = key.split(',').map(Number) as [number, number];
        const { x: left, y: top } = px({ x, y });
        const occupied = occupiedFeature.has(key);
        return (
          <g key={key} transform={`translate(${left} ${top})`}>
            <TerrainTile terrain={tile.terrain} turn={artTurn(key)} />
            <rect width={CELL} height={CELL} fill="none" stroke="#00000022" />
            {riverPath(tile.river, tile.rotation)}
            {occupied && (
              <>
                <rect width={CELL} height={CELL} fill="#1b1630" opacity={0.55} />
                <rect
                  width={CELL}
                  height={CELL}
                  fill="none"
                  stroke={HEAVEN_GOLD}
                  strokeWidth={2}
                  opacity={0.5}
                />
              </>
            )}
          </g>
        );
      })}

      {/* Buildings sit on top of terrain, in their owner's colour */}
      {Object.entries(state.buildings).map(([key, building]) => {
        const [x, y] = key.split(',').map(Number) as [number, number];
        const { x: left, y: top } = px({ x, y });
        const seat = state.order.indexOf(building.owner);
        return (
          <g key={`b-${key}`} transform={`translate(${left} ${top})`}>
            <rect
              x={building.type === 'tower' ? CELL * 0.33 : CELL * 0.28}
              y={building.type === 'tower' ? CELL * 0.2 : CELL * 0.28}
              width={building.type === 'tower' ? CELL * 0.34 : CELL * 0.44}
              height={building.type === 'tower' ? CELL * 0.6 : CELL * 0.44}
              rx={building.type === 'tower' ? 3 : 5}
              fill={LEADER_COLOUR[seat % LEADER_COLOUR.length]}
              stroke="#fffdf8"
              strokeWidth={2}
            />
            <text
              x={CELL / 2}
              y={CELL / 2 + 5}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fill="#fffdf8"
              fontFamily="system-ui"
            >
              {BUILDING_GLYPH[building.type]}
            </text>
          </g>
        );
      })}

      {/* Squares offered while choosing where to build */}
      {buildSites.map((at) => {
        const { x, y } = px(at);
        return (
          <g
            key={`site-${coordKey(at)}`}
            transform={`translate(${x} ${y})`}
            onClick={() => onBuildSite?.(at)}
            style={{ cursor: 'pointer' }}
          >
            <rect width={CELL} height={CELL} fill="#fffdf8" opacity={0.45} />
            <rect
              width={CELL}
              height={CELL}
              fill="none"
              stroke={INK}
              strokeWidth={3}
              strokeDasharray="6 3"
            />
          </g>
        );
      })}

      {/* Walls sit on the edge between two tiles */}
      {[
        ...state.walls.map((w) => ({ wall: w, built: true })),
        ...wallEdges.map((w) => ({ wall: w, built: false })),
      ].map(({ wall, built }) => {
        const key = `${coordKey(wall.a)}|${coordKey(wall.b)}`;
        const from = px(wall.a);
        const to = px(wall.b);
        /* Midpoint of the shared edge, drawn perpendicular to the join. */
        const mx = (from.x + to.x) / 2 + CELL / 2;
        const my = (from.y + to.y) / 2 + CELL / 2;
        const vertical = wall.a.x !== wall.b.x;
        const long = CELL * 0.84;
        const chosen = chosenWalls.includes(key);
        if (!built && !onWallEdge) return null;

        const width = vertical ? 16 : long;
        const height = vertical ? long : 16;
        return (
          <g key={`wall-${key}-${built ? 'b' : 'o'}`}>
            <line
              x1={vertical ? mx : mx - long / 2}
              y1={vertical ? my - long / 2 : my}
              x2={vertical ? mx : mx + long / 2}
              y2={vertical ? my + long / 2 : my}
              stroke={built || chosen ? WALL_STROKE : '#00000038'}
              strokeWidth={built || chosen ? 7 : 5}
              strokeLinecap="round"
              strokeDasharray={built || chosen ? '9 3' : '3 4'}
              pointerEvents="none"
            />
            {/* A rectangle, not the line itself, so the tap target is real —
                a 5px stroke is far too small to hit on a phone. */}
            {!built && (
              <rect
                x={mx - width / 2}
                y={my - height / 2}
                width={width}
                height={height}
                fill="transparent"
                onClick={() => onWallEdge?.(wall)}
                style={{ cursor: 'pointer' }}
              />
            )}
          </g>
        );
      })}

      {/* Beacons: where Heaven descends */}
      {state.beacons.map((at) => {
        const { x, y } = px(at);
        const anchor = bankAnchor(state.board[coordKey(at)], at.region);
        return (
          <g key={`beacon-${coordKey(at)}@${at.region ?? 0}`} transform={`translate(${x} ${y})`}>
            <circle cx={anchor.x} cy={anchor.y} r={CELL * 0.25} fill={BEACON_LIGHT} opacity={0.28} />
            <path
              d={`M ${anchor.x - 7} ${anchor.y + 13} L ${anchor.x - 3} ${anchor.y - 13} L ${anchor.x + 3} ${anchor.y - 13} L ${anchor.x + 7} ${anchor.y + 13} Z`}
              fill={BEACON_LIGHT}
              opacity={0.9}
            />
            {at.region !== undefined && (
              <text x={anchor.x} y={anchor.y + 4} textAnchor="middle" fontSize={9} fontWeight={700} fill={INK}>
                {at.region + 1}
              </text>
            )}
          </g>
        );
      })}

      {/* Squares offered while siting a Beacon */}
      {beaconSites.map((at) => {
        const { x, y } = px(at);
        const anchor = bankAnchor(state.board[coordKey(at)], at.region);
        return (
          <g
            key={`bs-${coordKey(at)}@${at.region ?? 0}`}
            data-beacon-site=""
            data-beacon-region={at.region ?? 0}
            transform={`translate(${x} ${y})`}
            onClick={() => onBeaconSite?.(at)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={anchor.x} cy={anchor.y} r={CELL * 0.18} fill={BEACON_LIGHT} opacity={0.6} />
            <circle cx={anchor.x} cy={anchor.y} r={CELL * 0.18} fill="none" stroke={INK} strokeWidth={4} opacity={0.62} />
            <circle cx={anchor.x} cy={anchor.y} r={CELL * 0.14} fill="none" stroke={HEAVEN_GOLD} strokeWidth={3} />
            {at.region !== undefined && (
              <text x={anchor.x} y={anchor.y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={INK}>
                {at.region + 1}
              </text>
            )}
          </g>
        );
      })}

      {/* Babel at the centre */}
      {(() => {
        const { x, y } = px(BABEL_COORD);
        return (
          <g transform={`translate(${x} ${y})`}>
            <rect width={CELL} height={CELL} fill="#3a3330" stroke={INK} />
            <text
              x={CELL / 2}
              y={CELL / 2 - 2}
              textAnchor="middle"
              fontSize={12}
              fill="#f3ece1"
              fontFamily="system-ui"
            >
              BABEL
            </text>
            <text
              x={CELL / 2}
              y={CELL / 2 + 14}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill="#e3bc5f"
              fontFamily="system-ui"
            >
              {state.babel.stack.length}
            </text>
          </g>
        );
      })()}

      {/* Heavenly Hosts */}
      {state.hosts.map((host, index) => {
        const { x, y } = px(host.at);
        const anchor = bankAnchor(state.board[coordKey(host.at)], host.region);
        /* Stacked Hosts fan out slightly so they stay countable. */
        const offset = stackOffsets[index] ?? 0;
        const chosen = selectedHosts[host.id] ?? 0;
        return (
          <g
            key={`host-${host.id}`}
            data-host-kind={host.kind}
            data-host-region={host.region ?? 0}
            transform={`translate(${x + anchor.x - CELL / 2 + offset} ${y + anchor.y - CELL / 2})`}
            onClick={() => onHost?.(host.id)}
            style={{ cursor: onHost ? 'pointer' : 'default' }}
          >
            <HostGlyph kind={host.kind} shieldUp={host.shieldUp} />
            {HOSTS[host.kind].hits > 1 && (
              <text
                x={CELL - 7}
                y={CELL - 7}
                textAnchor="end"
                fontSize={10}
                fontWeight={700}
                fill="#a33"
                fontFamily="system-ui"
              >
                {hitsRemaining(host)}/{HOSTS[host.kind].hits}
              </text>
            )}
            {chosen > 0 && (
              <text
                x={CELL / 2}
                y={CELL / 2 + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill="#a33"
                fontFamily="system-ui"
              >
                {chosen}
              </text>
            )}
          </g>
        );
      })}

      {/* Legal placements for the drawn tile */}
      {options.map((option) => {
        const { x, y } = px(option.at);
        const isSelected = selected && coordKey(selected) === coordKey(option.at);
        return (
          <g
            key={coordKey(option.at)}
            transform={`translate(${x} ${y})`}
            onClick={() => onSelect(option.at)}
            style={{ cursor: 'pointer' }}
          >
            <rect
              width={CELL}
              height={CELL}
              fill={isSelected ? '#ffffffcc' : '#ffffff55'}
              stroke={isSelected ? INK : '#00000044'}
              strokeWidth={isSelected ? 3 : 1}
              strokeDasharray={isSelected ? undefined : '5 4'}
            />
            {isSelected && state.drawnTile && (
              <g opacity={0.9}>
                <TerrainTile
                  terrain={state.drawnTile.terrain}
                  turn={artTurn(coordKey(option.at))}
                />
                {riverPath(state.drawnTile.river, rotation)}
              </g>
            )}
          </g>
        );
      })}

      {legalKeys.size === 0 && state.drawnTile && (
        <text x={12} y={24} fontSize={14} fill="#a33">
          No legal placement for this tile.
        </text>
      )}
    </svg>
  );
}
