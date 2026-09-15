/** SPIKE — minimal React bindings check: does boardgame.io/react bundle? */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Client } from 'boardgame.io/react';
import type { BoardProps } from 'boardgame.io/react';
import type { GameState } from '@babel-game/game-core';
import { currentPlayer } from '@babel-game/game-core';
import { BabelSpike } from './game.js';
import { movesOf } from './typed-moves.js';

function Board({ G, moves }: BoardProps<GameState>) {
  const m = movesOf({ moves });
  return (
    <div style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>BABEL — boardgame.io spike</h1>
      <p>
        Round {G.round}, Stage {G.stage} — {G.leaders[currentPlayer(G)]?.name} to{' '}
        {G.turnStep}
      </p>
      <p>Drawn tile: {G.drawnTile ?? '—'}</p>
      <button onClick={() => m.placeTile({ x: 1, y: 0 })}>Place at (1,0)</button>
      <button onClick={() => m.takeAction('pass')}>Pass</button>
      <ol>
        {G.log.slice(-10).map((e, i) => (
          <li key={i}>{e.type}</li>
        ))}
      </ol>
    </div>
  );
}

const BabelClient = Client({ game: BabelSpike, board: Board, numPlayers: 2 });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BabelClient />
  </StrictMode>,
);
