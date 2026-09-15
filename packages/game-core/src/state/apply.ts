import {
  BARTER_COST,
  BUILDINGS,
  BUILDING_PRESTIGE,
  COMBAT_PRESTIGE,
  MAX_ARMY,
  MUSTER_COST,
  RESOURCE_TYPES,
  type ResourceType,
} from '@babel-game/game-data';
import { applyHit, rollAttack, validateAssignments } from '../combat/index.js';
import { getLegalBeaconSites, hostDefence } from '../heaven/beacons.js';
import { beaconsOwed, openBeaconDecision, resolveHeavenPhase } from '../heaven/phase.js';
import { isFoundationOccupied, occupiedKeys } from '../heaven/hosts.js';
import {
  canBuildBabel,
  isBabelComplete,
  piecePrestige,
  pieceCost,
  stageAfterPiece,
} from '../babel/index.js';
import { canAfford, canBuildHarvester, paySpecific } from '../buildings/index.js';
import { resolveHarvest } from '../economy/harvest.js';
import { placementPayout } from '../economy/payout.js';
import { coordKey } from '../map/edges.js';
import { isLegalPlacement, type Board } from '../map/placement.js';
import { nextInt } from '../rng/index.js';
import { drawPlaceableTile } from './setup.js';
import type {
  ApplyResult,
  Command,
  GameEvent,
  GameState,
  LeaderState,
  PendingVote,
  PlayerId,
} from './types.js';

export function currentPlayer(state: GameState): PlayerId {
  return state.order[state.currentPlayerIndex] as PlayerId;
}

const leaderOf = (state: GameState, id: PlayerId): LeaderState =>
  state.leaders[id] as LeaderState;

/** Add resources to one Leader without touching the others. */
function credit(
  state: GameState,
  id: PlayerId,
  resource: ResourceType,
  amount: number,
): GameState['leaders'] {
  const leader = leaderOf(state, id);
  return {
    ...state.leaders,
    [id]: {
      ...leader,
      resources: { ...leader.resources, [resource]: leader.resources[resource] + amount },
    },
  };
}

/**
 * Resolve a completed vote. Majority wins; a tie is broken by a seeded coin
 * flip so the result is deterministic and replays identically. See RD-005.
 */
function resolveVote(
  state: GameState,
  vote: PendingVote,
): { state: GameState; events: GameEvent[] } {
  const tally = vote.options.map(
    (_, i) => Object.values(vote.votes).filter((v) => v === i).length,
  );
  const best = Math.max(...tally);
  const tied = tally.flatMap((count, i) => (count === best ? [i] : []));

  let rng = state.rng;
  let choice = tied[0] as number;
  const byCoinFlip = tied.length > 1;
  if (byCoinFlip) {
    const [pick, next] = nextInt(rng, tied.length);
    rng = next;
    choice = tied[pick] as number;
  }

  return {
    state: { ...state, rng, pendingVote: null },
    events: [
      {
        type: 'voteResolved',
        id: vote.id,
        choice: vote.options[choice] as string,
        byCoinFlip,
      },
    ],
  };
}

/** Draw the next Leader's tile, discarding any that cannot be placed (RD-002). */
function drawFor(
  state: GameState,
  player: PlayerId,
): { draw: GameState['drawnTile']; rng: GameState['rng']; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const { draw, rng, discarded } = drawPlaceableTile(state.board, state.rng);
  for (const tile of discarded) {
    events.push({
      type: 'tileDiscarded',
      player,
      terrain: tile.terrain,
      river: tile.river,
      reason: 'noLegalPlacement',
    });
  }
  events.push({ type: 'tileDrawn', player, terrain: draw.terrain, river: draw.river });
  return { draw, rng, events };
}

/**
 * Hand the turn on. GDD §11: when play would return to the First Player the
 * round is over and the Heaven Phase follows, which the table resolves
 * explicitly rather than it happening invisibly.
 */
function endTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [{ type: 'turnEnded', player: currentPlayer(state) }];
  const nextIndex = (state.currentPlayerIndex + 1) % state.order.length;

  if (nextIndex === state.firstPlayerIndex) {
    /* GDD §13: any Beacons owed are sited before Heaven spawns from them. */
    const opened = openBeaconDecision({
      ...state,
      phase: 'heaven',
      turnStep: 'action',
      drawnTile: null,
    });
    events.push(...opened.events);
    return { state: opened.state, events };
  }

  const nextPlayer = state.order[nextIndex] as PlayerId;
  const drawn = drawFor(state, nextPlayer);
  events.push(...drawn.events);

  return {
    state: {
      ...state,
      currentPlayerIndex: nextIndex,
      turnStep: 'place',
      drawnTile: drawn.draw,
      rng: drawn.rng,
    },
    events,
  };
}

/** Begin the next round. GDD §11: pass the First Player marker clockwise. */
function advanceRound(state: GameState): { state: GameState; events: GameEvent[] } {
  const round = state.round + 1;
  const firstPlayerIndex = (state.firstPlayerIndex + 1) % state.order.length;
  const nextPlayer = state.order[firstPlayerIndex] as PlayerId;

  const events: GameEvent[] = [{ type: 'roundStarted', round }];
  const drawn = drawFor(state, nextPlayer);
  events.push(...drawn.events);

  return {
    state: {
      ...state,
      round,
      firstPlayerIndex,
      currentPlayerIndex: firstPlayerIndex,
      phase: 'turns',
      turnStep: 'place',
      drawnTile: drawn.draw,
      rng: drawn.rng,
    },
    events,
  };
}

/** Shared preconditions for the one action a Leader takes each turn. */
function requireActionPhase(state: GameState, player: PlayerId): void {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  if (state.phase === 'heaven') throw new Error('the Heaven Phase must be resolved');
  if (state.pendingVote) throw new Error('a vote is open');
  if (state.pendingBeacon) throw new Error('a Beacon must be placed');
  if (state.pendingAttack) throw new Error('assign your hits first');
  if (player !== currentPlayer(state)) throw new Error('not your turn');
  if (state.turnStep !== 'action') throw new Error('place your tile first');
}

/**
 * The single authoritative state transition. Pure: the same state plus the same
 * command always yields the same result, with all randomness drawn from the
 * serializable RNG carried in the state.
 */
