import { describe, expect, it } from 'vitest';
import { HOSTS } from '@babel-game/game-data';
import {
  applyMove,
  coordKey,
  currentPlayer,
  getLegalTilePlacements,
  newHost,
  setupGame,
  type GameEvent,
  type GameState,
} from '@babel-game/game-core';
import { NATURAL, STILL, advance, direct, heldFor, reelFrom, sceneOf } from '../src/index.js';

const SLOW = heldFor(200);

/** A game sitting on its opening draw, with one legal placement picked out. */
function opening(): { state: GameState; at: { x: number; y: number } } {
  const state = setupGame(['Ada', 'Peter'], 'stagecraft-1');
  const [option] = getLegalTilePlacements(state.board, state.drawnTile!, state.rules);
  return { state, at: option!.at };
}

describe('the director', () => {
  it('ends on the state the command actually produced', () => {
    const { state, at } = opening();
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: currentPlayer(state),
      at,
      rotation: 0,
    });

    const script = direct(state, events, after, SLOW);

    expect(script.degraded).toBe(false);
    expect(script.beats.at(-1)!.frame).toBe(after);
    expect(script.beats.at(-1)!.hold).toBe(0);
  });

  it('holds on the tile as it lands, with the tile already down', () => {
    const { state, at } = opening();
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: currentPlayer(state),
      at,
      rotation: 0,
    });

    const beat = direct(state, events, after, SLOW).beats.find(
      (b) => b.spot?.kind === 'tile',
    );

    expect(beat).toBeDefined();
    expect(beat!.hold).toBe(200);
    expect(beat!.frame.board[coordKey(at)]).toBeDefined();
    expect(beat!.spot!.cause.type).toBe('tilePlaced');
    expect(beat!.spot!.at).toEqual([at]);
  });

  it('shows nothing extra under a still tempo', () => {
    const { state, at } = opening();
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: currentPlayer(state),
      at,
      rotation: 0,
    });

    const script = direct(state, events, after, STILL);

    expect(script.degraded).toBe(false);
    expect(script.beats).toHaveLength(1);
    expect(script.beats[0]!.frame).toBe(after);
  });

  it('cuts to the end rather than show a world that never existed', () => {
    const { state, at } = opening();
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: currentPlayer(state),
      at,
      rotation: 0,
    });

    /* The events say a tile was placed; this `after` says it never was. */
    const script = direct(state, events, state, SLOW);

    expect(script.degraded).toBe(true);
    expect(script.drift).toMatch(/^tile /);
    expect(script.beats).toHaveLength(1);
    expect(script.beats[0]!.frame).toBe(state);
    expect(script.beats[0]!.hold).toBe(0);
  });
});

describe('the scene', () => {
  it('asks the dead Swarm what it leaves behind', () => {
    const at = { x: 3, y: 0 };
    const swarm = newHost('h9', 'swarm', at);
    const base = setupGame(['Ada', 'Peter'], 'stagecraft-2');
    const state: GameState = { ...base, hosts: [swarm] };

    const events: GameEvent[] = [
      { type: 'hostKilled', player: currentPlayer(state), id: 'h9', kind: 'swarm' },
      { type: 'hostSplit', from: 'h9', into: ['h10', 'h11', 'h12'], at },
    ];

    const reel = events.reduce(advance, reelFrom(state));

    /* Not three because the test says three: three because that is what the
       Swarm's own spec leaves behind. */
    expect(HOSTS.swarm.splitsInto).toEqual({ kind: 'ophanim', count: 3 });
    expect(reel.scene.hosts.map((h) => h.id)).toEqual(['h10', 'h11', 'h12']);
    expect(reel.scene.hosts.every((h) => h.kind === 'ophanim')).toBe(true);
    expect(reel.scene.hosts.every((h) => coordKey(h.at) === coordKey(at))).toBe(true);
  });

  it('leaves whose turn it is to the state, not to the frame', () => {
    const { state, at } = opening();
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: currentPlayer(state),
      at,
      rotation: 0,
    });

    const beat = direct(state, events, after, SLOW).beats[0]!;

    /* The board rolls back; the interface does not. A frame that lagged on
       phase or turn step would offer controls for a moment already gone. */
    expect(beat.frame.phase).toBe(after.phase);
    expect(beat.frame.turnStep).toBe(after.turnStep);
    expect(beat.frame.currentPlayerIndex).toBe(after.currentPlayerIndex);
    expect(sceneOf(beat.frame).board).not.toEqual(sceneOf(state).board);
  });
});

describe('the state that changes underneath you', () => {
  /* These move nothing on the board, which is exactly why they were missable:
     before Milestone 7 a whole round's rule change could arrive as one line in
     a panel that was hidden at anything under a desktop width. */
  it('stops on every announcement, long enough to read it', () => {
    const state = setupGame(['Ada', 'Peter'], 'stagecraft-3');
    const events: GameEvent[] = [
      { type: 'confusionRevealed', card: 'lost-ledgers' },
      { type: 'confusionCancelled', card: 'lost-ledgers', player: state.order[0]! },
      { type: 'stageEscalated', from: 1, to: 2 },
      { type: 'schemePlayed', player: state.order[0]!, scheme: 'frenzied-works' },
      { type: 'beaconPlaced', at: { x: 1, y: 0 }, total: 1 },
    ];

    /* Only the Beacon touches the board, so that is the only difference the
       world after is allowed to have — and the fold has to land on it. */
    const after: GameState = { ...state, beacons: [{ x: 1, y: 0 }] };
    const script = direct(state, events, after, NATURAL);

    expect(script.degraded).toBe(false);
    expect(script.beats.slice(0, -1).map((beat) => beat.spot!.kind)).toEqual([
      'confusion',
      'cancel',
      'stage',
      'scheme',
      'beacon',
    ]);
    for (const beat of script.beats.slice(0, -1)) {
      expect(beat.hold, `${beat.spot!.kind} is too quick to read`).toBeGreaterThanOrEqual(700);
    }
  });

  it('says nothing at all about the quiet events', () => {
    const state = setupGame(['Ada', 'Peter'], 'stagecraft-4');
    const events: GameEvent[] = [
      { type: 'roundStarted', round: 2 },
      { type: 'actionTaken', player: state.order[0]!, action: 'pass' },
      { type: 'turnEnded', player: state.order[0]! },
    ];

    expect(direct(state, events, state, NATURAL).beats).toHaveLength(1);
  });
});
