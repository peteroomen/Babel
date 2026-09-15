import type { ReactElement } from 'react';
import {
  BABEL_COORD,
  coordKey,
  getConnectedFeature,
  getLegalTilePlacements,
  riverEdgesOf,
  type Coord,
  type GameState,
  type Rotation,
  type TileDraw,
} from '@babel-game/game-core';
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
} from './theme.js';

const CELL = 64;

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

type Props = {
  state: GameState;
  selected: Coord | null;
  rotation: Rotation;
  onSelect: (at: Coord) => void;
  /** Squares offered while the Leader is choosing where to build. */
  buildSites?: readonly Coord[];
  onBuildSite?: ((at: Coord) => void) | undefined;
  /** Squares offered while the table is siting a Beacon. */
  beaconSites?: readonly Coord[];
  onBeaconSite?: ((at: Coord) => void) | undefined;
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

export function Board({
  state,
  selected,
  rotation,
  onSelect,
  buildSites = [],
  onBuildSite,
  beaconSites = [],
  onBeaconSite,
  onHost,
  selectedHosts = {},
}: Props) {
  const options = state.drawnTile
    ? getLegalTilePlacements(state.board, state.drawnTile)
    : [];

  /* GDD §10: a Host anywhere in a feature shuts the whole feature down, so the
     shading has to cover the feature rather than the single occupied tile. */
  const occupiedFeature = new Set(
    state.hosts.flatMap((host) => getConnectedFeature(state.board, host.at)),
  );
  const legalKeys = new Set(options.map((o) => coordKey(o.at)));

  const coords = [
    ...Object.keys(state.board).map((k) => {
      const [x, y] = k.split(',').map(Number) as [number, number];
      return { x, y };
    }),
    ...options.map((o) => o.at),
    BABEL_COORD,
  ];

  const xs = coords.map((c) => c.x);
  const ys = coords.map((c) => c.y);
  const minX = Math.min(...xs) - 1;
  const minY = Math.min(...ys) - 1;
  const width = (Math.max(...xs) + 2 - minX) * CELL;
  const height = (Math.max(...ys) + 2 - minY) * CELL;

  const px = (c: Coord) => ({ x: (c.x - minX) * CELL, y: (c.y - minY) * CELL });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', background: '#f3ece1', borderRadius: 10 }}
      role="img"
      aria-label="BABEL board"
    >
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
              x={CELL * 0.28}
              y={CELL * 0.28}
              width={CELL * 0.44}
              height={CELL * 0.44}
              rx={5}
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

      {/* Beacons: where Heaven descends */}
      {state.beacons.map((at) => {
        const { x, y } = px(at);
        return (
          <g key={`beacon-${coordKey(at)}`} transform={`translate(${x} ${y})`}>
            <circle cx={CELL / 2} cy={CELL / 2} r={CELL * 0.42} fill={BEACON_LIGHT} opacity={0.28} />
            <path
              d={`M ${CELL / 2 - 7} ${CELL - 8} L ${CELL / 2 - 3} 6 L ${CELL / 2 + 3} 6 L ${
                CELL / 2 + 7
              } ${CELL - 8} Z`}
              fill={BEACON_LIGHT}
              opacity={0.9}
            />
          </g>
        );
      })}

      {/* Heavenly Hosts */}
      {state.hosts.map((host, index) => {
        const { x, y } = px(host.at);
        /* Stacked Hosts fan out slightly so they stay countable. */
        const offset = index % 3 === 0 ? 0 : index % 3 === 1 ? -9 : 9;
        const chosen = selectedHosts[host.id] ?? 0;
        return (
          <g
            key={`host-${host.id}`}
            transform={`translate(${x + offset} ${y})`}
            onClick={() => onHost?.(host.id)}
            style={{ cursor: onHost ? 'pointer' : 'default' }}
          >
            {host.kind === 'seraph' ? (
              <>
                {host.shieldUp && (
                  <circle
                    cx={CELL / 2}
                    cy={CELL / 2}
                    r={CELL * 0.33}
                    fill="none"
                    stroke={HEAVEN_IVORY}
                    strokeWidth={3}
                    opacity={0.95}
                  />
                )}
                <ellipse
                  cx={CELL / 2}
                  cy={CELL / 2}
                  rx={CELL * 0.17}
                  ry={CELL * 0.26}
                  fill={SERAPH_CORE}
                  stroke={HEAVEN_GOLD}
                  strokeWidth={2}
                />
              </>
            ) : (
              <>
                <circle
                  cx={CELL / 2}
                  cy={CELL / 2}
                  r={CELL * 0.29}
                  fill="#00000055"
                />
                <circle
                  cx={CELL / 2}
                  cy={CELL / 2}
                  r={CELL * 0.26}
                  fill={HEAVEN_IVORY}
                  stroke={HEAVEN_GOLD}
                  strokeWidth={3}
                />
                <circle
                  cx={CELL / 2}
                  cy={CELL / 2}
                  r={CELL * 0.13}
                  fill="none"
                  stroke={HEAVEN_GOLD}
                  strokeWidth={2}
                />
              </>
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

      {/* Squares offered while siting a Beacon */}
      {beaconSites.map((at) => {
        const { x, y } = px(at);
        return (
          <g
            key={`bs-${coordKey(at)}`}
            transform={`translate(${x} ${y})`}
            onClick={() => onBeaconSite?.(at)}
            style={{ cursor: 'pointer' }}
          >
            <rect width={CELL} height={CELL} fill={BEACON_LIGHT} opacity={0.55} />
            <rect
              width={CELL}
              height={CELL}
              fill="none"
              stroke={INK}
              strokeWidth={5}
              opacity={0.55}
            />
            <rect
              width={CELL}
              height={CELL}
              fill="none"
              stroke={HEAVEN_GOLD}
              strokeWidth={3}
            />
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
