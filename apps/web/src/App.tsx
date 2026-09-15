/**
 * Milestones 1-3 — spatial economy, industry, Babel, and Heaven.
 *
 * All legality questions go to `game-core`; nothing here reimplements a rule.
 * The UI renders what the core says is possible and sends back commands.
 */
import { useMemo, useState } from 'react';
import { RESOURCE_TYPES, STAGE_LABEL, type BuildingType, type ResourceType } from '@babel-game/game-data';
import {
  applyMove,
  coordKey,
  currentPlayer,
  getLegalActions,
  getLegalTilePlacements,
  hitsRemaining,
  previewPlacement,
  setupGame,
  type Command,
  type Coord,
  type GameState,
  type Rotation,
} from '@babel-game/game-core';
import { Board } from './Board.js';
import { BabelPanel, LeaderPanel, LogPanel } from './Panels.js';
import { BUILDING_LABEL, HOST_LABEL, RESOURCE_LABEL, TERRAIN_LABEL, INK } from './theme.js';

/** Actions that arrive in later milestones, shown so the gap stays visible. */
const DEFERRED_ACTIONS = [
  ['Walls', 'Milestone 4'],
  ['Scheme', 'Milestone 5'],
] as const;

const NAMES = ['Ada', 'Peter', 'Rook', 'Vex'];
type Mode = { kind: 'idle' } | { kind: 'build' } | { kind: 'barter' };

const panel: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  border: '1px solid #00000022',
  borderRadius: 10,
  background: '#fffdf8',
};

