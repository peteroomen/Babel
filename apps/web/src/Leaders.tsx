import { RESOURCE_TYPES } from '@babel-game/game-data';
import type { GameState, PlayerId } from '@babel-game/game-core';
import { ARCHETYPE_LABEL, type AiSeats } from '@babel-game/game-ai';
import { cn } from '@/lib/utils';
import { LEADER_COLOUR, RESOURCE_LABEL } from './theme';

/**
 * A Leader, drawn the way the rest of the board is: ink on paper.
 *
 * There is no portrait art and inventing some would be a different project, so
 * this is the next most useful thing — a hand-inked disc in the seat's own
 * colour, which is the same colour their buildings carry on the map. The
 * initial is there to be recognised at a glance rather than read.
 */
function Portrait({ name, seat, active }: { name: string; seat: number; active: boolean }) {
  const colour = LEADER_COLOUR[seat % LEADER_COLOUR.length];
  return (
    <span
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full border-2 transition-transform',
        active ? 'scale-110' : 'opacity-80',
      )}
      style={{ background: colour, borderColor: active ? 'var(--ochre)' : 'var(--ink-line)' }}
      aria-hidden
    >
      <span className="font-scrawl text-lg leading-none font-bold text-[#fffdf8]">
        {name.charAt(0)}
      </span>
    </span>
  );
}

/**
 * One count, in the smallest space that still reads.
 *
 * Four Leaders on a phone leaves about a hundred pixels each, which is not
 * enough for "0 Prestige · 1 Army die" — it used to spill into the next
 * Leader's cell. Everything a Leader has is therefore one uniform chip: a mark
 * and a number, in a row you can compare straight down the table.
 */
function Chip({
  mark,
  count,
  label,
  tone,
}: {
  mark: string;
  count: number;
  label: string;
  tone?: 'plain' | 'note';
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-center gap-0.5 rounded border px-1 py-px text-[11px]',
        tone === 'note'
          ? 'bg-secondary/70 border-foreground/15'
          : count > 0
            ? 'bg-card'
            : 'bg-secondary/40 opacity-45',
      )}
      title={label}
      aria-label={`${count} ${label}`}
    >
      <span className="text-[9px] opacity-55">{mark}</span>
      <span className="font-medium tabular-nums">{count}</span>
    </div>
  );
}

/**
 * Everyone at the table, across the top of the map.
 *
 * This used to live only in the right-hand rail, which is `hidden xl:flex` —
 * so on a phone nobody's resources, Prestige or Army were visible at all, in a
 * game whose whole first question is "can I afford that, and can they?".
 * Above the map it is there at every width, and whose turn it is stops being
 * something you infer from the action bar.
 */
export function LeaderStrip({
  state,
  active,
  seats,
}: {
  state: GameState;
  active: PlayerId;
  seats: AiSeats;
}) {
  const built = (id: PlayerId) =>
    Object.values(state.buildings).filter((b) => b.owner === id).length;

  return (
    <div className="flex shrink-0 items-stretch gap-1.5 border-b px-2 py-1.5">
      {state.order.map((id, seat) => {
        const leader = state.leaders[id];
        if (!leader) return null;
        const isActive = id === active;
        return (
          <div
            key={id}
            className={cn(
              'min-w-0 flex-1 rounded-lg border px-1.5 py-1 transition-colors',
              isActive
                ? 'bg-papyrus-light border-foreground/30 ring-ring/70 ring-2'
                : 'bg-card/40 border-transparent',
            )}
          >
            <div className="flex items-center gap-1.5">
              <Portrait name={leader.name} seat={seat} active={isActive} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn('truncate text-xs', isActive ? 'font-bold' : 'font-medium')}
                  >
                    {leader.name}
                  </span>
                  {/* The words are the first thing to go: at four Leaders on a
                      phone they pushed the name out of its own cell. The lit
                      cell and the ringed portrait say the same thing and cost
                      no width. */}
                  {isActive && (
                    <span className="hidden text-[9px] tracking-wide whitespace-nowrap uppercase opacity-60 sm:inline">
                      to play
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  <Chip mark="★" count={leader.prestige} label="Prestige" tone="note" />
                  <Chip mark="d" count={leader.army} label="Army dice" tone="note" />
                </div>
              </div>
            </div>

            <div className="mt-1 grid grid-cols-4 gap-0.5">
              {RESOURCE_TYPES.map((resource) => (
                <Chip
                  key={resource}
                  mark={RESOURCE_LABEL[resource].charAt(0)}
                  count={leader.resources[resource]}
                  label={RESOURCE_LABEL[resource]}
                />
              ))}
            </div>

            {/* Secondary, and the first thing to go when the screen is narrow. */}
            <div className="text-muted-foreground mt-0.5 hidden items-center gap-2 text-[10px] sm:flex">
              <span>{built(id)} built</span>
              {leader.schemeHand.length > 0 && (
                <span>
                  {leader.schemeHand.length} Scheme{leader.schemeHand.length === 1 ? '' : 's'}
                </span>
              )}
              {seats[id] && <span className="truncate">{ARCHETYPE_LABEL[seats[id]]}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
