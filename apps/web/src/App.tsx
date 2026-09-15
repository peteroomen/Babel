/**
 * Milestone 0 shell: hot-seat driven straight off `game-core`, with no
 * orchestration framework in the path. The real board arrives in Milestone 1;
 * this exists to prove the core can drive a UI on its own, as the comparison
 * point for the boardgame.io spike.
 */
import { useState } from 'react';
import {
  applyMove,
  currentPlayer,
  isLegalPlacement,
  setupGame,
  type Command,
  type GameState,
} from '@babel-game/game-core';

const CANDIDATES = [
  { x: 0, y: -2 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
];

export function App() {
  const [state, setState] = useState<GameState>(() =>
    setupGame(['Ada', 'Peter'], 'milestone-0'),
  );

  const dispatch = (command: Command) => {
    try {
      setState(applyMove(state, command).state);
    } catch (error) {
      console.warn('rejected by game-core:', (error as Error).message);
    }
  };

  const active = currentPlayer(state);
  const leader = state.leaders[active];
  const legal = CANDIDATES.filter((c) => isLegalPlacement(state, c));

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 720 }}>
      <h1>BABEL</h1>
      <p>
        Round {state.round} · Stage {state.stage} · <strong>{leader?.name}</strong> to{' '}
        {state.turnStep}
      </p>
      <p>
        Drawn tile: <strong>{state.drawnTile ?? '—'}</strong>
      </p>

      {state.turnStep === 'place' ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {legal.map((at) => (
            <button
              key={`${at.x},${at.y}`}
              onClick={() => dispatch({ type: 'placeTile', player: active, at })}
            >
              Place at ({at.x}, {at.y})
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => dispatch({ type: 'takeAction', player: active, action: 'pass' })}
        >
          Pass
        </button>
      )}

      <h2>Log</h2>
      <ol>
        {state.log.slice(-12).map((event, i) => (
          <li key={i}>
            <code>{event.type}</code>
          </li>
        ))}
      </ol>
    </main>
  );
}
