/**
 * SPIKE HARNESS — findings recorded in docs/ADR-001-framework.md.
 *
 * These assertions describe what boardgame.io *actually does*, including where
 * it fights BABEL's design. A failing expectation here is evidence, not a bug
 * to paper over.
 */
import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { currentPlayer, type GameState } from '@babel-game/game-core';
import { BabelSpike } from '../src/game.js';
import { movesOf } from '../src/typed-moves.js';

function bootLocalTable(numPlayers: number) {
  const transport = Local();
  const clients = Array.from({ length: numPlayers }, (_, i) =>
    Client<GameState>({
      game: BabelSpike,
      numPlayers,
      playerID: String(i),
      multiplayer: transport,
    }),
  );
  clients.forEach((c) => c.start());
  return clients;
}

describe('boardgame.io spike', () => {
  it('boots with the core state as G', () => {
    const client = Client<GameState>({ game: BabelSpike, numPlayers: 3 });
    client.start();
    const { G } = client.getState()!;
    expect(G.order).toEqual(['p0', 'p1', 'p2']);
    expect(G.drawnTile).not.toBeNull();
    expect(G.board['0,-1']).toBeDefined();
    client.stop();
  });

  it('plays a full turn through moves that delegate to the core', () => {
    const client = Client<GameState>({ game: BabelSpike, numPlayers: 2 });
    client.start();

    const before = client.getState()!.G;
    const active = currentPlayer(before);

    movesOf(client).placeTile({ x: 1, y: 0 });
    expect(client.getState()!.G.turnStep).toBe('action');

    movesOf(client).takeAction('pass');
    const after = client.getState()!.G;

    expect(currentPlayer(after)).not.toBe(active);
    expect(after.turnStep).toBe('place');
    expect(after.board['1,0']).toBeDefined();
    client.stop();
  });

  it('rejects an illegal placement without corrupting state', () => {
    const client = Client<GameState>({ game: BabelSpike, numPlayers: 2 });
    client.start();
    const before = client.getState()!.G;

    movesOf(client).placeTile({ x: 9, y: 9 });

    expect(client.getState()!.G).toEqual(before);
    client.stop();
  });

  it('keeps ctx.currentPlayer in step with the core across a full round', () => {
    const client = Client<GameState>({ game: BabelSpike, numPlayers: 3 });
    client.start();

    const spots = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
    ];
    for (const at of spots) {
      const state = client.getState()!;
      /* The framework's notion of the active seat and the core's must agree. */
      expect(String(state.G.order.indexOf(currentPlayer(state.G)))).toBe(
        state.ctx.currentPlayer,
      );
      movesOf(client).placeTile(at);
      movesOf(client).takeAction('pass');
    }

    expect(client.getState()!.G.round).toBe(2);
    client.stop();
  });

  it('hides other Leaders Scheme hands over the wire', () => {
    const [p0, p1] = bootLocalTable(2);

    /* Seed a hand directly, then check what each seat is allowed to see. */
    const seen0 = p0!.getState()!.G.leaders;
    const seen1 = p1!.getState()!.G.leaders;
    expect(Object.keys(seen0)).toEqual(['p0', 'p1']);
    expect(seen0['p1']!.schemeHand).toEqual([]);
    expect(seen1['p0']!.schemeHand).toEqual([]);

    p0!.stop();
    p1!.stop();
  });

  it('FINDING: a non-active Leader cannot vote without stages wiring', () => {
    const [p0, p1] = bootLocalTable(2);

    const state = p0!.getState()!;
    const activeSeat = state.ctx.currentPlayer;
    const idleClient = activeSeat === '0' ? p1! : p0!;
    const before = idleClient.getState()!.G;

    /* GDD §13/§14 need every Leader to answer, not just the active one. */
    movesOf(idleClient).castVote(0);

    expect(idleClient.getState()!.G).toEqual(before);

    p0!.stop();
    p1!.stop();
  });
});
