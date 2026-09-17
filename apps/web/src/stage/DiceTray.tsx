import { useRef, useState } from 'react';
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
 * Where each number lives on the cube, and how to turn it to the front.
 *
 * Opposite faces sum to seven, as they do on any die you have held: 1 against
 * 6, 2 against 5, 3 against 4. `show` is the orientation of the whole cube
 * that brings that face to the camera, which is what a roll has to land on.
 */
const FACES = [
  { pip: 1, place: 'translateZ(var(--half))', show: [0, 0] },
  { pip: 6, place: 'rotateY(180deg) translateZ(var(--half))', show: [0, 180] },
  { pip: 3, place: 'rotateY(90deg) translateZ(var(--half))', show: [0, -90] },
  { pip: 4, place: 'rotateY(-90deg) translateZ(var(--half))', show: [0, 90] },
  { pip: 2, place: 'rotateX(90deg) translateZ(var(--half))', show: [-90, 0] },
  { pip: 5, place: 'rotateX(-90deg) translateZ(var(--half))', show: [90, 0] },
] as const;

const SIZE = 36;

/**
 * One die, tumbling to a stop on the face it rolled.
 *
 * The number of turns it takes to get there is derived from the die's own
 * position and face rather than from `Math.random`, so a given volley always
 * rolls the same way it rolled — the same courtesy the rules pay by drawing
 * every die from a seeded generator.
 *
 * A die that missed stays on the table rather than disappearing, because "I
 * rolled six dice and two hit" is the sentence the screen is trying to make
 * obvious.
 */
function Die({
  roll,
  hit,
  bonus,
  index,
  delay,
  spent,
  onDrag,
}: {
  roll: number;
  hit: boolean;
  bonus: number;
  index: number;
  delay: number;
  /** A success that has already been given to a Host. */
  spent?: boolean;
  /** Called while this die is being carried, and once when it is let go. */
  onDrag?: (at: { x: number; y: number } | null) => void;
}) {
  const landing = FACES.find((face) => face.pip === roll) ?? FACES[0];
  const [rx, ry] = landing.show;
  /* Two to four whole turns each way, varied per die so a handful of them do
     not tumble in lockstep. */
  const spinX = 360 * (2 + ((index + roll) % 3));
  const spinY = 360 * (2 + ((index * 2 + roll) % 3));

  const carry = (event: React.PointerEvent) => {
    if (!onDrag) return;
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    onDrag({ x: event.clientX, y: event.clientY });
  };

  return (
    <span
      className={cn(
        'inline-flex flex-col items-center gap-1',
        !hit && 'opacity-45',
        spent && 'opacity-30 saturate-0',
        onDrag && 'pointer-events-auto cursor-grab touch-none active:cursor-grabbing',
      )}
      onPointerDown={carry}
      onPointerMove={(event) => {
        if (!onDrag || event.buttons === 0) return;
        onDrag({ x: event.clientX, y: event.clientY });
      }}
      onPointerUp={() => onDrag?.(null)}
      onPointerCancel={() => onDrag?.(null)}
    >
      <span
        className="inline-block"
        style={{ width: SIZE, height: SIZE, perspective: `${SIZE * 16}px` }}
      >
        <span
          className="die tumbling block size-full"
          style={{
            ['--half' as string]: `${SIZE / 2}px`,
            ['--rx' as string]: `${rx}deg`,
            ['--ry' as string]: `${ry}deg`,
            ['--spin-x' as string]: `${spinX}deg`,
            ['--spin-y' as string]: `${spinY}deg`,
            animationDelay: `${delay}ms`,
          }}
          aria-label={`rolled ${roll}`}
        >
          {FACES.map((face) => (
            <span
              key={face.pip}
              className="die-face"
              style={{
                transform: face.place,
                background: hit ? '#f6eed8' : '#e0d2ac',
                border: `${hit ? 2 : 1}px solid ${hit ? '#c08a2e' : INK}`,
              }}
            >
              <svg width={SIZE * 0.8} height={SIZE * 0.8} viewBox="0 0 1 1" aria-hidden>
                {PIPS[face.pip]?.map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r={0.088} fill={INK} />
                ))}
              </svg>
            </span>
          ))}
        </span>
      </span>
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
export function DiceTray({
  state,
  hits,
  onAssign,
}: {
  state: GameState;
  /** Hits already placed, by Host. */
  hits?: Readonly<Record<string, number>>;
  /** A die was let go over a Host. Returns false if it would not land. */
  onAssign?: (hostId: string, roll: number) => boolean;
}) {
  /* Which die is in the air, and where the hand is. */
  const [carried, setCarried] = useState<{ index: number; x: number; y: number } | null>(null);
  const at = useRef<{ x: number; y: number } | null>(null);
  const volley = volleyOf(state);
  if (!volley) return null;

  const spent = Object.values(hits ?? {}).reduce((sum, n) => sum + n, 0);
  const name = state.leaders[volley.player]?.name ?? 'Someone';

  /**
   * Carrying a die, and letting it go.
   *
   * On release the Host is whatever is under the hand — read from the document
   * rather than tracked, so the board stays the thing being dropped onto
   * rather than having to know it is a drop target. A die that would not beat
   * that Host's Defence simply does not land, and says so by coming back.
   */
  const carrying = (index: number, roll: number) => (to: { x: number; y: number } | null) => {
    if (to) {
      at.current = to;
      setCarried({ index, x: to.x, y: to.y });
      return;
    }
    const spot = at.current;
    at.current = null;
    setCarried(null);
    if (!spot || !onAssign) return;
    const under = document.elementFromPoint(spot.x, spot.y);
    const host = under?.closest('[data-host-id]')?.getAttribute('data-host-id');
    if (host) onAssign(host, roll);
  };
  const kindOf = (id: string | null) => {
    const host = state.hosts.find((h) => h.id === id);
    return host ? HOST_LABEL[host.kind] : 'a Host';
  };

  const inHand = carried ? volley.army[carried.index - volley.towers.length] : null;

  return (
    <>
      {inHand && carried && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
          style={{ left: carried.x, top: carried.y }}
        >
          <Die roll={inHand.roll} hit bonus={volley.bonus} index={0} delay={0} />
        </div>
      )}
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
                  index={i}
                  delay={i * 90}
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
            {volley.army.map((die, i) => {
              /* Successes are spent oldest first, so the ones still in play
                 are the last few — which is also the order a hand would take
                 them off the table in. */
              const rank = volley.army.slice(0, i).filter((d) => d.hit).length;
              const used = die.hit && rank < spent;
              return (
                <Die
                  key={`a${i}`}
                  roll={die.roll}
                  hit={die.hit}
                  bonus={volley.bonus}
                  index={volley.towers.length + i}
                  delay={(volley.towers.length + i) * 90}
                  spent={used}
                  {...(die.hit && !used && onAssign
                    ? { onDrag: carrying(volley.towers.length + i, die.roll) }
                    : {})}
                />
              );
            })}
          </div>
          <span className="text-[10px] opacity-60">
            {volley.successes} of {volley.army.length} beat Defence {volley.defence}
            {onAssign && volley.successes > spent && ' · drag one onto a Host'}
          </span>
        </div>
        </div>
      </div>
    </>
  );
}
