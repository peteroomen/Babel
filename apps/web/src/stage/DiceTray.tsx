import type { GameState } from '@babel-game/game-core';
import { volleyOf } from '@babel-game/stagecraft';
import { HOST_LABEL, INK, RESOURCE_LABEL } from '../theme';
import { cn } from '@/lib/utils';

/** The pips of a d6 face, in the arrangement everyone already knows. */
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.26, 0.26],
    [0.5, 0.5],
    [0.74, 0.74],
  ],
  4: [
    [0.29, 0.29],
    [0.71, 0.29],
    [0.29, 0.71],
    [0.71, 0.71],
  ],
  5: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.5, 0.5],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  6: [
    [0.29, 0.24],
    [0.71, 0.24],
    [0.29, 0.5],
    [0.71, 0.5],
    [0.29, 0.76],
    [0.71, 0.76],
  ],
};

/**
 * One die, landed.
 *
 * The face is the thing a player wants to see; the arithmetic underneath it is
 * what they would otherwise have to do in their head. A die that missed stays
 * on the table rather than disappearing, because "I rolled six dice and two
 * hit" is the sentence the screen is trying to make obvious.
 */
function Die({
  roll,
  hit,
  bonus,
  delay,
}: {
  roll: number;
  hit: boolean;
  bonus: number;
  delay: number;
}) {
  const size = 34;
  return (
    <span
      className={cn('descending inline-flex flex-col items-center gap-0.5', !hit && 'opacity-45')}
      style={{ animationDelay: `${delay}ms` }}
    >
      <svg width={size} height={size} viewBox="0 0 1 1" aria-hidden>
        <rect
          x={0.04}
          y={0.04}
          width={0.92}
          height={0.92}
          rx={0.16}
          fill={hit ? '#f6eed8' : '#e0d2ac'}
          stroke={hit ? '#c08a2e' : INK}
          strokeWidth={hit ? 0.07 : 0.035}
        />
        {PIPS[roll]?.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={0.082} fill={INK} />
        ))}
      </svg>
      <span className="text-[10px] tabular-nums opacity-70">
        {roll === 6 ? '6' : `${roll}+${bonus}`}
      </span>
    </span>
  );
}

/**
 * Why an Attack scored what it scored.
 *
 * The whole volley, kept on screen for as long as the hits are still being
 * spent: the Towers that fired first and what each one was committed to, then
 * the Army dice and the Defence they were measured against. It is the one
 * question in `PROTOTYPE_ACCEPTANCE.md` the interface answered in a tooltip.
 */
export function DiceTray({ state }: { state: GameState }) {
  const volley = volleyOf(state);
  if (!volley) return null;

  const name = state.leaders[volley.player]?.name ?? 'Someone';
  const kindOf = (id: string | null) => {
    const host = state.hosts.find((h) => h.id === id);
    return host ? HOST_LABEL[host.kind] : 'a Host';
  };

  return (
    <div className="paper penned pointer-events-none absolute bottom-3 left-1/2 max-w-[92%] -translate-x-1/2 px-3 py-2">
      <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-2">
        {volley.towers.length > 0 && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-medium opacity-70">
              Towers ({volley.towers.length})
            </span>
            <div className="flex items-end gap-1.5">
              {volley.towers.map((shot, i) => (
                <Die
                  key={`t${i}`}
                  roll={shot.roll}
                  hit={shot.hit}
                  bonus={volley.bonus}
                  delay={i * 70}
                />
              ))}
            </div>
            <span className="text-[10px] opacity-60">
              {volley.towers[0]
                ? `at ${kindOf(volley.towers[0].targetId)}, Defence ${volley.towers[0].defence}`
                : ''}
            </span>
          </div>
        )}

        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] font-medium opacity-70">
            {name}'s Army
            {volley.paid && (
              <span className="opacity-70">
                {' '}
                · paid {volley.paid.amount}{' '}
                {RESOURCE_LABEL[volley.paid.resource as keyof typeof RESOURCE_LABEL]}
              </span>
            )}
          </span>
          <div className="flex items-end gap-1.5">
            {volley.army.map((die, i) => (
              <Die
                key={`a${i}`}
                roll={die.roll}
                hit={die.hit}
                bonus={volley.bonus}
                delay={(volley.towers.length + i) * 70}
              />
            ))}
          </div>
          <span className="text-[10px] opacity-60">
            {volley.successes} of {volley.army.length} beat Defence {volley.defence}
          </span>
        </div>
      </div>
    </div>
  );
}
