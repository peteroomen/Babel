/**
 * SPIKE variant — the supported boardgame.io answer to collective decisions.
 *
 * GDD §13 (Beacon siting) and §14 (Host route ties) need every Leader to
 * answer, not just the active one. boardgame.io's mechanism for that is
 * stages + setActivePlayers. This variant wires it up so the ADR can judge the
 * real cost rather than guessing at it.
 */
import type { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import {
  applyMove,
  currentPlayer,
  setupGame,
  type Coord,
  type Rotation,
  type GameState,
  type PendingVote,
} from '@babel-game/game-core';

const toCore = (playerID: string): string => `p${playerID}`;

const DEMO_VOTE: PendingVote = {
  id: 'beacon-1',
  question: 'Where does the first Beacon go?',
  options: ['north ridge', 'south flats'],
  votes: {},
};

export const BabelStagesSpike: Game<GameState> = {
  name: 'babel-spike-stages',

  setup: ({ ctx }) =>
    setupGame(
      Array.from({ length: ctx.numPlayers }, (_, i) => `Leader ${i + 1}`),
      'spike-seed',
    ),

  turn: {
    order: {
      first: ({ G }) => G.order.indexOf(currentPlayer(G)),
      next: ({ G }) => G.order.indexOf(currentPlayer(G)),
    },
    stages: {
      voting: {
        moves: {
          castVote: ({ G, playerID }, option: number) => {
            try {
              return applyMove(G, { type: 'castVote', player: toCore(playerID), option })
                .state;
            } catch {
              return INVALID_MOVE;
            }
          },
        },
      },
    },
  },

  moves: {
    placeTile: ({ G, playerID }, at: Coord, rotation: Rotation) => {
      try {
        return applyMove(G, { type: 'placeTile', player: toCore(playerID), at, rotation })
          .state;
      } catch {
        return INVALID_MOVE;
      }
    },

    /** Stands in for the Heaven Phase opening a Beacon-siting vote. */
    openVote: ({ G, events }) => {
      events.setActivePlayers({ all: 'voting' });
      return { ...G, pendingVote: DEMO_VOTE };
    },
  },
};
