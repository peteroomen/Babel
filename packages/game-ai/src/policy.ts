import {
  BABEL_PIECE_COST,
  BUILDINGS,
  MAX_ARMY,
  MUSTER_COST,
  RESOURCE_TYPES,
  SCHEME_COST,
  TERRAIN_RESOURCE,
  TOWER_COST,
  type ResourceType,
} from '@babel-game/game-data';
import {
  coordKey,
  distancesToBabel,
  getLegalTilePlacements,
  previewPlacement,
  type Coord,
  type GameState,
  type LegalAction,
  type PlayerId,
  type Rotation,
  type TileDraw,
} from '@babel-game/game-core';

/**
 * The three heuristic archetypes the pre-implementation modelling used
 * (docs/MODEL_NOTES.md). They are deliberately simple and legible: each one
 * pursues a different goal, so the action mix is produced by competing plans
 * rather than by a uniform random choice.
 *
 * They are not strong players and are not meant to be. Their job is to make
 * variants comparable to each other, which needs consistency, not skill.
 */
export type Archetype =
  | 'architect'
  | 'commander'
  | 'industrialist'
  | 'engineer'
  | 'merchant';

export const ARCHETYPES: readonly Archetype[] = [
  'architect',
  'commander',
  'industrialist',
  'engineer',
  'merchant',
];

/**
 * The three the pre-implementation modelling used (docs/MODEL_NOTES.md).
 * The harness keeps to these by default so a run stays comparable with the
 * numbers already on record.
 */
export const CLASSIC_TABLE: readonly Archetype[] = [
  'architect',
  'commander',
  'industrialist',
];

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  architect: 'Architect',
  commander: 'Commander',
  industrialist: 'Industrialist',
  engineer: 'Engineer',
  merchant: 'Merchant',
};

/** One line each, for the UI to say who it has sat you down with. */
export const ARCHETYPE_BLURB: Record<Archetype, string> = {
  architect: 'Races Babel upward and lets others worry about Heaven.',
  commander: 'Builds an Army and spends it. Metal first, questions later.',
  industrialist: 'Harvesters everywhere. Gets rich, helps late.',
  engineer: 'Towers and Walls. Makes the ground itself do the fighting.',
  merchant: 'Schemes and Barter. Chases Prestige wherever it is cheapest.',
};

type Cost = Partial<Record<ResourceType, number>>;

