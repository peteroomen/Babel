import { CONFUSION } from '@babel-game/game-data';
import { activeConfusion, type GameState } from '@babel-game/game-core';
import { cn } from '@/lib/utils';

/**
 * The card in force, for the whole round, at every width.
 *
 * It used to live in the right-hand rail, and the rail is `hidden xl:flex` —
 * so on anything smaller than a desktop the rule change governing the round
 * was behind a button. The last full playthrough lost a whole round to it.
 *
 * A band rather than a badge in the header, because the effect has to be
 * readable without a click and a sentence does not fit in a badge.
 */
export function ConfusionBanner({ state }: { state: GameState }) {
  const card = state.confusion.card;
  if (!card) return null;

  const spec = CONFUSION[card];
  const cancelled = activeConfusion(state) === null;
  const by = state.confusion.cancelledBy;

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b px-3 py-1',
        cancelled ? 'bg-secondary/40' : 'bg-accent/15',
      )}
    >
      <span className="text-[10px] tracking-wide uppercase opacity-55">Confusion</span>
      <span className={cn('font-scrawl text-xl leading-none font-bold', cancelled && 'line-through opacity-50')}>
        {spec.label}
      </span>
      <span className={cn('min-w-0 text-xs opacity-75', cancelled && 'line-through opacity-40')}>
        {spec.text}
      </span>
      {cancelled && (
        <span className="text-[11px] font-medium opacity-70">
          — cancelled{by ? ` by ${state.leaders[by]?.name ?? by}` : ''}
        </span>
      )}
    </div>
  );
}
