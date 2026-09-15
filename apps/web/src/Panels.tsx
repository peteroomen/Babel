import { RESOURCE_TYPES, STAGE_LABEL } from '@babel-game/game-data';
import {
  piecesPerStage,
  piecesToNextEscalation,
  totalPieces,
  type GameEvent,
  type GameState,
  type LeaderState,
} from '@babel-game/game-core';
import {
  BUILDING_LABEL,
  HOST_LABEL,
  LEADER_COLOUR,
  RESOURCE_LABEL,
  TERRAIN_LABEL,
} from './theme.js';

const card: React.CSSProperties = {
  border: '1px solid #00000022',
  borderRadius: 10,
  padding: 12,
  background: '#fffdf8',
};

export function LeaderPanel({
  leader,
  isActive,
  seat,
  buildings,
}: {
  leader: LeaderState;
  isActive: boolean;
  seat: number;
  buildings: number;
}) {
  return (
    <div style={{ ...card, outline: isActive ? '2px solid #2b2622' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 3,
              marginRight: 6,
              background: LEADER_COLOUR[seat % LEADER_COLOUR.length],
            }}
          />
          {leader.name}
        </strong>
        {isActive && <span style={{ fontSize: 12 }}>active</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
        {RESOURCE_TYPES.map((resource) => (
          <span
            key={resource}
            style={{
              border: '1px solid #00000033',
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 12,
              background: leader.resources[resource] > 0 ? '#fff' : '#0000000a',
            }}
          >
            {RESOURCE_LABEL[resource]} {leader.resources[resource]}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Prestige <strong>{leader.prestige}</strong> · Army {leader.army}{' '}
        {leader.army === 1 ? 'die' : 'dice'} · {buildings}{' '}
        {buildings === 1 ? 'building' : 'buildings'}
      </div>
    </div>
  );
}

/** Human-readable log. Every complex transition emits a structured event. */
function describe(event: GameEvent, state: GameState): string {
  const who = (id: string) => state.leaders[id]?.name ?? id;
  switch (event.type) {
    case 'roundStarted':
      return `— Round ${event.round} —`;
    case 'tileDrawn':
      return `${who(event.player)} drew ${TERRAIN_LABEL[event.terrain]}${
        event.river === 'none' ? '' : ` (${event.river} river)`
      }`;
    case 'tileDiscarded':
      return `${TERRAIN_LABEL[event.terrain]} (${event.river}) had nowhere legal to go — redrawn`;
    case 'tilePlaced':
      return `${who(event.player)} placed ${TERRAIN_LABEL[event.terrain]} at (${event.at.x}, ${event.at.y})`;
    case 'resourcesGained':
      return `${who(event.player)} gained ${event.amount} ${RESOURCE_LABEL[event.resource]}`;
    case 'payoutSuppressed':
      return `No payout — that feature is occupied`;
    case 'actionTaken':
      return `${who(event.player)} took action: ${event.action}`;
    case 'harvestTriggered':
      return `Shared industry: ${event.owners.map(who).join(' and ')} paid ${event.amount} ${
        RESOURCE_LABEL[event.resource]
      }; ${who(event.placer)} +${event.placerBonus}`;
    case 'buildingConstructed':
      return `${who(event.player)} built a ${BUILDING_LABEL[event.building]} at (${
        event.at.x
      }, ${event.at.y})`;
    case 'babelPieceBuilt':
      return `${who(event.player)} added Babel piece ${event.pieces}`;
    case 'stageEscalated':
      return `Heaven escalates permanently — Stage ${event.to}: ${STAGE_LABEL[event.to]}`;
    case 'bartered':
      return `${who(event.player)} bartered 3 cards for 1 ${RESOURCE_LABEL[event.gained]}`;
    case 'prestigeGained':
      return `${who(event.player)} +${event.amount} Prestige (${event.source})`;
    case 'beaconPlaced':
      return `A Beacon is planted at (${event.at.x}, ${event.at.y}) — ${event.total} in play`;
    case 'beaconDeferred':
      return `No legal Beacon site yet; ${event.owed} deferred`;
    case 'hostSpawned':
      return `${HOST_LABEL[event.kind]} descends at (${event.at.x}, ${event.at.y})`;
    case 'hostMoved':
      return `Host ${event.id} advances to (${event.to.x}, ${event.to.y})${
        event.hadChoice ? ' (route chosen)' : ''
      }`;
    case 'babelPieceLost':
      return `Heaven smashes Babel's newest piece — ${event.remaining} left`;
    case 'foundationOccupied':
      return `A Host stands on the bare Foundation. Babel cannot be built.`;
    case 'humanityLoses':
      return `The Foundation is breached a second time. Humanity falls.`;
    case 'attackRolled':
      return `${who(event.player)} rolls ${event.rolls.join(', ')} against Defence ${
        event.defence
      } — ${event.successes} hit${event.successes === 1 ? '' : 's'}`;
    case 'hostHit':
      return event.shieldBroken
        ? `${who(event.player)} shatters a Seraph's shield`
        : `${who(event.player)} hits Host ${event.id}`;
    case 'hostKilled':
      return `${who(event.player)} destroys Host ${event.id}`;
    case 'mustered':
      return `${who(event.player)} musters — Army now ${event.army}`;
    case 'wallsBuilt':
      return `${who(event.player)} throws up ${event.edges.length} Wall segment${
        event.edges.length === 1 ? '' : 's'
      }`;
    case 'wallBroken':
      return `A Wall is smashed down — the Host spent its movement on it`;
    case 'towerSupport':
      return event.hit
        ? `Tower at (${event.at.x}, ${event.at.y}) fires — ${event.roll} + 2 vs ${event.defence}, hit`
        : `Tower at (${event.at.x}, ${event.at.y}) fires — ${event.roll} + 2 vs ${event.defence}, misses`;
    case 'humanityWins':
      return `Babel is complete. Humanity survives. Top Prestige: ${event.topPrestige
        .map(who)
        .join(', ')}`;
    case 'turnEnded':
      return `${who(event.player)} ended their turn`;
    case 'heavenPhase':
      return `Heaven Phase (round ${event.round})`;
    case 'voteOpened':
      return `Vote opened: ${event.question}`;
    case 'voteCast':
      return `${who(event.player)} voted`;
    case 'voteResolved':
      return `Vote resolved: ${event.choice}${event.byCoinFlip ? ' (coin flip)' : ''}`;
  }
}

export function LogPanel({ state }: { state: GameState }) {
  const recent = [...state.log].slice(-40).reverse();
  return (
    <div style={{ ...card, maxHeight: 340, overflowY: 'auto' }}>
      <strong style={{ fontSize: 13 }}>Game log</strong>
      <ol style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', fontSize: 12 }}>
        {recent.map((event, i) => (
          <li
            key={recent.length - i}
            style={{
              padding: '3px 0',
              borderTop: i === 0 ? 'none' : '1px solid #00000010',
              fontWeight: event.type === 'roundStarted' ? 600 : 400,
            }}
          >
            {describe(event, state)}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** GDD §12: how close Babel is to its next permanent escalation. */
export function BabelPanel({ state }: { state: GameState }) {
  const leaders = state.order.length;
  const built = state.babel.stack.length;
  const total = totalPieces(leaders);
  const toNext = piecesToNextEscalation(state.babel, state.stage, leaders);

  return (
    <div style={card}>
      <strong style={{ fontSize: 13 }}>Babel</strong>
      <div style={{ fontSize: 12, marginTop: 6 }}>
        Stage {state.stage} — {STAGE_LABEL[state.stage]}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 3,
          flexWrap: 'wrap',
          margin: '8px 0',
        }}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            title={
              i < built ? `Built by ${state.leaders[state.babel.stack[i]!]?.name}` : 'Not built'
            }
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: i < built ? '#3a3330' : '#00000014',
              /* Mark where each Stage boundary falls. */
              outline:
                (i + 1) % piecesPerStage(leaders) === 0 ? '1px solid #b5452f' : 'none',
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        {built} / {total} pieces
        {toNext === null
          ? ' · final Stage'
          : toNext === 0
            ? ' · escalation imminent'
            : ` · ${toNext} to next escalation`}
      </div>
    </div>
  );
}
