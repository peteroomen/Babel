/**
 * FINDING (see docs/ADR-001-framework.md).
 *
 * boardgame.io types a client's `moves` as a string-indexed record of
 * `(...args: any[]) => void`. Under `strict` + `noUncheckedIndexedAccess`
 * every call site is therefore both possibly-undefined and effectively
 * untyped: `moves.placeTile('nonsense', 42)` compiles.
 *
 * Type safety stops at the framework boundary, so we restore it with one
 * explicit cast in one place rather than scattering assertions through the UI.
 */
import type { Coord, Rotation } from '@babel-game/game-core';

export type BabelMoves = {
  placeTile(at: Coord, rotation: Rotation): void;
  takeAction(action: string): void;
  castVote(option: number): void;
  openVote(): void;
};

type MoveBag = { moves: Record<string, (...args: never[]) => void> };

export const movesOf = (client: MoveBag): BabelMoves =>
  client.moves as unknown as BabelMoves;
