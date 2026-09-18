import { HOSTS } from '@babel-game/game-data';
import {
  applyMove,
  coordKey,
  currentPlayer,
  effectiveHostDefence,
  getLegalActions,
  hasWallBetween,
  hitsRemaining,
  rollsBeating,
  stepOptions,
  type Command,
  type Coord,
  type GameState,
  type PlayerId,
} from '@babel-game/game-core';
import {
  bestPlacement,
  chooseAction,
  chooseSwap,
  tieBreaker,
  type Archetype,
} from './policy.js';

/** Which seats at the table are played by the machine. */
export type AiSeats = Readonly<Record<PlayerId, Archetype>>;

/**
 * A tie-break source for the AI.
 *
 * Deliberately *not* the game's own RNG: drawing a tile must not shift what the
 * bots decide, and the harness has to be able to replay a game without the
 * agents' coin flips leaking into the seeded state the rules depend on.
 */
export function aiRandom(seed: string): () => number {
  return tieBreaker([...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
}

/**
 * The next command an AI seat would issue, or null when it has nothing to do.
 *
 * One command at a time rather than a whole turn, so a UI can apply them on a
 * timer and let a human watch what the opponents did. Call it again after
 * applying the result until it returns null.
 *
 * It answers only for the AI's *own* turn. Table decisions — siting a Beacon,
 * resolving the Heaven Phase, beginning a round — belong to whoever is at the
 * table and are handled by `tableCommand`.
 */
export function nextCommand(
  state: GameState,
  seats: AiSeats,
  rand: () => number,
): Command | null {
  if (state.phase === 'gameOver' || state.phase === 'heaven') return null;
  if (state.pendingBeacon || state.pendingVote) return null;

  /* GDD §15: an Attack that rolled successes must assign them before anything
     else can happen, so this comes before the turn check. */
  const pending = state.pendingAttack;
  if (pending) {
    if (!seats[pending.player]) return null;
    /**
     * Spend the dice hardest target first.
     *
     * Once Host kinds have their own Defence, a die that only just beat an
     * Ophanim cannot be spent on a Zealot — so the assignment has to start with
     * the targets that need the best rolls, while the good dice are still
     * unspent. Going easiest-first would strand them.
     */
    const bonus = state.rules.combatDieBonus;
    const defenceOf = (host: (typeof state.hosts)[number]) => effectiveHostDefence(state, host);
    const assignments: Record<string, number> = {};
    let spent = 0;

    for (const host of [...state.hosts].sort((a, b) => defenceOf(b) - defenceOf(a))) {
      const good = rollsBeating(pending.rolls, defenceOf(host), bonus) - spent;
      if (good <= 0) continue;
      const take = Math.min(good, pending.successes - spent, hitsRemaining(host));
      if (take <= 0) continue;
      assignments[host.id] = take;
      spent += take;
    }
    return { type: 'assignHits', player: pending.player, assignments };
  }

  /* GDD §18: after acting, a Leader holding Frenzied Works must play it or end
     the turn. These bots decline, so the window never stalls the table. */
  if (state.bonusWindow && seats[state.bonusWindow]) {
    return { type: 'endTurn', player: state.bonusWindow };
  }

  if (state.phase !== 'turns') return null;
  const me = currentPlayer(state);
  const archetype = seats[me];
  if (!archetype) return null;

  if (state.turnStep === 'place') {
    if (!state.drawnTile) return null;
    /* Milestone 6: the Reserve swap is free and happens before placing. */
    const slot = chooseSwap(state, me, archetype, rand);
    if (slot !== null) return { type: 'swapReserve', player: me, slot };

    const placement = bestPlacement(state, me, state.drawnTile, archetype, rand);
    if (!placement) return null;
    return { type: 'placeTile', player: me, at: placement.at, rotation: placement.rotation };
  }

  const choice = chooseAction(state, me, archetype, getLegalActions(state, me), rand);
  switch (choice.kind) {
    case 'buildBabel':
      return { type: 'buildBabel', player: me, pieces: choice.pieces };
    case 'buildHarvester':
      return { type: 'buildHarvester', player: me, at: choice.at, building: choice.building };
    case 'buildTower':
      return { type: 'buildTower', player: me, at: choice.at };
    case 'buildMonument':
      return { type: 'buildMonument', player: me, at: choice.at };
    case 'buildWalls':
      return { type: 'buildWalls', player: me, edges: choice.edges };
    case 'muster':
      return { type: 'muster', player: me };
    case 'attack':
      return {
        type: 'attack',
        player: me,
        dice: choice.dice,
        extraDice: choice.extraDice,
      };
    case 'buyScheme':
      return { type: 'buyScheme', player: me };
    case 'barter':
      return { type: 'barter', player: me, spend: choice.spend, gain: choice.gain };
    default:
      return { type: 'pass', player: me };
  }
}

/**
 * Walk each Host into a Wall, where the table has the choice.
 *
 * GDD §14 lets the players pick between equally short routes, and §17 makes a
 * Wall cost the Host that crossed it its whole movement — so when one of a
 * Host's legal steps crosses a Wall, steering it there is simply the correct
 * play, and it is the play that makes a Wall worth building at all.
 *
 * Without this the bots take a random step among the equally short ones and a
 * Wall only ever lands by luck, which measures the dice rather than the rule
 * (docs/AI_AND_HARNESS.md: a bot defect looks exactly like a balance finding).
 *
 * Only the first step of each Host is planned, and only when a Wall is actually
 * there to be chosen: everything else stays random, so this changes nothing
 * about a game with no Walls in it.
 */
export function heavenPlan(state: GameState): Record<string, readonly Coord[]> {
  if (state.walls.length === 0) return {};
  const plan: Record<string, readonly Coord[]> = {};

  for (const host of state.hosts) {
    const how = {
      impassable: state.rules.impassableTerrain,
      flies: HOSTS[host.kind].flies,
    };
    const options = stepOptions(state.board, host.at, undefined, how);
    /* With one legal step there is nothing to steer: it happens anyway. */
    if (options.length < 2) continue;
    const intoWall = options.find((option) => hasWallBetween(state.walls, host.at, option));
    if (intoWall && coordKey(intoWall) !== coordKey(host.at)) plan[host.id] = [intoWall];
  }

  return plan;
}

/**
 * The next table-level command, for a table with nobody human at it.
 *
 * The harness uses this to run unattended games. A human table keeps these
 * decisions — they are collective, and RD-005 and RD-008 make them the point
 * of several rules.
 */
export function tableCommand(state: GameState, rand: () => number): Command | null {
  if (state.phase === 'gameOver') return null;
  const speaker = state.order[0]!;

  if (state.pendingBeacon) {
    const sites = state.pendingBeacon.sites;
    if (sites.length === 0) return null;
    /* RD-009 leaves the choice open; picking at random stops Beacon siting
       becoming a hidden constant shared by every simulated game. */
    return { type: 'placeBeacon', player: speaker, at: sites[Math.floor(rand() * sites.length)]! };
  }
  if (state.phase === 'heaven') {
    return { type: 'resolveHeaven', player: speaker, plan: heavenPlan(state) };
  }
  if (state.pendingVote) {
    const voter = state.order.find((id) => state.pendingVote!.votes[id] === undefined);
    return voter ? { type: 'castVote', player: voter, option: 0 } : null;
  }
  /**
   * GDD §18: revealing Confusion pauses the round while somebody holds a
   * Common Tongue. The bots always spend it rather than saving it for a worse
   * card — a simple, consistent policy, and one that keeps a bought Scheme from
   * sitting dead in hand for the rest of the game.
   */
  if (state.phase === 'confusion') {
    const holder = state.order.find((id) =>
      state.leaders[id]!.schemeHand.includes('common-tongue'),
    );
    return holder
      ? { type: 'playScheme', player: holder, scheme: 'common-tongue' }
      : { type: 'beginRound', player: speaker };
  }
  return null;
}

/**
 * Apply commands until it is a human's move again, or nothing is left to do.
 *
 * `guard` bounds the loop so a policy bug reports as a stuck table rather than
 * hanging the browser.
 */
export function runAi(
  state: GameState,
  seats: AiSeats,
  rand: () => number,
  options: { readonly table?: boolean; readonly guard?: number } = {},
): { state: GameState; applied: readonly Command[] } {
  const applied: Command[] = [];
  let current = state;
  for (let i = 0; i < (options.guard ?? 200); i++) {
    const command =
      nextCommand(current, seats, rand) ??
      (options.table ? tableCommand(current, rand) : null);
    if (!command) break;
    current = applyMove(current, command).state;
    applied.push(command);
  }
  return { state: current, applied };
}
