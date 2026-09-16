import {
  RESOURCE_TYPES,
  TERRAIN_TYPES,
  type ResourceType,
  type Stage,
  type TerrainType,
} from '@babel-game/game-data';
import { ARCHETYPES, type Archetype } from '@babel-game/game-ai';
import type { GameRecord } from './play.js';

/**
 * The metric set IMPLEMENTATION_PLAN.md Milestone 6 asks for, derived from the
 * recorded games. Everything here comes off the event log or the per-turn
 * record, so a metric can always be traced back to something that happened.
 */
export type Summary = {
  readonly variant: string;
  readonly games: number;
  /** GDD §2: humanity wins or loses together. */
  readonly sharedWinRate: number;
  readonly timeoutRate: number;
  readonly meanRounds: number;
  readonly meanRoundsWon: number | null;
  /** Share of all actions taken, by kind. */
  readonly actionMix: Readonly<Record<string, number>>;
  /**
   * Barters per 100 turns, counted from the events.
   *
   * `actionMix` cannot see a Barter that does not consume the turn's action, so
   * under free-Barter rules it reports 0% while the table trades every turn.
   * This counts what actually happened.
   */
  readonly bartersPer100Turns: number;
  /** Resources destroyed by Barter: it takes several cards and returns one. */
  readonly barterBurn: number;
  /**
   * Of the turns a Leader began short of something their plan needed, the
   * share in which they actually got some of it, from any source.
   */
  readonly accessRate: number;
  readonly turnsWanting: number;
  /** Units gained, split by where they came from. Barter counts the 1 gained. */
  readonly bySource: { placement: number; harvest: number; barter: number };
  /** Mean units left unspent at the end, per Leader, and by resource. */
  readonly surplus: number;
  readonly surplusByResource: Readonly<Record<ResourceType, number>>;
  /** Mean round at which each Stage was first reached, over games reaching it. */
  readonly stagePacing: Readonly<Partial<Record<Stage, number | null>>>;
  readonly meanBabelPieces: number;
  readonly prestigeByArchetype: Readonly<Record<Archetype, number>>;
  readonly prestigeWinsByArchetype: Readonly<Record<Archetype, number>>;
  /** Null when the variant has no Reserve. */
  readonly reserve: {
    readonly swapRate: number;
    readonly deadPerGame: number;
    readonly takenByTerrain: Readonly<Record<TerrainType, number>>;
    /** Share of tiles taken out of the Reserve that were Hills or Mountain. */
    readonly stoneShare: number;
  } | null;
};

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

const share = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);

export function summarise(variant: string, games: readonly GameRecord[]): Summary {
  const turns = games.flatMap((game) => game.turns);
  const events = games.flatMap((game) => game.events);

  const actionCounts: Record<string, number> = {};
  for (const turn of turns) actionCounts[turn.action] = (actionCounts[turn.action] ?? 0) + 1;
  const actionMix = Object.fromEntries(
    Object.entries(actionCounts).map(([action, count]) => [action, share(count, turns.length)]),
  );

  const barters = events.filter((event) => event.type === 'bartered');
  const burn = barters.reduce(
    (total, event) => total + (event.type === 'bartered' ? event.spent.length - 1 : 0),
    0,
  );

  const wanting = turns.filter((turn) => turn.wanted !== null);
  const satisfied = wanting.filter((turn) => turn.satisfied);

  const bySource = { placement: 0, harvest: 0, barter: 0 };
  for (const event of events) {
    if (event.type === 'resourcesGained') bySource[event.source] += event.amount;
    if (event.type === 'bartered') bySource.barter += 1;
  }

  const leaderCount = games.reduce((n, game) => n + Object.keys(game.prestige).length, 0);
  const surplusByResource = Object.fromEntries(
    RESOURCE_TYPES.map((resource) => [
      resource,
      share(
        games.reduce(
          (total, game) =>
            total +
            Object.values(game.finalResources).reduce((sum, held) => sum + held[resource], 0),
          0,
        ),
        leaderCount,
      ),
    ]),
  ) as Record<ResourceType, number>;

  const stagePacing: Partial<Record<Stage, number | null>> = {};
  for (const stage of [2, 3] as Stage[]) {
    const reached = games
      .map((game) => game.stageRounds[stage])
      .filter((round): round is number => round !== undefined);
    stagePacing[stage] = reached.length === 0 ? null : mean(reached);
  }

  const prestigeByArchetype = Object.fromEntries(
    ARCHETYPES.map((archetype) => [
      archetype,
      mean(
        games.flatMap((game) =>
          Object.entries(game.seats)
            .filter(([, seat]) => seat === archetype)
            .map(([id]) => game.prestige[id] ?? 0),
        ),
      ),
    ]),
  ) as Record<Archetype, number>;

  /* GDD §20: the individual winner is only decided after a shared victory. */
  const won = games.filter((game) => game.outcome === 'win');
  const prestigeWinsByArchetype = Object.fromEntries(
    ARCHETYPES.map((archetype) => [
      archetype,
      share(
        won.filter((game) => game.winner !== null && game.seats[game.winner] === archetype).length,
        won.length,
      ),
    ]),
  ) as Record<Archetype, number>;

  const reserveTurns = turns.filter((turn) => turn.swap !== null);
  const taken = games.flatMap((game) => game.reserveTaken);
  const reserve =
    reserveTurns.length === 0
      ? null
      : {
          swapRate: share(
            reserveTurns.filter((turn) => turn.swap !== 'kept').length,
            reserveTurns.length,
          ),
          deadPerGame: mean(games.map((game) => game.reserveDead)),
          takenByTerrain: Object.fromEntries(
            TERRAIN_TYPES.map((terrain) => [
              terrain,
              share(taken.filter((t) => t === terrain).length, taken.length),
            ]),
          ) as Record<TerrainType, number>,
          stoneShare: share(
            taken.filter((t) => t === 'hills' || t === 'mountain').length,
            taken.length,
          ),
        };

  return {
    variant,
    games: games.length,
    sharedWinRate: share(won.length, games.length),
    timeoutRate: share(games.filter((g) => g.outcome === 'timeout').length, games.length),
    meanRounds: mean(games.map((game) => game.rounds)),
    meanRoundsWon: won.length === 0 ? null : mean(won.map((game) => game.rounds)),
    actionMix,
    bartersPer100Turns: share(barters.length, turns.length) * 100,
    barterBurn: share(burn, games.length * 3),
    accessRate: share(satisfied.length, wanting.length),
    turnsWanting: wanting.length,
    bySource,
    surplus: share(
      games.reduce(
        (total, game) =>
          total +
          Object.values(game.finalResources).reduce(
            (sum, held) => sum + RESOURCE_TYPES.reduce((n, r) => n + held[r], 0),
            0,
          ),
        0,
      ),
      leaderCount,
    ),
    surplusByResource,
    stagePacing,
    meanBabelPieces: mean(games.map((game) => game.babelPieces)),
    prestigeByArchetype,
    prestigeWinsByArchetype,
    reserve,
  };
}
