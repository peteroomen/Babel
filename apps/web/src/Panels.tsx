import { RESOURCE_TYPES } from '@babel-game/game-data';
import type { GameEvent, GameState, LeaderState } from '@babel-game/game-core';
import { RESOURCE_LABEL, TERRAIN_LABEL } from './theme.js';

const card: React.CSSProperties = {
  border: '1px solid #00000022',
  borderRadius: 10,
  padding: 12,
  background: '#fffdf8',
};

export function LeaderPanel({
  leader,
  isActive,
}: {
  leader: LeaderState;
  isActive: boolean;
}) {
  return (
    <div style={{ ...card, outline: isActive ? '2px solid #2b2622' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong>{leader.name}</strong>
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
        Prestige {leader.prestige} · Army {leader.army}{' '}
        {leader.army === 1 ? 'die' : 'dice'}
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
