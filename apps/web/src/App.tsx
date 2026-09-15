/**
 * BABEL — one screen, no page scrolling.
 *
 * The board takes whatever space is left; everything else lives in a fixed
 * header, a fixed rail and a contextual action bar at the bottom. All legality
 * questions go to `game-core`; nothing here reimplements a rule.
 */
import { useMemo, useState } from 'react';
import {
  CONFUSION,
  RESOURCE_TYPES,
  SCHEMES,
  type BuildingType,
  type ResourceType,
} from '@babel-game/game-data';
import {
  applyMove,
  coordKey,
  currentPlayer,
  getLegalActions,
  getLegalTilePlacements,
  hitsRemaining,
  isPassableAt,
  neighbours,
  previewPlacement,
  setupGame,
  type Command,
  type Coord,
  type GameState,
  type Rotation,
} from '@babel-game/game-core';
import { BookOpenIcon, PanelRightIcon, RotateCcwIcon, ScrollTextIcon } from 'lucide-react';
import { Board } from './Board';
import { PaperFx } from './PaperFx';
import { BabelCard, ConfusionCard, LeaderRow, LogCard, LogList } from './Panels';
import { ActionButtons, Act } from './ActionBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HOST_LABEL, RESOURCE_LABEL, TERRAIN_LABEL } from './theme';

const NAMES = ['Ada', 'Peter', 'Rook', 'Vex'];

type Mode =
  | { kind: 'idle' }
  | { kind: 'build' }
  | { kind: 'tower' }
  | { kind: 'walls' }
  | { kind: 'barter' }
  | { kind: 'prophet'; hostId: string | null };

