import { CONFUSION, SCHEMES, STAGE_LABEL, type SchemeId } from '@babel-game/game-data';
import {
  piecesPerStage,
  piecesToNextEscalation,
  totalPieces,
  type GameEvent,
  type GameState,
} from '@babel-game/game-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BUILDING_LABEL, HOST_LABEL, RESOURCE_LABEL, TERRAIN_LABEL } from './theme';

/** GDD §12: pieces built, and how close the next permanent escalation is. */
export function BabelCard({ state }: { state: GameState }) {
  const leaders = state.order.length;
  const built = state.babel.stack.length;
  const total = totalPieces(leaders);
  const toNext = piecesToNextEscalation(state.babel, state.stage, leaders);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Babel · Stage {state.stage}</CardTitle>
        <span className="text-xs tabular-nums opacity-60">
          {built}/{total}
        </span>
      </CardHeader>
      <CardContent>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-wrap gap-0.5">
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-3 flex-1 min-w-1.5 rounded-[2px]',
                    i < built ? 'bg-babel' : 'bg-foreground/10',
                    (i + 1) % piecesPerStage(leaders, state.rules) === 0 && 'ring-1 ring-destructive/70',
                  )}
                />
              ))}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {STAGE_LABEL[state.stage]}.{' '}
            {toNext === null
              ? 'Final Stage — finish Babel to win.'
              : toNext === 0
                ? 'The next piece escalates Heaven permanently.'
                : `${toNext} more piece${toNext === 1 ? '' : 's'} escalates Heaven permanently.`}{' '}
            Marks show Stage boundaries.
          </TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  );
}

/** Human-readable log. Every complex transition emits a structured event. */
export function describe(event: GameEvent, state: GameState): string {
  const who = (id: string) => state.leaders[id]?.name ?? id;
  /* Named from the board where it can be: with five kinds on the map at once,
     "a Host advances" is the one thing a player cannot act on. A Host that has
     since died is no longer there to ask, and stays anonymous. */
  const which = (id: string) => {
    const host = state.hosts.find((h) => h.id === id);
    return host ? HOST_LABEL[host.kind] : 'Host';
  };
  /* Ophanim and Ophanim Host both take "an"; Colossus and Warded do not. */
  const a = (label: string) => `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;
  switch (event.type) {
    case 'roundStarted':
      return `Round ${event.round}`;
    case 'tileDrawn':
      return `${who(event.player)} drew ${TERRAIN_LABEL[event.terrain]}${
        event.river === 'none' ? '' : ` (${event.river})`
      }`;
    case 'tileDiscarded':
      return `${TERRAIN_LABEL[event.terrain]} had nowhere to go — redrawn`;
    case 'tilePlaced':
      return `${who(event.player)} placed ${TERRAIN_LABEL[event.terrain]} at ${event.at.x}, ${event.at.y}`;
    case 'resourcesGained':
      return `${who(event.player)} +${event.amount} ${RESOURCE_LABEL[event.resource]}`;
    case 'payoutSuppressed':
      return event.reason === 'lostLedgers'
        ? `No payout — Lost Ledgers`
        : `No payout — that feature is occupied`;
    case 'harvestTriggered':
      return `Shared industry: ${event.owners.map(who).join(' and ')} paid ${event.amount} ${
        RESOURCE_LABEL[event.resource]
      }`;
    case 'buildingConstructed':
      return `${who(event.player)} built a ${BUILDING_LABEL[event.building]}`;
    case 'babelPieceBuilt':
      return `${who(event.player)} added Babel piece ${event.pieces}`;
    case 'stageEscalated':
      return `Heaven escalates — Stage ${event.to}: ${STAGE_LABEL[event.to]}`;
    case 'bartered':
      return `${who(event.player)} bartered for 1 ${RESOURCE_LABEL[event.gained]}`;
    case 'prestigeGained':
      return `${who(event.player)} +${event.amount} Prestige (${event.source})`;
    case 'actionTaken':
      return `${who(event.player)}: ${event.action}`;
    case 'turnEnded':
      return `${who(event.player)} ends their turn`;
    case 'heavenPhase':
      return `Heaven Phase`;
    case 'beaconPlaced':
      return `Beacon planted at ${event.at.x}, ${event.at.y} — ${event.total} in play`;
    case 'beaconDeferred':
      return `No legal Beacon site yet`;
    case 'hostSpawned':
      return `${HOST_LABEL[event.kind]} descends at ${event.at.x}, ${event.at.y}`;
    case 'hostMoved':
      return `${which(event.id)} advances to ${event.to.x}, ${event.to.y}`;
    case 'babelPieceLost':
      return `Heaven smashes Babel's newest piece — ${event.remaining} left, and the Host is spent`;
    case 'foundationOccupied':
      return `${which(event.hostId)} stands on the bare Foundation`;
    case 'humanityLoses':
      return `The Foundation is breached twice. Humanity falls.`;
    case 'attackRolled':
      return `${who(event.player)} rolls ${event.rolls.join(', ')} vs ${event.defence} — ${
        event.successes
      } hit${event.successes === 1 ? '' : 's'}${
        event.paid ? ` (${event.paid.amount} ${event.paid.resource})` : ''
      }`;
    case 'hostHit':
      return event.shieldBroken
        ? `${who(event.player)} shatters a Seraph's shield`
        : `${who(event.player)} hits ${a(which(event.id))}`;
    case 'hostKilled':
      return `${who(event.player)} destroys ${a(HOST_LABEL[event.kind])}`;
    case 'mustered':
      return `${who(event.player)} musters — Army ${event.army}`;
    case 'wallsBuilt':
      return `${who(event.player)} raises ${event.edges.length} Wall segment${
        event.edges.length === 1 ? '' : 's'
      }`;
    case 'wallBroken':
      return `${which(event.hostId)} smashes a Wall down, and spends its movement`;
    case 'towerSupport':
      return `Tower fires — ${event.roll} + 2 vs ${event.defence}, ${event.hit ? 'hit' : 'miss'}`;
    case 'confusionRevealed':
      return `Confusion: ${CONFUSION[event.card].label}`;
    case 'confusionCancelled':
      return `${who(event.player)} cancels ${CONFUSION[event.card].label}`;
    case 'confusionAdded':
      return `Heaven grows stranger: ${event.cards.map((c) => CONFUSION[c].label).join(', ')}`;
    case 'schemeBought':
      return `${who(event.player)} buys a Scheme`;
    case 'schemePlayed':
      return `${who(event.player)} plays ${SCHEMES[event.scheme].label}`;
    case 'schemeDeckEmpty':
      return `No Schemes remain`;
    case 'buildingRazed':
      return `A Colossus pulls down ${who(event.owner)}'s ${BUILDING_LABEL[event.building]}`;
    case 'hostSplit':
      return `The Swarm breaks apart — ${event.into.length} more take its place`;
    case 'reserveSwapped':
      return `${who(event.player)} takes ${TERRAIN_LABEL[event.took.terrain]} from the Reserve, leaving ${TERRAIN_LABEL[event.gave.terrain]}`;
    case 'resourcesSpoiled':
      return `${who(event.player)} loses ${Object.entries(event.lost)
        .map(([r, n]) => `${n} ${RESOURCE_LABEL[r as keyof typeof RESOURCE_LABEL]}`)
        .join(', ')} — over the limit`;
    case 'upkeepPaid':
      return event.diceLost > 0
        ? `${who(event.player)} cannot feed their Army — ${event.diceLost} die${
            event.diceLost === 1 ? '' : 's'
          } lost`
        : `${who(event.player)} feeds their Army (${event.food} Food)`;
    case 'reserveRefreshed':
      return event.reason === 'dead'
        ? `A Reserve tile had nowhere left to go — replaced`
        : `The Reserve is laid out`;
    case 'voteOpened':
      return `Vote: ${event.question}`;
    case 'voteCast':
      return `${who(event.player)} voted`;
    case 'voteResolved':
      return `Vote resolved: ${event.choice}${event.byCoinFlip ? ' (coin flip)' : ''}`;
    case 'humanityWins':
      return `Babel is complete. Humanity survives.`;
  }
}