/** A tiny deterministic generator for tie-breaks, kept out of the game's RNG. */
export function tieBreaker(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** How short this Leader is of a cost, resource by resource. */
function shortfall(state: GameState, me: PlayerId, cost: Cost): Cost {
  const held = state.leaders[me]!.resources;
  const gap: Cost = {};
  for (const resource of RESOURCE_TYPES) {
    const need = (cost[resource] ?? 0) - held[resource];
    if (need > 0) gap[resource] = need;
  }
  return gap;
}

const canPay = (state: GameState, me: PlayerId, cost: Cost): boolean =>
  Object.keys(shortfall(state, me, cost)).length === 0;

/** How close Heaven has got to Babel. Infinity when nothing is on the board. */
export function threatDistance(state: GameState): number {
  if (state.hosts.length === 0) return Infinity;
  const distance = distancesToBabel(state.board);
  return Math.min(
    ...state.hosts.map((host) => distance[coordKey(host.at)] ?? Infinity),
  );
}

/**
 * What this archetype is currently saving for. This is the plan the Leader is
 * trying to pursue, and it is what the resource-access metric is measured
 * against — "could you pursue the plan you wanted this turn?".
 */
export function goal(state: GameState, me: PlayerId, archetype: Archetype): Cost {
  const leader = state.leaders[me]!;
  const piece = BABEL_PIECE_COST[state.stage];

  switch (archetype) {
    case 'architect':
      return piece;
    case 'commander':
      if (leader.army < 4) return MUSTER_COST;
      if (state.hosts.length > 0) return TOWER_COST;
      return piece;
    case 'industrialist': {
      /* Whichever harvester it is furthest from affording, so its want tracks
         the engine it is trying to build rather than one fixed bundle. */
      const options = Object.values(BUILDINGS).map((spec) => spec.cost as Cost);
      const affordable = options.filter((cost) => canPay(state, me, cost));
      return affordable.length > 0 ? piece : (options[0] as Cost);
    }
    case 'engineer':
      /* Towers while there is anything to shoot at, then help with Babel. */
      return state.hosts.length > 0 ? TOWER_COST : piece;
    case 'merchant':
      return canPay(state, me, SCHEME_COST) ? piece : SCHEME_COST;
  }
}

/** The single resource this Leader most needs, or null when the plan is funded. */
export function want(
  state: GameState,
  me: PlayerId,
  archetype: Archetype,
): ResourceType | null {
  const gap = shortfall(state, me, goal(state, me, archetype));
  let worst: ResourceType | null = null;
  for (const resource of RESOURCE_TYPES) {
    const need = gap[resource] ?? 0;
    if (need > 0 && (worst === null || need > (gap[worst] ?? 0))) worst = resource;
  }
  return worst;
}

export type Placement = { at: Coord; rotation: Rotation; score: number };

/**
 * Score every legal placement for a tile and return the best.
 *
 * The payout the placement would pay *this Leader* dominates, weighted up when
 * it pays the resource they are short of. The Commander also values pushing
 * the frontier away from Babel, since a longer route is more turns of warning.
 */
export function bestPlacement(
  state: GameState,
  me: PlayerId,
  draw: TileDraw,
  archetype: Archetype,
  rand: () => number,
): Placement | null {
  const seeking = want(state, me, archetype);
  let best: Placement | null = null;

  for (const option of getLegalTilePlacements(state.board, draw)) {
    /**
     * Score the square, not the square-and-rotation.
     *
     * A payout is 1 plus the adjacent tiles of the same terrain, suppressed if
     * the feature is occupied (GDD §6, §10) — none of which depends on how the
     * tile is turned. Rotation only decides where the river runs, and the
     * legality scan has already thrown out the rotations that would break
     * RD-001. Scoring each rotation separately meant rebuilding a copy of the
     * whole board and flood-filling its feature up to four times per square,
     * which is where the model spent most of its time.
     */
    const rotation = option.rotations[0];
    if (rotation === undefined) continue;
    const payout = previewPlacement(state, option.at, draw, rotation);

    let score = payout ? payout.amount : 0;
    if (payout && payout.resource === seeking) score *= 3;

    /* A tile whose terrain carries the building this Leader wants is worth
       something even when it pays nothing today. */
    if (TERRAIN_RESOURCE[draw.terrain] === seeking) score += 1;

    /* The Commander and the Engineer lean towards the frontier, since a longer
       route to Babel is more rounds of warning — but only lean. Weighting this
       heavily starved them of the income their plans run on. */
    if (archetype === 'commander' || archetype === 'engineer') {
      score += (Math.abs(option.at.x) + Math.abs(option.at.y)) * 0.08;
    }
    if (archetype === 'industrialist' && payout) score += payout.amount * 0.5;

    score += rand() * 0.4;
    if (!best || score > best.score) best = { at: option.at, rotation, score };
  }
  return best;
}

/**
 * Which Reserve slot to take, or null to keep the blind draw.
 *
 * Scored with the same function as placement, so a swap happens exactly when
 * the face-up tile would genuinely place better. The margin stops a Leader
 * churning the communal slot for a rounding difference.
 */
export function chooseSwap(
  state: GameState,
  me: PlayerId,
  archetype: Archetype,
  rand: () => number,
): number | null {
  if (state.reserve.length === 0 || !state.drawnTile) return null;
  const mine = bestPlacement(state, me, state.drawnTile, archetype, rand);
  const floor = mine?.score ?? 0;

  /* The margin must exceed the full range of the tie-break noise (2 x 0.4),
     or a Leader could swap a tile away and immediately want it back. */
  let bestSlot: number | null = null;
  let bestScore = floor + 1;
  state.reserve.forEach((tile, slot) => {
    const candidate = bestPlacement(state, me, tile, archetype, rand);
    if (candidate && candidate.score > bestScore) {
      bestScore = candidate.score;
      bestSlot = slot;
    }
  });
  return bestSlot;
}

const find = <T extends LegalAction['type']>(
  legal: readonly LegalAction[],
  type: T,
): Extract<LegalAction, { type: T }> | undefined =>
  legal.find((action) => action.type === type) as
    | Extract<LegalAction, { type: T }>
    | undefined;

/**
 * Choose what to spend on a Barter, and what to take.
 *
 * Returns null when no useful trade exists, which under `sameKind` is common:
 * a Leader spread across four resources holds three of none of them, and a
 * Leader whose only stack of three is the resource they want gains nothing by
 * converting it. That gap is the candidate's whole point, so the agent must
 * not paper over it by bartering pointlessly.
 */
export function chooseBarter(
  state: GameState,
  me: PlayerId,
  archetype: Archetype,
  action: Extract<LegalAction, { type: 'barter' }>,
): { spend: ResourceType[]; gain: ResourceType } | null {
  const seeking = want(state, me, archetype);
  if (!seeking) return null;
  const held = state.leaders[me]!.resources;
  const needed = goal(state, me, archetype);
  const cost = state.rules.barterCost;

  if (state.rules.barterMode === 'sameKind') {
    const from = action.spendable
      .filter((resource) => resource !== seeking)
      /* Spend down the deepest stack the plan has least use for. */
      .sort((a, b) => held[b] - (needed[b] ?? 0) - (held[a] - (needed[a] ?? 0)))[0];
    if (!from) return null;
    return { spend: Array<ResourceType>(cost).fill(from), gain: seeking };
  }

  /* Mixed: spend the units the plan has no use for, deepest stacks first. */
  const pool: ResourceType[] = [];
  for (const resource of [...RESOURCE_TYPES].sort(
    (a, b) => held[b] - (needed[b] ?? 0) - (held[a] - (needed[a] ?? 0)),
  )) {
    const spare = resource === seeking ? Math.max(0, held[resource] - 1) : held[resource];
    for (let i = 0; i < spare; i++) pool.push(resource);
  }
  if (pool.length < cost) return null;
  return { spend: pool.slice(0, cost), gain: seeking };
}

export type ActionChoice =
  | { kind: 'pass' }
  | { kind: 'buildBabel' }
  | { kind: 'buildHarvester'; at: Coord; building: 'sawmill' | 'farmstead' | 'brickworks' | 'mine' }
  | { kind: 'buildTower'; at: Coord }
  | { kind: 'buildWalls'; edges: readonly { a: Coord; b: Coord }[] }
  | { kind: 'muster' }
  | { kind: 'attack'; dice: number }
  | { kind: 'buyScheme' }
  | { kind: 'barter'; spend: ResourceType[]; gain: ResourceType };

/**
 * Where to spend a Wall action.
 *
 * GDD §17: crossing a Wall destroys it and costs the Host its movement, so a
 * segment is a round of delay bought for 1 Wood. That only pays if the segment
 * is somewhere a Host will actually walk, which means the approach to Babel:
 * an edge between a square at distance d and one at d-1 is on a shortest route.
 *
 * The bots were placing segments at whatever edge the legality scan returned
 * first, usually out on the frontier where nothing was coming, which made the
 * cheapest defence in the game look worthless.
 */
export function bestWalls(
  state: GameState,
  action: Extract<LegalAction, { type: 'buildWalls' }>,
): readonly { a: Coord; b: Coord }[] {
  const distance = distancesToBabel(state.board);
  const at = (c: Coord) => distance[coordKey(c)] ?? Infinity;

  const scored = action.edges
    .map((edge) => {
      const near = Math.min(at(edge.a), at(edge.b));
      const far = Math.max(at(edge.a), at(edge.b));
      if (!Number.isFinite(far)) return { edge, score: -Infinity };
      /* On a shortest route in, and as close to Babel as we can get. */
      const onRoute = far === near + 1 ? 4 : 0;
      return { edge, score: onRoute - near };
    })
    .filter((entry) => entry.score > -Infinity)
    .sort((a, b) => b.score - a.score);

  return (scored.length > 0 ? scored : action.edges.map((edge) => ({ edge })))
    .slice(0, action.segments)
    .map((entry) => entry.edge);
}

/** Harvester site whose output the Leader most wants, else any site. */
function harvesterFor(
  action: Extract<LegalAction, { type: 'buildHarvester' }>,
  seeking: ResourceType | null,
  rand: () => number,
): ActionChoice | null {
  if (action.sites.length === 0) return null;
  const preferred = action.sites.filter(
    (site) => BUILDINGS[site.type].resource === seeking,
  );
  const pool = preferred.length > 0 ? preferred : action.sites;
  const site = pool[Math.floor(rand() * pool.length)]!;
  return { kind: 'buildHarvester', at: site.at, building: site.type };
}

/**
 * The one action, chosen by walking this archetype's priorities and taking the
 * first that is legal. A priority list rather than a scoring function because
 * it stays readable, and a reader has to be able to say what each bot wants.
 */
export function chooseAction(
  state: GameState,
  me: PlayerId,
  archetype: Archetype,
  legal: readonly LegalAction[],
  rand: () => number,
): ActionChoice {
  const leader = state.leaders[me]!;
  const seeking = want(state, me, archetype);
  const threat = threatDistance(state);
  const urgent = threat <= 2;

  const babel = find(legal, 'buildBabel');
  const attack = find(legal, 'attack');
  const muster = find(legal, 'muster');
  const tower = find(legal, 'buildTower');
  const walls = find(legal, 'buildWalls');
  const harvest = find(legal, 'buildHarvester');
  const scheme = find(legal, 'buyScheme');
  const barterAction = find(legal, 'barter');
  const barter = barterAction ? chooseBarter(state, me, archetype, barterAction) : null;
  const trade = (): ActionChoice | null =>
    barter ? { kind: 'barter', spend: barter.spend, gain: barter.gain } : null;

  const order: (ActionChoice | null)[] = [];
  const canMuster = (cap: number) => muster && leader.army < cap;

  /**
   * Heaven is outrunning the table, so everyone drops what they are doing.
   *
   * Every Beacon spawns a Host each round; once the standing count is well past
   * the spawn rate the table is losing ground and no amount of economy fixes
   * it. Without this, only the Commander ever defended and the other two
   * Leaders kept building while the Foundation was overrun — the loss condition
   * is shared (GDD §2), so the response has to be too.
   */
  const besieged =
    threatDistance(state) <= 1 ||
    state.hosts.length >= 3 * Math.max(1, state.beacons.length);

  /**
   * Where Army dice cost Food, attacking competes with the rest of the plan for
   * the same resource. Outside a siege a Leader keeps enough Food back to stay
   * solvent rather than swinging itself dry — otherwise the price changes what
   * Attack costs without changing how often anyone takes it, which would make
   * the variant untestable.
   */
  /**
   * How many Army dice to commit.
   *
   * Free dice are always worth rolling, so canon rolls the lot. Priced, a die
   * is a Food that Babel and Muster also want, so the Leader buys only as many
   * as the board needs — two hits per Seraph, one per Ophanim, allowing for the
   * roughly one-in-two to one-in-three that land — and never digs into what its
   * own plan is saving for unless the table is under siege.
   */
  const attackDice = ((): number => {
    if (!attack) return 0;
    const price = state.rules.attackDieCost;
    if (!price) return attack.dice;

    const hitsNeeded = state.hosts.reduce(
      (sum, host) => sum + (host.kind === 'seraph' && host.shieldUp ? 2 : 1),
      0,
    );
    const worthRolling = Math.min(attack.dice, Math.max(1, hitsNeeded * 2));
    const held = leader.resources[price.resource];
    const spare = besieged ? held : held - (goal(state, me, archetype)[price.resource] ?? 0);
    /* A flat price buys the whole Army, so there is nothing to ration: either
       the Leader can pay it or it cannot Attack. */
    if (price.flat) return spare >= price.amount ? worthRolling : 0;
    return Math.max(0, Math.min(worthRolling, Math.floor(spare / price.amount)));
  })();
  const attackAffordable = attack !== undefined && attackDice > 0;
  const swing = (): ActionChoice | null =>
    attackAffordable ? { kind: 'attack', dice: attackDice } : null;
  const defend = (armyCap: number): (ActionChoice | null)[] => [
    towerAt(),
    canMuster(armyCap) ? { kind: 'muster' } : null,
    swing(),
    state.hosts.length > 0 ? wall() : null,
  ];
  const towerAt = (): ActionChoice | null =>
    tower && state.hosts.length > 0
      ? { kind: 'buildTower', at: tower.sites[Math.floor(rand() * tower.sites.length)]! }
      : null;
  const wall = (): ActionChoice | null =>
    walls ? { kind: 'buildWalls', edges: bestWalls(state, walls) } : null;

  /**
   * Attack is never the fallback for "nothing better to do", and an emergency
   * never outranks the whole plan.
   *
   * At 3 Leaders every Beacon spawns a Host each round, so Heaven arrives at
   * 1, then 2, then 3 Hosts per round while the table gets at most 3 Attacks.
   * In Stage III a die hits on d6+2 >= 7, one roll in three, so three Army-1
   * Leaders attacking flat out kill one Host a round against three arriving.
   * Army size and Towers are what close that: a Tower in an occupied feature
   * adds a die to *every* Leader's Attack, so it is the only thing on the board
   * that scales with the whole table. Both are gated on Metal.
   *
   * Hence the shape below: fund the engine, build the multiplier, then swing.
   * An earlier ordering that attacked whenever a Host was near Babel produced a
   * table permanently in emergency, stuck at Army 2 with no Towers at all.
   */
  if (besieged) order.push(...defend(archetype === 'commander' ? 5 : 3));

  switch (archetype) {
    case 'architect':
      if (babel) order.push({ kind: 'buildBabel' });
      order.push(trade());
      order.push(towerAt());
      if (harvest) order.push(harvesterFor(harvest, seeking, rand));
      if (canMuster(3) && state.hosts.length > 0) order.push({ kind: 'muster' });
      order.push(swing());
      if (state.hosts.length > 0) order.push(wall());
      break;

    case 'commander':
      /* Muster outranks Attack all the way to Army 4, because a die bought now
         fires on every future Attack, and a Tower outranks both: it is
         permanent, communal, and adds a die to every Leader's Attack. */
      order.push(towerAt());
      if (canMuster(4)) order.push({ kind: 'muster' });
      order.push(swing());
      /* No amount of attacking produces the Metal that Muster and Towers both
         need, so fund the Army when there is nothing to shoot at. */
      if (leader.army < 4) order.push(trade());
      if (state.hosts.length > 0) order.push(wall());
      if (babel) order.push({ kind: 'buildBabel' });
      if (harvest) order.push(harvesterFor(harvest, seeking, rand));
      break;

    case 'industrialist':
      if (harvest) order.push(harvesterFor(harvest, seeking, rand));
      order.push(towerAt());
      if (babel) order.push({ kind: 'buildBabel' });
      order.push(trade());
      if (canMuster(3) && state.hosts.length > 0) order.push({ kind: 'muster' });
      order.push(swing());
      if (state.hosts.length > 0) order.push(wall());
      if (scheme && canPay(state, me, SCHEME_COST) && leader.army < MAX_ARMY) {
        order.push({ kind: 'buyScheme' });
      }
      break;

    case 'engineer':
      /* Makes the ground fight. A Tower is communal and permanent, and a Wall
         is a round of delay for 1 Wood — the cheapest thing in the game and
         the only use for the Wood everyone ends up drowning in. */
      order.push(towerAt());
      if (state.hosts.length > 0) order.push(wall());
      order.push(trade());
      if (harvest) order.push(harvesterFor(harvest, seeking, rand));
      order.push(swing());
      if (babel) order.push({ kind: 'buildBabel' });
      if (canMuster(3) && state.hosts.length > 0) order.push({ kind: 'muster' });
      break;

    case 'merchant':
      /* Chases Prestige at the best price: a Scheme is 2 resources for a card
         that can be worth a whole action, and Babel pays 2-4 Prestige flat.
         Contributes to defence only once the table is visibly losing, which is
         what `besieged` above has already covered. */
      if (scheme && canPay(state, me, SCHEME_COST)) order.push({ kind: 'buyScheme' });
      if (babel) order.push({ kind: 'buildBabel' });
      order.push(trade());
      if (harvest) order.push(harvesterFor(harvest, seeking, rand));
      order.push(swing());
      if (state.hosts.length > 0) order.push(wall());
      break;
  }

  return order.find((choice): choice is ActionChoice => choice !== null) ?? { kind: 'pass' };
}