export function App() {
  const [leaderCount, setLeaderCount] = useState(2);
  const [state, setState] = useState<GameState>(() => setupGame(NAMES.slice(0, 2), 'babel-1'));
  const [selected, setSelected] = useState<Coord | null>(null);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [spend, setSpend] = useState<ResourceType[]>([]);
  const [hits, setHits] = useState<Record<string, number>>({});
  const [wallPicks, setWallPicks] = useState<Coord extends never ? never : { a: Coord; b: Coord }[]>(
    [],
  );

  const options = useMemo(
    () => (state.drawnTile ? getLegalTilePlacements(state.board, state.drawnTile) : []),
    [state.board, state.drawnTile],
  );
  const active = currentPlayer(state);
  const leader = state.leaders[active];
  const legal = useMemo(() => getLegalActions(state, active), [state, active]);

  const selectedOption = selected
    ? options.find((o) => coordKey(o.at) === coordKey(selected))
    : undefined;
  const rotation: Rotation =
    selectedOption?.rotations[rotationIndex % selectedOption.rotations.length] ?? 0;
  const preview =
    selectedOption && state.drawnTile
      ? previewPlacement(state, selectedOption.at, state.drawnTile, rotation)
      : null;

  const buildAction = legal.find((a) => a.type === 'buildHarvester');
  const towerAction = legal.find((a) => a.type === 'buildTower');
  const wallsAction = legal.find((a) => a.type === 'buildWalls');

  const reset = () => {
    setSelected(null);
    setRotationIndex(0);
    setMode({ kind: 'idle' });
    setSpend([]);
    setHits({});
    setWallPicks([]);
  };
  const dispatch = (command: Command) => {
    setState(applyMove(state, command).state);
    reset();
  };
  const restart = (count: number) => {
    setLeaderCount(count);
    setState(setupGame(NAMES.slice(0, count), `babel-${Date.now()}`));
    reset();
  };

  const assigned = Object.values(hits).reduce((sum, n) => sum + n, 0);
  const successes = state.pendingAttack?.successes ?? 0;
  const tapHost = (id: string) => {
    const host = state.hosts.find((h) => h.id === id);
    if (!host) return;
    setHits((current) => {
      const now = current[id] ?? 0;
      const max = Math.min(hitsRemaining(host), successes - assigned + now);
      return { ...current, [id]: now >= max ? 0 : now + 1 };
    });
  };

  const rail = (
    <>
      <BabelCard state={state} />
      <ConfusionCard state={state} />
      <div className="grid gap-1.5">
        {state.order.map((id, seat) => (
          <LeaderRow
            key={id}
            leader={state.leaders[id]!}
            isActive={id === active}
            seat={seat}
            buildings={Object.values(state.buildings).filter((b) => b.owner === id).length}
          />
        ))}
      </div>
      <LogCard state={state} />
    </>
  );

  return (
    <TooltipProvider>
      <PaperFx />
      <div className="flex h-full flex-col overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="bg-papyrus-light/60 flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <span className="font-scrawl text-3xl leading-none font-bold tracking-tight">
            BABEL
          </span>
          <Badge variant="secondary" className="tabular-nums">
            R{state.round}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary">Stage {state.stage}</Badge>
            </TooltipTrigger>
            <TooltipContent>
              Babel's permanent difficulty Stage. It never goes back down.
            </TooltipContent>
          </Tooltip>
          {state.hosts.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="tabular-nums">
                  {state.hosts.length} Host{state.hosts.length === 1 ? '' : 's'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Heavenly forces on the board, advancing on Babel.</TooltipContent>
            </Tooltip>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Dialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="How to play">
                      <BookOpenIcon />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>How to play</TooltipContent>
              </Tooltip>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>How to play</DialogTitle>
                  <DialogDescription>
                    Build Babel to reach Heaven and kill a tyrannical God. Everyone survives
                    together, or nobody does.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-3">
                  <div className="space-y-3 text-sm">
                    <p>
                      <strong>Your turn:</strong> draw a tile, place it, take exactly one action.
                      A tile pays 1 resource plus 1 for each adjacent tile of the same terrain.
                    </p>
                    <p>
                      <strong>Shared industry:</strong> when you expand a feature where another
                      Leader owns a matching building, they get paid the same as you — and you get
                      +1 on top. Cooperation is the fastest economy.
                    </p>
                    <p>
                      <strong>Heaven:</strong> Beacons spawn Hosts, which walk the shortest land
                      route to Babel. Rivers block them permanently. A Host anywhere in a feature
                      shuts down that whole feature's economy.
                    </p>
                    <p>
                      <strong>Losing:</strong> a Host reaching Babel knocks off its newest piece.
                      With Babel at zero, the first Host occupies the Foundation and the second
                      one ends the game for everybody.
                    </p>
                    <p>
                      <strong>Winning:</strong> finish Babel. Then the most Prestige wins — but
                      only if humanity survived. Prestige on a dead world counts for nothing.
                    </p>
                    <p className="text-muted-foreground">
                      Everything else explains itself: hover any button or badge.
                    </p>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            <Dialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Full log">
                      <ScrollTextIcon />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Full history</TooltipContent>
              </Tooltip>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Game log</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-3">
                  <LogList state={state} />
                </ScrollArea>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Status">
                  <PanelRightIcon />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="gap-2">
                <SheetTitle>Status</SheetTitle>
                <div className="flex min-h-0 flex-1 flex-col gap-2">{rail}</div>
              </SheetContent>
            </Sheet>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="New game" onClick={() => restart(leaderCount)}>
                  <RotateCcwIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New game</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex overflow-hidden rounded-md border">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => restart(n)}
                      className={`h-8 w-7 text-xs tabular-nums transition-colors ${
                        n === leaderCount ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </TooltipTrigger>
              <TooltipContent>Leaders — starts a new game</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ── Board + rail ───────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 p-2">
            <Board
              className="size-full"
              state={state}
              selected={selected}
              rotation={rotation}
              onSelect={(at) => {
                setSelected(at);
                setRotationIndex(0);
              }}
              buildSites={
                mode.kind === 'build' && buildAction
                  ? buildAction.sites.map((s) => s.at)
                  : mode.kind === 'tower' && towerAction
                    ? towerAction.sites
                    : []
              }
              onBuildSite={(at) => {
                if (mode.kind === 'tower') {
                  dispatch({ type: 'buildTower', player: active, at });
                  return;
                }
                const site = buildAction?.sites.find((s) => coordKey(s.at) === coordKey(at));
                if (site) {
                  dispatch({
                    type: 'buildHarvester',
                    player: active,
                    at: site.at,
                    building: site.type as BuildingType,
                  });
                }
              }}
              wallEdges={mode.kind === 'walls' && wallsAction ? wallsAction.edges : []}
              onWallEdge={
                mode.kind === 'walls'
                  ? (edge) =>
                      setWallPicks((picks) => {
                        const key = `${edge.a.x},${edge.a.y}|${edge.b.x},${edge.b.y}`;
                        const has = picks.some(
                          (p) => `${p.a.x},${p.a.y}|${p.b.x},${p.b.y}` === key,
                        );
                        if (has) {
                          return picks.filter(
                            (p) => `${p.a.x},${p.a.y}|${p.b.x},${p.b.y}` !== key,
                          );
                        }
                        const cap = wallsAction?.segments ?? 2;
                        return picks.length >= cap ? picks : [...picks, edge];
                      })
                  : undefined
              }
              chosenWalls={wallPicks.map((p) => `${p.a.x},${p.a.y}|${p.b.x},${p.b.y}`)}
              beaconSites={state.pendingBeacon?.sites ?? []}
              onBeaconSite={(at) => dispatch({ type: 'placeBeacon', player: active, at })}
              onHost={state.pendingAttack ? tapHost : undefined}
              selectedHosts={hits}
            />
          </main>

          <aside className="hidden w-[19rem] shrink-0 flex-col gap-2 border-l p-2 xl:flex">
            {rail}
          </aside>
        </div>

        {/* ── Action bar ─────────────────────────────────────────── */}
        <footer className="bg-papyrus-light/70 min-h-14 shrink-0 border-t px-3 py-2">
          {state.phase === 'gameOver' ? (
            <div className="flex items-center gap-3">
              <span className="font-semibold">
                {state.lossReason
                  ? 'Heaven breaches the Foundation. Humanity falls.'
                  : 'Babel is complete. Humanity survives.'}
              </span>
              <span className="text-muted-foreground text-sm">
                {state.lossReason
                  ? 'Nobody is remembered.'
                  : state.winner
                    ? `${state.leaders[state.winner]?.name} is remembered as its greatest hero.`
                    : 'Prestige is tied.'}
              </span>
              <Button size="sm" className="ml-auto" onClick={() => restart(leaderCount)}>
                New game
              </Button>
            </div>
          ) : state.pendingBeacon ? (
            <Bar
              title="Where does Heaven land?"
              hint={`${state.pendingBeacon.sites.length} legal frontier tiles are lit. Every Beacon spawns a Host each Heaven Phase, for the rest of the game.`}
            />
          ) : state.phase === 'confusion' && state.confusion.card ? (
            <Bar title={`${CONFUSION[state.confusion.card].label} revealed`} hint={CONFUSION[state.confusion.card].text}>
              {state.order
                .filter((id) => state.leaders[id]?.schemeHand.includes('common-tongue'))
                .map((id) => (
                  <Act
                    key={id}
                    label={`${state.leaders[id]?.name}: Common Tongue`}
                    variant="accent"
                    hint="Cancel this Confusion for the round."
                    onClick={() =>
                      dispatch({ type: 'playScheme', player: id, scheme: 'common-tongue' })
                    }
                  />
                ))}
              <Act
                label="Let it stand"
                hint="Begin the round under this Confusion."
                onClick={() => dispatch({ type: 'beginRound', player: active })}
              />
            </Bar>
          ) : state.bonusWindow ? (
            <Bar
              title={`${state.leaders[state.bonusWindow]?.name} holds Frenzied Works`}
              hint={SCHEMES['frenzied-works'].text}
            >
              <Act
                label="Play it"
                variant="accent"
                hint="Take one more action now. It cannot buy a Scheme."
                onClick={() =>
                  dispatch({
                    type: 'playScheme',
                    player: state.bonusWindow as string,
                    scheme: 'frenzied-works',
                  })
                }
              />
              <Act
                label="End turn"
                hint="Keep the card for later."
                onClick={() => dispatch({ type: 'endTurn', player: state.bonusWindow as string })}
              />
            </Bar>
          ) : state.phase === 'heaven' ? (
            <Bar
              title={`Heaven Phase · round ${state.round}`}
              hint={
                state.hosts.length === 0
                  ? 'Nothing stirs yet.'
                  : `${state.hosts.length} Host${state.hosts.length === 1 ? '' : 's'} advance, then every Beacon spawns another.`
              }
            >
              {mode.kind === 'prophet' ? (
                <ProphetPicker state={state} mode={mode} setMode={setMode} dispatch={dispatch} />
              ) : (
                <>
                  <Act
                    label="Resolve Heaven"
                    variant="default"
                    hint="Hosts move, strike Babel, then Beacons spawn."
                    onClick={() => dispatch({ type: 'resolveHeaven', player: active })}
                  />
                  {!state.falseProphet &&
                    state.order.some((id) =>
                      state.leaders[id]?.schemeHand.includes('false-prophet'),
                    ) && (
                      <Act
                        label="False Prophet"
                        variant="accent"
                        hint="Send one Host to any adjacent tile instead — sideways, or away from Babel."
                        onClick={() => setMode({ kind: 'prophet', hostId: null })}
                      />
                    )}
                  {state.falseProphet && (
                    <span className="text-muted-foreground text-sm">A Host has been misled.</span>
                  )}
                </>
              )}
            </Bar>
          ) : state.pendingAttack ? (
            <Bar
              title={`${assigned}/${successes} hits assigned`}
              hint={`Rolled ${state.pendingAttack.rolls.join(', ')} vs Defence ${state.pendingAttack.defence}. A Seraph needs two — the first breaks its shield.`}
            >
              {state.hosts.map((host) => (
                <Act
                  key={host.id}
                  label={`${HOST_LABEL[host.kind]} ${host.at.x},${host.at.y}${
                    hits[host.id] ? ` ·${hits[host.id]}` : ''
                  }`}
                  variant={hits[host.id] ? 'default' : 'outline'}
                  hint={
                    host.kind === 'seraph' && host.shieldUp
                      ? 'Shielded: two hits to kill.'
                      : 'One hit kills it.'
                  }
                  onClick={() => tapHost(host.id)}
                />
              ))}
              <Act
                label="Confirm"
                variant="accent"
                hint="Apply the hits and end your turn."
                onClick={() => dispatch({ type: 'assignHits', player: active, assignments: hits })}
              />
            </Bar>
          ) : state.turnStep === 'place' && state.drawnTile ? (
            <Bar
              title={
                <>
                  <span className="font-semibold">{leader?.name}</span> drew{' '}
                  <span className="font-semibold">{TERRAIN_LABEL[state.drawnTile.terrain]}</span>
                  {state.drawnTile.river !== 'none' && ` · ${state.drawnTile.river} river`}
                </>
              }
              hint={
                selectedOption
                  ? 'Confirm, or rotate to fit the river.'
                  : `${options.length} legal squares. Rivers must meet rivers.`
              }
            >
              {!selectedOption && (
                <span className="text-muted-foreground text-sm">
                  Click a highlighted square · {options.length} legal
                </span>
              )}
              {selectedOption && (
                <>
                  <Badge variant={preview ? 'default' : 'muted'}>
                    {preview
                      ? `+${preview.amount} ${RESOURCE_LABEL[preview.resource]}`
                      : state.drawnTile.terrain === 'desert'
                        ? 'no payout'
                        : 'occupied'}
                  </Badge>
                  {selectedOption.rotations.length > 1 && (
                    <Act
                      label={`Rotate ${(rotationIndex % selectedOption.rotations.length) + 1}/${selectedOption.rotations.length}`}
                      hint="Turn the tile so its river edges line up."
                      onClick={() => setRotationIndex((r) => r + 1)}
                    />
                  )}
                  <Act
                    label="Place"
                    variant="accent"
                    hint="Commit the tile and take the payout."
                    onClick={() =>
                      dispatch({
                        type: 'placeTile',
                        player: active,
                        at: selectedOption.at,
                        rotation,
                      })
                    }
                  />
                  <Act label="Cancel" variant="ghost" hint="Pick a different square." onClick={() => setSelected(null)} />
                </>
              )}
            </Bar>
          ) : mode.kind === 'build' || mode.kind === 'tower' ? (
            <Bar
              title={mode.kind === 'tower' ? 'Choose a Tower site' : 'Choose a building site'}
              hint="Highlighted tiles on the board are legal."
            >
              <Act label="Cancel" variant="ghost" hint="Back to your actions." onClick={reset} />
            </Bar>
          ) : mode.kind === 'walls' && wallsAction ? (
            <Bar
              title={`Walls · ${wallPicks.length}/${wallsAction.segments}`}
              hint="Click the edges between tiles. A Host crossing one destroys it and loses its movement."
            >
              <Act
                label="Build walls"
                variant="accent"
                disabled={wallPicks.length === 0}
                hint="Raise the chosen segments."
                onClick={() => dispatch({ type: 'buildWalls', player: active, edges: wallPicks })}
              />
              <Act label="Cancel" variant="ghost" hint="Back to your actions." onClick={reset} />
            </Bar>
          ) : mode.kind === 'barter' && leader ? (
            <Bar title={`Barter · ${spend.length}/3`} hint="Discard any three cards for one of your choice.">
              {RESOURCE_TYPES.map((resource) => {
                const held = leader.resources[resource] - spend.filter((s) => s === resource).length;
                return (
                  <Act
                    key={resource}
                    label={`${RESOURCE_LABEL[resource]} ${held}`}
                    disabled={held <= 0 || spend.length >= 3}
                    hint={`Discard one ${RESOURCE_LABEL[resource]}.`}
                    onClick={() => setSpend((s) => [...s, resource])}
                  />
                );
              })}
              {spend.length === 3 && (
                <>
                  <span className="text-muted-foreground text-sm">Gain:</span>
                  {RESOURCE_TYPES.map((resource) => (
                    <Act
                      key={resource}
                      label={RESOURCE_LABEL[resource]}
                      variant="accent"
                      hint={`Take one ${RESOURCE_LABEL[resource]}.`}
                      onClick={() =>
                        dispatch({ type: 'barter', player: active, spend, gain: resource })
                      }
                    />
                  ))}
                </>
              )}
              <Act label="Cancel" variant="ghost" hint="Back to your actions." onClick={reset} />
            </Bar>
          ) : (
            <Bar
              title={
                <>
                  <span className="font-semibold">{leader?.name}</span> · one action
                </>
              }
            >
              <ActionButtons
                state={state}
                legal={legal}
                onBuild={() => setMode({ kind: 'build' })}
                onTower={() => setMode({ kind: 'tower' })}
                onWalls={() => setMode({ kind: 'walls' })}
                onBabel={() => dispatch({ type: 'buildBabel', player: active })}
                onAttack={() => dispatch({ type: 'attack', player: active })}
                onMuster={() => dispatch({ type: 'muster', player: active })}
                onScheme={() => dispatch({ type: 'buyScheme', player: active })}
                onBarter={() => setMode({ kind: 'barter' })}
                onPass={() => dispatch({ type: 'pass', player: active })}
              />
            </Bar>
          )}
        </footer>
      </div>
    </TooltipProvider>
  );
}

/** One line of context, then the controls. Keeps the bar to a fixed height. */
function Bar({
  title,
  hint,
  children,
}: {
  title: React.ReactNode;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm">{title}</span>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground hidden cursor-help text-xs underline decoration-dotted underline-offset-2 sm:inline">
                why?
              </span>
            </TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function ProphetPicker({
  state,
  mode,
  setMode,
  dispatch,
}: {
  state: GameState;
  mode: { kind: 'prophet'; hostId: string | null };
  setMode: (m: Mode) => void;
  dispatch: (c: Command) => void;
}) {
  const holder = state.order.find((id) => state.leaders[id]?.schemeHand.includes('false-prophet'));
  const host = state.hosts.find((h) => h.id === mode.hostId);

  return (
    <>
      {host === undefined
        ? state.hosts.map((h) => (
            <Act
              key={h.id}
              label={`${HOST_LABEL[h.kind]} ${h.at.x},${h.at.y}`}
              hint="Mislead this one."
              onClick={() => setMode({ kind: 'prophet', hostId: h.id })}
            />
          ))
        : neighbours(host.at)
            .filter((at) => isPassableAt(state.board, at))
            .map((at) => (
              <Act
                key={coordKey(at)}
                label={`${at.x}, ${at.y}`}
                variant="accent"
                hint="Send it here, ending its movement."
                onClick={() =>
                  holder &&
                  dispatch({
                    type: 'playScheme',
                    player: holder,
                    scheme: 'false-prophet',
                    hostId: host.id,
                    to: at,
                  })
                }
              />
            ))}
      <Act label="Cancel" variant="ghost" hint="Leave the Hosts alone." onClick={() => setMode({ kind: 'idle' })} />
    </>
  );
}
