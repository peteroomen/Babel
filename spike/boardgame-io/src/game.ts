/**
 * SPIKE — boardgame.io adapter over the framework-free core.
 *
 * The point of this file is to answer one question: can boardgame.io host
 * BABEL's turn flow, Heaven Phase, hidden Scheme hands and collective
 * decisions without the rules leaking into framework callbacks?
 *
 * Every move below delegates to `applyMove`. If a rule had to be reimplemented
 * here to satisfy the framework, that is a finding, not a fix.
 */
import type { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import {
  applyMove,
  currentPlayer,
  playerView,
  setupGame,
  type Coord,
  type Rotation,
  type GameState,
} from '@babel-game/game-core';

/** boardgame.io identifies players as '0', '1', ...; the core uses 'p0', 'p1'. */
const toCore = (playerID: string): string => `p${playerID}`;

export const BabelSpike: Game<GameState> = {
  name: 'babel-spike',

  setup: ({ ctx }) =>
    setupGame(
      Array.from({ length: ctx.numPlayers }, (_, i) => `Leader ${i + 1}`),
      'spike-seed',
    ),

  moves: {
    placeTile: ({ G, playerID }, at: Coord, rotation: Rotation) => {
      try {
        return applyMove(G, { type: 'placeTile', player: toCore(playerID), at, rotation })
          .state;
      } catch {
        return INVALID_MOVE;
      }
    },

    /* The round now ends with a Heaven Phase the table resolves explicitly. */
    resolveHeaven: ({ G, playerID }) => {
      try {
        return applyMove(G, { type: 'resolveHeaven', player: toCore(playerID) }).state;
      } catch {
        return INVALID_MOVE;
      }
    },

    pass: ({ G, playerID }) => {
      try {
        return applyMove(G, { type: 'pass', player: toCore(playerID) }).state;
      } catch {
        return INVALID_MOVE;
      }
    },

    castVote: ({ G, playerID }, option: number) => {
      try {
        return applyMove(G, { type: 'castVote', player: toCore(playerID), option }).state;
      } catch {
        return INVALID_MOVE;
      }
    },
  },

  /**
   * FINDING: boardgame.io insists on owning turn order via ctx.currentPlayer,
   * but the core already tracks whose turn it is (and must, since it is the
   * authority for legality). The two must be kept in lockstep by hand.
   */
  turn: {
    order: {
      first: ({ G }) => G.order.indexOf(currentPlayer(G)),
      next: ({ G }) => G.order.indexOf(currentPlayer(G)),
    },
    /* A turn ends when the core says the active player changed. */
    endIf: ({ G, ctx }) => G.order.indexOf(currentPlayer(G)) !== Number(ctx.currentPlayer),
  },

  /** GDD §18: a client must never receive another Leader's Scheme hand. */
  playerView: ({ G, playerID }) => (playerID ? playerView(G, toCore(playerID)) : G),

  endIf: ({ G }) => (G.winner ? { winner: G.winner } : undefined),
};