export function App() {
  const [leaderCount, setLeaderCount] = useState(2);
  const [seed, setSeed] = useState('babel-1');
  const [state, setState] = useState<GameState>(() => setupGame(NAMES.slice(0, 2), 'babel-1'));
  const [selected, setSelected] = useState<Coord | null>(null);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [spend, setSpend] = useState<ResourceType[]>([]);
  const [hits, setHits] = useState<Record<string, number>>({});

  const options = useMemo(
    () => (state.drawnTile ? getLegalTilePlacements(state.board, state.drawnTile) : []),
    [state.board, state.drawnTile],
  );
  const active = currentPlayer(state);
  const legal = useMemo(() => getLegalActions(state, active), [state, active]);

  const selectedOption = selected
    ? options.find((o) => coordKey(o.at) === coordKey(selected))
    : undefined;
  const rotation: Rotation =
    selectedOption?.rotations[rotationIndex % selectedOption.rotations.length] ?? 0;
  const preview =
    selectedOption && state.drawnTile
      ? previewPlacement(state, selectedOption.at, state.drawnTile, rotation)
      : null;

  const buildAction = legal.find((a) => a.type === 'buildHarvester');
  const babelAction = legal.find((a) => a.type === 'buildBabel');
  const attackAction = legal.find((a) => a.type === 'attack');
  const musterAction = legal.find((a) => a.type === 'muster');
  const canBarter = legal.some((a) => a.type === 'barter');

  const reset = () => {
    setSelected(null);
    setRotationIndex(0);
    setMode({ kind: 'idle' });
    setSpend([]);
    setHits({});
  };

  const dispatch = (command: Command) => {
    setState(applyMove(state, command).state);
    reset();
  };

  const restart = (count: number, nextSeed: string) => {
    setLeaderCount(count);
    setSeed(nextSeed);
    setState(setupGame(NAMES.slice(0, count), nextSeed));
    reset();
  };

  const leader = state.leaders[active];
  const buildingsOf = (id: string) =>
    Object.values(state.buildings).filter((b) => b.owner === id).length;

  const assigned = Object.values(hits).reduce((sum, n) => sum + n, 0);
  const successes = state.pendingAttack?.successes ?? 0;

  /** Click a Host while assigning: add a hit, wrapping back to zero when full. */
  const tapHost = (id: string) => {
    const host = state.hosts.find((h) => h.id === id);
    if (!host) return;
    setHits((current) => {
      const now = current[id] ?? 0;
      const max = Math.min(hitsRemaining(host), successes - assigned + now);
      const next = now >= max ? 0 : now + 1;
      return { ...current, [id]: next };
    });
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
          Round {state.round} · Stage {state.stage} · {state.hosts.length} Host
          {state.hosts.length === 1 ? '' : 's'} · hot-seat
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: 13 }}>
          <label>
            Leaders{' '}
            <select value={leaderCount} onChange={(e) => restart(Number(e.target.value), seed)}>
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => restart(leaderCount, `babel-${Date.now()}`)}>New game</button>
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
            buildSites={
              mode.kind === 'build' && buildAction ? buildAction.sites.map((s) => s.at) : []
            }
            onBuildSite={(at) => {
              const site = buildAction?.sites.find((s) => coordKey(s.at) === coordKey(at));
              if (site) {
                dispatch({
                  type: 'buildHarvester',
                  player: active,
                  at: site.at,
                  building: site.type as BuildingType,
                });
              }
            }}
            beaconSites={state.pendingBeacon?.sites ?? []}
            onBeaconSite={(at) => dispatch({ type: 'placeBeacon', player: active, at })}
            onHost={state.pendingAttack ? tapHost : undefined}
            selectedHosts={hits}
          />

          {state.phase === 'gameOver' ? (
            <div style={panel}>
              {state.lossReason ? (
                <>
                  <strong>Heaven breaches the Foundation. Humanity falls.</strong>
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    Babel stood at {state.babel.stack.length} pieces when the second Host
                    arrived. Nobody is remembered.
                  </div>
                </>
              ) : (
                <>
                  <strong>Babel is complete. Humanity survives.</strong>
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    {state.winner
                      ? `${state.leaders[state.winner]?.name} is remembered as its greatest hero.`
                      : 'Prestige is tied — nobody is remembered above the rest.'}
                  </div>
                </>
              )}
            </div>
          ) : state.pendingBeacon ? (
            <div style={panel}>
              <strong>Where does Heaven land?</strong>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                The table chooses together. {state.pendingBeacon.sites.length} legal frontier
                tiles are highlighted — a Beacon needs a land route to Babel, so rivers and
                Lakes are out. Every Beacon spawns one Host per Heaven Phase, for the rest of
                the game.
              </div>
            </div>
          ) : state.phase === 'heaven' ? (
            <div style={panel}>
              <strong>Heaven Phase — round {state.round}</strong>
              <div style={{ fontSize: 13, margin: '6px 0 10px' }}>
                {state.hosts.length === 0
                  ? 'Nothing stirs yet.'
                  : `${state.hosts.length} Host${
                      state.hosts.length === 1 ? '' : 's'
                    } advance along the shortest route to Babel, then every Beacon spawns another.`}
              </div>
              <button onClick={() => dispatch({ type: 'resolveHeaven', player: active })}>
                Resolve Heaven Phase
              </button>
            </div>
          ) : state.pendingAttack ? (
            <div style={panel}>
              <strong>
                {assigned} / {successes} hits assigned
              </strong>
              <div style={{ fontSize: 13, margin: '6px 0 10px' }}>
                Rolled {state.pendingAttack.rolls.join(', ')} against Defence{' '}
                {state.pendingAttack.defence}. Click a Host to put a hit on it; a Seraph needs
                two, the first breaking its shield.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {state.hosts.map((host) => (
                  <button key={host.id} onClick={() => tapHost(host.id)}>
                    {HOST_LABEL[host.kind]} ({host.at.x}, {host.at.y}){' '}
                    {host.kind === 'seraph' && host.shieldUp ? '🛡' : ''} — {hits[host.id] ?? 0}
                  </button>
                ))}
              </div>
              <button
                style={{ marginTop: 10 }}
                onClick={() =>
                  dispatch({ type: 'assignHits', player: active, assignments: hits })
                }
              >
                Confirm hits
              </button>
            </div>
          ) : state.turnStep === 'place' && state.drawnTile ? (
            <div style={panel}>
              <div style={{ fontSize: 14 }}>
                <strong>{leader?.name}</strong> drew{' '}
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
                      Rotate ({(rotationIndex % selectedOption.rotations.length) + 1}/
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
            </div>
          ) : (
            <div style={panel}>
              <div style={{ fontSize: 14, marginBottom: 10 }}>
                <strong>{leader?.name}</strong> takes exactly one action.
              </div>

              {mode.kind === 'idle' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    disabled={!buildAction}
                    title={buildAction ? 'Choose a site on the board' : 'No legal building site'}
                    onClick={() => setMode({ kind: 'build' })}
                  >
                    Build
                  </button>
                  <button
                    disabled={!babelAction}
                    title={
                      babelAction
                        ? `Costs ${Object.entries(babelAction.cost)
                            .map(([r, n]) => `${n} ${RESOURCE_LABEL[r as ResourceType]}`)
                            .join(' + ')}`
                        : 'Cannot afford a piece, or the Foundation is occupied'
                    }
                    onClick={() => dispatch({ type: 'buildBabel', player: active })}
                  >
                    Babel
                  </button>
                  <button
                    disabled={!attackAction}
                    title={
                      attackAction
                        ? `Roll ${attackAction.dice} dice against Defence ${attackAction.defence}`
                        : 'No Hosts on the board'
                    }
                    onClick={() => dispatch({ type: 'attack', player: active })}
                  >
                    Attack
                  </button>
                  <button
                    disabled={!musterAction}
                    title={
                      musterAction
                        ? `1 Food + 1 Metal for a ${musterAction.army}th die`
                        : 'Cannot afford, or already at 5 dice'
                    }
                    onClick={() => dispatch({ type: 'muster', player: active })}
                  >
                    Muster
                  </button>
                  <button
                    disabled={!canBarter}
                    title={canBarter ? 'Discard 3 cards for 1' : 'Need 3 resource cards'}
                    onClick={() => setMode({ kind: 'barter' })}
                  >
                    Barter
                  </button>
                  <button onClick={() => dispatch({ type: 'pass', player: active })}>Pass</button>
                  {DEFERRED_ACTIONS.map(([label, milestone]) => (
                    <button key={label} disabled title={`Arrives in ${milestone}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {mode.kind === 'build' && buildAction && (
                <div style={{ fontSize: 13 }}>
                  Choose one of {buildAction.sites.length} highlighted sites.{' '}
                  {[...new Set(buildAction.sites.map((s) => s.type))]
                    .map((t) => BUILDING_LABEL[t as BuildingType])
                    .join(', ')}
                  . <button onClick={() => setMode({ kind: 'idle' })}>Cancel</button>
                </div>
              )}

              {mode.kind === 'barter' && leader && (
                <div style={{ fontSize: 13 }}>
                  <div>Discard any 3 cards ({spend.length}/3 chosen):</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                    {RESOURCE_TYPES.map((resource) => {
                      const held =
                        leader.resources[resource] - spend.filter((s) => s === resource).length;
                      return (
                        <button
                          key={resource}
                          disabled={held <= 0 || spend.length >= 3}
                          onClick={() => setSpend((s) => [...s, resource])}
                        >
                          {RESOURCE_LABEL[resource]} ({held})
                        </button>
                      );
                    })}
                  </div>
                  {spend.length === 3 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span>Gain:</span>
                      {RESOURCE_TYPES.map((resource) => (
                        <button
                          key={resource}
                          onClick={() =>
                            dispatch({ type: 'barter', player: active, spend, gain: resource })
                          }
                        >
                          {RESOURCE_LABEL[resource]}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => reset()} style={{ marginTop: 8 }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <aside style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <BabelPanel state={state} />
          {state.order.map((id, seat) => (
            <LeaderPanel
              key={id}
              leader={state.leaders[id]!}
              isActive={id === active}
              seat={seat}
              buildings={buildingsOf(id)}
            />
          ))}
          <LogPanel state={state} />
        </aside>
      </div>
    </main>
  );
}
