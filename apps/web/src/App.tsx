/**
 * Milestone 1 — spatial economy vertical slice.
 *
 * All legality and payout questions go to `game-core`; nothing here reimplements
 * a rule. The UI's only job is to render what the core says is possible and to
 * send back commands.
 */
import { useMemo, useState } from 'react';
import {
  applyMove,
  coordKey,
  currentPlayer,
  getLegalTilePlacements,
  previewPlacement,
  setupGame,
  type Command,
  type Coord,
  type GameState,
  type Rotation,
} from '@babel-game/game-core';
import { Board } from './Board.js';
import { LeaderPanel, LogPanel } from './Panels.js';
import { RESOURCE_LABEL, TERRAIN_LABEL, INK } from './theme.js';

/** Actions beyond Pass arrive in Milestone 2 and 3; shown so the gap is visible. */
const DEFERRED_ACTIONS = [
  ['Build', 'Milestone 2'],
  ['Babel', 'Milestone 2'],
  ['Attack', 'Milestone 3'],
  ['Muster', 'Milestone 3'],
  ['Scheme', 'Milestone 5'],
  ['Barter', 'Milestone 2'],
] as const;

const NAMES = ['Ada', 'Peter', 'Rook', 'Vex'];

export function App() {
  const [leaderCount, setLeaderCount] = useState(2);
  const [seed, setSeed] = useState('babel-1');
  const [state, setState] = useState<GameState>(() =>
    setupGame(NAMES.slice(0, 2), 'babel-1'),
  );
  const [selected, setSelected] = useState<Coord | null>(null);
  const [rotationIndex, setRotationIndex] = useState(0);

  const options = useMemo(
    () => (state.drawnTile ? getLegalTilePlacements(state.board, state.drawnTile) : []),
    [state.board, state.drawnTile],
  );

  const selectedOption = selected
    ? options.find((o) => coordKey(o.at) === coordKey(selected))
    : undefined;
  const rotation: Rotation =
    selectedOption?.rotations[rotationIndex % selectedOption.rotations.length] ?? 0;

  const preview =
    selectedOption && state.drawnTile
      ? previewPlacement(state, selectedOption.at, state.drawnTile, rotation)
      : null;

  const active = currentPlayer(state);
  const dispatch = (command: Command) => {
    setState(applyMove(state, command).state);
    setSelected(null);
    setRotationIndex(0);
  };

  const restart = (count: number, nextSeed: string) => {
    setLeaderCount(count);
    setSeed(nextSeed);
    setState(setupGame(NAMES.slice(0, count), nextSeed));
    setSelected(null);
    setRotationIndex(0);
  };

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        color: INK,
        padding: 16,
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline' }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-0.02em' }}>BABEL</h1>
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          Round {state.round} · Stage {state.stage} · hot-seat
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: 13 }}>
          <label>
            Leaders{' '}
            <select
              value={leaderCount}
              onChange={(e) => restart(Number(e.target.value), seed)}
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => restart(leaderCount, `babel-${Date.now()}`)}>
            New game
          </button>
        </div>
      </header>

      <div className="layout" style={{ marginTop: 16 }}>
        <section style={{ minWidth: 0 }}>
          <Board
            state={state}
            selected={selected}
            rotation={rotation}
            onSelect={(at) => {
              setSelected(at);
              setRotationIndex(0);
            }}
          />

          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: '1px solid #00000022',
              borderRadius: 10,
              background: '#fffdf8',
            }}
          >
            {state.turnStep === 'place' && state.drawnTile ? (
              <>
                <div style={{ fontSize: 14 }}>
                  <strong>{state.leaders[active]?.name}</strong> drew{' '}
                  <strong>{TERRAIN_LABEL[state.drawnTile.terrain]}</strong>
                  {state.drawnTile.river !== 'none' && ` with a ${state.drawnTile.river} river`}.{' '}
                  {selectedOption
                    ? 'Confirm or rotate.'
                    : `Choose one of ${options.length} legal squares.`}
                </div>

                {selectedOption && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginTop: 10,
                    }}
                  >
                    <span style={{ fontSize: 13 }}>
                      Projected payout:{' '}
                      <strong>
                        {preview
                          ? `${preview.amount} ${RESOURCE_LABEL[preview.resource]}`
                          : state.drawnTile.terrain === 'desert'
                            ? 'none (Desert)'
                            : 'none (feature occupied)'}
                      </strong>
                    </span>
                    {selectedOption.rotations.length > 1 && (
                      <button onClick={() => setRotationIndex((r) => r + 1)}>
                        Rotate ({rotationIndex % selectedOption.rotations.length + 1}/
                        {selectedOption.rotations.length})
                      </button>
                    )}
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'placeTile',
                          player: active,
                          at: selectedOption.at,
                          rotation,
                        })
                      }
                    >
                      Place here
                    </button>
                    <button onClick={() => setSelected(null)}>Cancel</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14 }}>
                  <strong>{state.leaders[active]?.name}</strong> takes one action:
                </span>
                <button
                  onClick={() =>
                    dispatch({ type: 'takeAction', player: active, action: 'pass' })
                  }
                >
                  Pass
                </button>
                {DEFERRED_ACTIONS.map(([label, milestone]) => (
                  <button key={label} disabled title={`Arrives in ${milestone}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          {state.order.map((id) => (
            <LeaderPanel key={id} leader={state.leaders[id]!} isActive={id === active} />
          ))}
          <LogPanel state={state} />
        </aside>
      </div>
    </main>
  );
}
