import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import type { GameState } from '@babel-game/game-core';
import { BabelStagesSpike } from '../src/game-stages.js';
import { movesOf } from '../src/typed-moves.js';

describe('boardgame.io stages: collective decisions', () => {
  it('lets every Leader vote once setActivePlayers opens the stage', () => {
    const transport = Local();
    const clients = [0, 1].map((i) =>
      Client<GameState>({
        game: BabelStagesSpike,
        numPlayers: 2,
        playerID: String(i),
        multiplayer: transport,
      }),
    );
    clients.forEach((c) => c.start());
    const [p0, p1] = clients as [typeof clients[0], typeof clients[0]];

    const activeSeat = p0.getState()!.ctx.currentPlayer;
    const activeClient = activeSeat === '0' ? p0 : p1;
    movesOf(activeClient).openVote();

    /* Both seats are now active in the voting stage. */
    const ctx = p0.getState()!.ctx;
    expect(ctx.activePlayers).toEqual({ '0': 'voting', '1': 'voting' });

    movesOf(p0).castVote(0);
    expect(p0.getState()!.G.pendingVote!.votes).toEqual({ p0: 0 });

    movesOf(p1).castVote(1);

    /* Tie between two options, broken by the core's seeded coin flip. */
    const G = p0.getState()!.G;
    expect(G.pendingVote).toBeNull();
    const resolved = G.log.filter((e) => e.type === 'voteResolved');
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ byCoinFlip: true });

    clients.forEach((c) => c.stop());
  });
});
