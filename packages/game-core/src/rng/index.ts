/**
 * Deterministic seeded RNG.
 *
 * The generator state is a plain serializable value and every draw is a pure
 * function returning the next state, so a game replays exactly from its seed
 * plus its command log. This is what makes bug reports reproducible, and later
 * lets a server own randomness authoritatively rather than the client.
 */
export type RngState = {
  /** Human-readable seed the game was created from. */
  readonly seed: string;
  /** Current 32-bit generator state. */
  readonly s: number;
};

/** FNV-1a. Stable across runs and platforms, unlike a hash of object order. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: string): RngState {
  return { seed, s: hashSeed(seed) };
}

/** mulberry32: one step, returning a float in [0, 1) and the next state. */
function step(rng: RngState): [number, RngState] {
  let a = (rng.s + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { seed: rng.seed, s: a }];
}

/** Integer in [0, bound). */
export function nextInt(rng: RngState, bound: number): [number, RngState] {
  if (bound <= 0) throw new Error(`nextInt bound must be positive, got ${bound}`);
  const [value, next] = step(rng);
  return [Math.floor(value * bound), next];
}

/** A single six-sided die, 1..6. GDD §15: every combat die is d6 + 2. */
export function rollD6(rng: RngState): [number, RngState] {
  const [value, next] = nextInt(rng, 6);
  return [value + 1, next];
}

/** Pick one entry by integer weight. Entries with weight <= 0 are never drawn. */
export function weightedPick<T extends string>(
  rng: RngState,
  weights: Readonly<Record<T, number>>,
): [T, RngState] {
  const entries = (Object.entries(weights) as [T, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) throw new Error('weightedPick requires at least one positive weight');
  const [roll, next] = nextInt(rng, total);
  let acc = 0;
  for (const [key, weight] of entries) {
    acc += weight;
    if (roll < acc) return [key, next];
  }
  /* istanbul ignore next -- unreachable while weights are finite integers */
  throw new Error('weightedPick fell through');
}

/** Fisher-Yates. Returns a new array; the input is not mutated. */
export function shuffle<T>(rng: RngState, items: readonly T[]): [T[], RngState] {
  const out = [...items];
  let state = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(state, i + 1);
    state = next;
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return [out, state];
}