export function applyMove(state: GameState, command: Command): ApplyResult {
  const events: GameEvent[] = [];
  const commit = (next: GameState): ApplyResult => ({
    state: { ...next, log: [...state.log, ...events] },
    events,
  });

  /** Log the action, then hand the turn on. */
  const finishAction = (next: GameState, action: string): ApplyResult => {
    events.push({ type: 'actionTaken', player: command.player, action });
    const ended = endTurn(next);
    events.push(...ended.events);
    return commit(ended.state);
  };

  switch (command.type) {
    case 'castVote': {
      const vote = state.pendingVote;
      if (!vote) throw new Error('no vote is open');
      if (!state.leaders[command.player]) throw new Error('unknown player');
      if (command.option < 0 || command.option >= vote.options.length) {
        throw new Error('vote option out of range');
      }

      const votes = { ...vote.votes, [command.player]: command.option };
      events.push({ type: 'voteCast', id: vote.id, player: command.player });

      if (!state.order.every((id) => id in votes)) {
        return commit({ ...state, pendingVote: { ...vote, votes } });
      }

      const resolved = resolveVote(state, { ...vote, votes });
      events.push(...resolved.events);
      return commit(resolved.state);
    }

    case 'placeTile': {
      if (state.phase === 'gameOver') throw new Error('the game is over');
      if (state.phase === 'heaven') throw new Error('the Heaven Phase must be resolved');
      if (state.pendingVote) throw new Error('a vote is open');
      if (state.pendingBeacon) throw new Error('a Beacon must be placed');
      if (command.player !== currentPlayer(state)) throw new Error('not your turn');
      if (state.turnStep !== 'place') throw new Error('tile already placed this turn');

      const draw = state.drawnTile;
      if (!draw) throw new Error('no tile drawn');
      if (!isLegalPlacement(state.board, command.at, draw, command.rotation)) {
        throw new Error('illegal placement');
      }

      const board: Board = {
        ...state.board,
        [coordKey(command.at)]: { ...draw, rotation: command.rotation },
      };

      events.push({
        type: 'tilePlaced',
        player: command.player,
        at: command.at,
        terrain: draw.terrain,
        river: draw.river,
        rotation: command.rotation,
      });

      let next: GameState = { ...state, board };

      /* GDD §9: foreign harvesting buildings first, so the placer's +1 is known. */
      const occupied = occupiedKeys(state.hosts);
      const harvest = resolveHarvest(
        board,
        state.buildings,
        occupied,
        command.at,
        draw,
        command.player,
      );

      /* GDD §6 payout, suppressed inside an occupied feature by GDD §10. */
      const payout = placementPayout(board, occupied, command.at, draw);

      if (payout) {
        const total = payout.amount + (harvest ? harvest.placerBonus : 0);
        events.push({
          type: 'resourcesGained',
          player: command.player,
          resource: payout.resource,
          amount: total,
          source: 'placement',
        });
        next = { ...next, leaders: credit(next, command.player, payout.resource, total) };
      } else if (draw.terrain !== 'desert' && draw.terrain !== 'lake') {
        events.push({
          type: 'payoutSuppressed',
          player: command.player,
          at: command.at,
          reason: 'featureOccupied',
        });
      }

      if (harvest) {
        events.push({
          type: 'harvestTriggered',
          placer: command.player,
          owners: harvest.owners,
          resource: harvest.resource,
          amount: harvest.amount,
          placerBonus: harvest.placerBonus,
        });
        for (const owner of harvest.owners) {
          events.push({
            type: 'resourcesGained',
            player: owner,
            resource: harvest.resource,
            amount: harvest.amount,
            source: 'harvest',
          });
          next = { ...next, leaders: credit(next, owner, harvest.resource, harvest.amount) };
        }
      }

      return commit({ ...next, drawnTile: null, turnStep: 'action' });
    }

    case 'buildHarvester': {
      requireActionPhase(state, command.player);
      const leader = leaderOf(state, command.player);
      const rejection = canBuildHarvester(
        state.board,
        state.buildings,
        leader,
        command.at,
        command.building,
      );
      if (rejection) throw new Error(`cannot build: ${rejection}`);

      events.push({
        type: 'buildingConstructed',
        player: command.player,
        at: command.at,
        building: command.building,
      });
      /* GDD §9: constructing a harvesting building gives +1 Prestige. */
      events.push({
        type: 'prestigeGained',
        player: command.player,
        amount: BUILDING_PRESTIGE,
        source: 'building',
      });

      return finishAction(
        {
          ...state,
          buildings: {
            ...state.buildings,
            [coordKey(command.at)]: { type: command.building, owner: command.player },
          },
          leaders: {
            ...state.leaders,
            [command.player]: {
              ...leader,
              resources: paySpecific(leader, BUILDINGS[command.building].cost),
              prestige: leader.prestige + BUILDING_PRESTIGE,
            },
          },
        },
        `build ${command.building}`,
      );
    }

    case 'buildBabel': {
      requireActionPhase(state, command.player);
      /* GDD §2: Babel cannot be built while a Host occupies the Foundation. */
      if (isFoundationOccupied(state.hosts)) {
        throw new Error('the Foundation is occupied');
      }
      const leader = leaderOf(state, command.player);
      if (!canBuildBabel(leader, state.stage)) throw new Error('cannot afford a Babel piece');

      const prestige = piecePrestige(state.stage);
      const babel = { stack: [...state.babel.stack, command.player] };

      events.push({
        type: 'babelPieceBuilt',
        player: command.player,
        stage: state.stage,
        pieces: babel.stack.length,
      });
      events.push({
        type: 'prestigeGained',
        player: command.player,
        amount: prestige,
        source: 'babel',
      });

      let next: GameState = {
        ...state,
        babel,
        leaders: {
          ...state.leaders,
          [command.player]: {
            ...leader,
            resources: paySpecific(leader, pieceCost(state.stage)),
            prestige: leader.prestige + prestige,
          },
        },
      };

      /* GDD §12: permanent escalation at the end of Stage I and Stage II. */
      const stage = stageAfterPiece(babel, state.stage, state.order.length);
      if (stage !== state.stage) {
        events.push({ type: 'stageEscalated', from: state.stage, to: stage });
        next = { ...next, stage };
      }

      /* GDD §2: completing the final piece wins the game for humanity. */
      if (isBabelComplete(babel, state.order.length)) {
        const best = Math.max(...Object.values(next.leaders).map((l) => l.prestige));
        const topPrestige = next.order.filter((id) => next.leaders[id]!.prestige === best);
        events.push({ type: 'humanityWins', topPrestige });
        return commit({
          ...next,
          phase: 'gameOver',
          turnStep: 'action',
          drawnTile: null,
          winner: topPrestige.length === 1 ? (topPrestige[0] as PlayerId) : null,
        });
      }

      const finished = finishAction(next, 'babel');
      /* GDD §13: new Beacons are sited immediately after the piece that
         triggered the Stage is completed. */
      if (finished.state.pendingBeacon || beaconsOwed(finished.state) <= 0) return finished;
      const opened = openBeaconDecision(finished.state);
      return {
        state: { ...opened.state, log: [...finished.state.log, ...opened.events] },
        events: [...finished.events, ...opened.events],
      };
    }

    case 'barter': {
      requireActionPhase(state, command.player);
      /* GDD §8: discard any 3 resource cards to gain 1 of your choice. */
      if (command.spend.length !== BARTER_COST) {
        throw new Error(`Barter discards exactly ${BARTER_COST} resources`);
      }
      if (!RESOURCE_TYPES.includes(command.gain)) throw new Error('unknown resource');

      const leader = leaderOf(state, command.player);
      const resources = { ...leader.resources };
      for (const resource of command.spend) {
        if (!RESOURCE_TYPES.includes(resource)) throw new Error('unknown resource');
        if (resources[resource] <= 0) throw new Error('not enough resources to Barter');
        resources[resource] -= 1;
      }
      resources[command.gain] += 1;

      events.push({
        type: 'bartered',
        player: command.player,
        spent: command.spend,
        gained: command.gain,
      });

      return finishAction(
        { ...state, leaders: { ...state.leaders, [command.player]: { ...leader, resources } } },
        'barter',
      );
    }

    case 'muster': {
      requireActionPhase(state, command.player);
      const leader = leaderOf(state, command.player);
      /* GDD §15: 1 Food + 1 Metal for one more Army die, to a maximum of 5. */
      if (leader.army >= MAX_ARMY) throw new Error('Army is already at its maximum');
      if (!canAfford(leader, MUSTER_COST)) throw new Error('cannot afford to Muster');

      events.push({ type: 'mustered', player: command.player, army: leader.army + 1 });
      return finishAction(
        {
          ...state,
          leaders: {
            ...state.leaders,
            [command.player]: {
              ...leader,
              resources: paySpecific(leader, MUSTER_COST),
              army: leader.army + 1,
            },
          },
        },
        'muster',
      );
    }

    case 'attack': {
      requireActionPhase(state, command.player);
      if (state.hosts.length === 0) throw new Error('there are no Hosts to attack');

      const leader = leaderOf(state, command.player);
      const defence = hostDefence(state.order.length, state.stage);
      const { result, rng } = rollAttack(state.rng, leader.army, defence);

      events.push({
        type: 'attackRolled',
        player: command.player,
        rolls: result.rolls,
        defence,
        successes: result.successes,
      });

      /* Nothing to assign, so the action is over. */
      if (result.successes === 0) return finishAction({ ...state, rng }, 'attack');

      /* GDD §15: successful dice are assigned among Hosts after rolling. */
      return commit({
        ...state,
        rng,
        pendingAttack: {
          player: command.player,
          rolls: result.rolls,
          defence,
          successes: result.successes,
        },
      });
    }

    case 'assignHits': {
      const pending = state.pendingAttack;
      if (!pending) throw new Error('no Attack is awaiting assignment');
      if (pending.player !== command.player) throw new Error('not your Attack');

      const invalid = validateAssignments(state.hosts, command.assignments, pending.successes);
      if (invalid) throw new Error(invalid);

      const hosts = [...state.hosts];
      let killed = 0;
      for (const [id, count] of Object.entries(command.assignments)) {
        for (let hit = 0; hit < count; hit++) {
          const index = hosts.findIndex((host) => host.id === id);
          if (index === -1) break;
          const outcome = applyHit(hosts[index] as GameState['hosts'][number]);
          if (outcome.killed) {
            events.push({ type: 'hostKilled', player: command.player, id });
            hosts.splice(index, 1);
            killed += 1;
          } else {
            events.push({
              type: 'hostHit',
              player: command.player,
              id,
              shieldBroken: outcome.shieldBroken,
            });
            hosts[index] = outcome.host as GameState['hosts'][number];
          }
        }
      }

      const leader = leaderOf(state, command.player);
      const prestige = killed * COMBAT_PRESTIGE;
      if (prestige > 0) {
        /* GDD §15: +1 Prestige per Host killed during your Attack action. */
        events.push({
          type: 'prestigeGained',
          player: command.player,
          amount: prestige,
          source: 'combat',
        });
      }

      return finishAction(
        {
          ...state,
          hosts,
          pendingAttack: null,
          leaders: {
            ...state.leaders,
            [command.player]: { ...leader, prestige: leader.prestige + prestige },
          },
        },
        'attack',
      );
    }

    case 'pass': {
      requireActionPhase(state, command.player);
      return finishAction(state, 'pass');
    }

    case 'placeBeacon': {
      const pending = state.pendingBeacon;
      if (!pending) throw new Error('no Beacon is pending');
      if (!state.leaders[command.player]) throw new Error('unknown player');
      if (!pending.sites.some((site) => coordKey(site) === coordKey(command.at))) {
        throw new Error('illegal Beacon site');
      }

      const beacons = [...state.beacons, command.at];
      events.push({ type: 'beaconPlaced', at: command.at, total: beacons.length });

      const opened = openBeaconDecision({ ...state, beacons });
      events.push(...opened.events);
      return commit(opened.state);
    }

    case 'resolveHeaven': {
      if (state.phase !== 'heaven') throw new Error('it is not the Heaven Phase');
      if (state.pendingBeacon) throw new Error('a Beacon must be placed first');
      if (!state.leaders[command.player]) throw new Error('unknown player');

      const resolved = resolveHeavenPhase(state, command.plan ?? {});
      events.push(...resolved.events);
      if (resolved.state.phase === 'gameOver') return commit(resolved.state);

      const advanced = advanceRound(resolved.state);
      events.push(...advanced.events);
      return commit(advanced.state);
    }
  }
}

/**
 * Per-player view. GDD §18: Scheme hands are hidden, so a networked client must
 * never receive another Leader's hand.
 */
export function playerView(state: GameState, viewer: PlayerId): GameState {
  const leaders = Object.fromEntries(
    Object.entries(state.leaders).map(([id, leader]) => [
      id,
      id === viewer ? leader : { ...leader, schemeHand: [] },
    ]),
  );
  return { ...state, leaders };
}