export function LogList({ state, limit = 400 }: { state: GameState; limit?: number }) {
  const recent = [...state.log].slice(-limit).reverse();
  return (
    <ol className="space-y-px text-xs">
      {recent.map((event, i) => (
        <li
          key={recent.length - i}
          className={cn(
            'border-border/60 border-t px-0.5 py-1 first:border-t-0',
            event.type === 'roundStarted' && 'text-foreground font-semibold',
            event.type === 'humanityLoses' && 'text-destructive font-semibold',
            event.type === 'stageEscalated' && 'text-destructive font-medium',
          )}
        >
          {describe(event, state)}
        </li>
      ))}
    </ol>
  );
}

export function LogCard({ state }: { state: GameState }) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <CardTitle>Log</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 pb-2">
        <ScrollArea className="h-full pr-2">
          <LogList state={state} limit={80} />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/**
 * A Scheme, as the card it is.
 *
 * Every window that offers one used to be a sentence and two buttons —
 * "Ada holds Frenzied Works · Play it · End turn" — with the effect hidden
 * behind a hover that phones cannot perform. You were being asked to spend a
 * card without being told what it did. Now you are holding it.
 */
export function SchemeCard({ scheme }: { scheme: SchemeId }) {
  const spec = SCHEMES[scheme];
  return (
    <div className="paper penned-alt max-w-[19rem] min-w-0 px-3 py-1.5">
      <div className="text-[10px] tracking-wide uppercase opacity-50">Scheme</div>
      <div className="font-scrawl text-xl leading-none font-bold">{spec.label}</div>
      <div className="mt-1 text-xs opacity-80">{spec.text}</div>
    </div>
  );
}
