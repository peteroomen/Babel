import { CONFUSION, SCHEMES, STAGE_LABEL } from '@babel-game/game-data';
import type { GameState } from '@babel-game/game-core';
import type { Spotlight } from '@babel-game/stagecraft';

type Card = {
  readonly over: string;
  readonly title: string;
  readonly body: string;
  readonly grave: boolean;
};

/** What a moment announces itself as, or null if it announces nothing. */
function cardFor(spot: Spotlight, state: GameState): Card | null {
  const event = spot.cause;
  switch (event.type) {
    case 'confusionRevealed':
      return {
        over: 'Confusion',
        title: CONFUSION[event.card].label,
        body: CONFUSION[event.card].text,
        grave: true,
      };
    case 'confusionCancelled':
      return {
        over: `${state.leaders[event.player]?.name ?? 'Someone'} plays Common Tongue`,
        title: CONFUSION[event.card].label,
        body: 'Cancelled for the round.',
        grave: false,
      };
    case 'stageEscalated':
      return {
        over: 'Heaven escalates, permanently',
        title: `Stage ${event.to}`,
        body: STAGE_LABEL[event.to],
        grave: true,
      };
    case 'schemePlayed':
      return {
        over: `${state.leaders[event.player]?.name ?? 'Someone'} plays`,
        title: SCHEMES[event.scheme].label,
        body: SCHEMES[event.scheme].text,
        grave: false,
      };
    case 'beaconPlaced':
      return {
        over: 'A Beacon opens',
        title: `${event.at.x}, ${event.at.y}`,
        body: `Heaven now has ${event.total} way${event.total === 1 ? '' : 's'} into the world.`,
        grave: true,
      };
    case 'humanityWins':
      return {
        over: 'Babel is complete',
        title: 'Humanity survives',
        body: 'Only now does Prestige decide anything.',
        grave: false,
      };
    default:
      return null;
  }
}

/**
 * The card that turns over.
 *
 * Milestone 7: the announcement is the thing that was missing, not the
 * information — a whole round's rule change could pass unnoticed because it
 * only ever appeared as a line in a panel. So this introduces it, and the
 * banner underneath the header keeps it.
 *
 * It never holds anything a player then needs: by the time this fades, what it
 * said is somewhere permanent.
 */
export function Announce({
  spot,
  state,
  ms,
}: {
  spot: Spotlight | null;
  state: GameState;
  ms: number;
}) {
  const card = spot ? cardFor(spot, state) : null;
  if (!card) return null;

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div
        key={`${spot!.cause.type}-${card.title}`}
        className="turning paper penned max-w-[22rem] px-6 py-5 text-center"
        style={{
          animationDuration: `${ms}ms`,
          ['--paper-fill' as string]: card.grave ? '#efe0be' : '#f6eed8',
        }}
      >
        <div className="text-[11px] tracking-wide uppercase opacity-55">{card.over}</div>
        <div className="font-scrawl text-3xl leading-tight font-bold">{card.title}</div>
        <div className="mt-1 text-sm opacity-80">{card.body}</div>
      </div>
    </div>
  );
}
