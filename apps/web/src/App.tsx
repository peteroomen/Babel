/**
 * BABEL — one screen, no page scrolling.
 *
 * The board takes whatever space is left; everything else lives in a fixed
 * header, a fixed rail and a contextual action bar at the bottom. All legality
 * questions go to `game-core`; nothing here reimplements a rule.
 */
import { useMemo, useState } from 'react';
import {
  BROAD_PIECE_COST,
  CANON_RULES,
  CANON_WALLS,
  CONFUSION,
  RESOURCE_TYPES,
  ROLLED_HEAVEN,
  SCHEMES,
  type BuildingType,
  type HostKind,
  type ResourceType,
  type RuleSet,
} from '@babel-game/game-data';
import { PACE, paced, type Pace } from '@babel-game/stagecraft';
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
import { BookOpenIcon, PanelRightIcon, RotateCcwIcon, ScrollTextIcon, UsersIcon } from 'lucide-react';
import { Board, HostIcon } from './Board';
import { PaperFx } from './PaperFx';
import { BabelCard, LeaderRow, LogCard, LogList, SchemeCard } from './Panels';
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
import { HOST_BLURB, HOST_LABEL, RESOURCE_LABEL, TERRAIN_LABEL } from './theme';
import { ARCHETYPE_BLURB, ARCHETYPE_LABEL } from '@babel-game/game-ai';
import { aiSeatsFor, useAiTurns } from './useAi';
import { useStage } from './stage/useStage';
import { Curtain } from './stage/Curtain';
import { DiceTray } from './stage/DiceTray';
import { Announce } from './stage/Announce';
import { ConfusionBanner } from './ConfusionBanner';

const NAMES = ['Ada', 'Peter', 'Rook', 'Vex'];

type Mode =
  | { kind: 'idle' }
  | { kind: 'build' }
  | { kind: 'tower' }
  | { kind: 'monument' }
  | { kind: 'walls' }
  | { kind: 'barter' }
  | { kind: 'prophet'; hostId: string | null };

/** A labelled row of mutually exclusive choices. */
function Choice<T extends string | number>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        <div className="paper penned flex shrink-0 overflow-hidden rounded-md border">
          {options.map((option) => (
            <button
              key={String(option.value)}
              onClick={() => onChange(option.value)}
              className={`h-8 min-w-9 px-2 text-xs tabular-nums transition-colors ${
                option.value === value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

/** A table: how many Leaders, how many of them are bots, and under which rules. */
type Table = {
  readonly leaders: number;
  readonly ai: number;
  readonly rules: RuleSet;
};

const OPENING: Table = { leaders: 2, ai: 1, rules: CANON_RULES };

/**
 * How long the screen takes, remembered between sittings.
 *
 * A per-person convenience rather than part of the game, so it lives in the
 * browser and never goes near `GameState`. Storage can throw or come back
 * empty — a private window, cleared site data — and the default is fine.
 */
const PACE_KEY = 'babel:pace';

function rememberedPace(): Pace {
  try {
    const saved = window.localStorage.getItem(PACE_KEY);
    if (saved === 'brisk' || saved === 'natural' || saved === 'unhurried') return saved;
  } catch {
    /* Storage is a nicety. */
  }
  return 'natural';
}

export function App() {
  const [table, setTable] = useState<Table>(OPENING);
  const [seed, setSeed] = useState('babel-1');
  const [state, setState] = useState<GameState>(() =>
    setupGame(NAMES.slice(0, OPENING.leaders), 'babel-1', OPENING.rules),
  );
  const [selected, setSelected] = useState<Coord | null>(null);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [spend, setSpend] = useState<ResourceType[]>([]);
  const [hits, setHits] = useState<Record<string, number>>({});
  const [wallPicks, setWallPicks] = useState<Coord extends never ? never : { a: Coord; b: Coord }[]>(
    [],
  );

  const options = useMemo(
    () => (state.drawnTile ? getLegalTilePlacements(state.board, state.drawnTile, state.rules) : []),
    [state.board, state.drawnTile],
  );

  /* Only list Hosts the rules in force can actually send. Under canon's
     one-per-Beacon spawn that is the two original silhouettes; under the
     rolled table it is whatever the Stage tables name. */
  const heavenKinds = useMemo<readonly HostKind[]>(() => {
    const spawn = state.rules.heavenSpawn;
    if (!spawn) return ['ophanim', 'seraph'];
    const seen = new Set<HostKind>();
    for (const stage of [1, 2, 3] as const) {
      for (const entry of spawn.table[stage]) seen.add(entry.kind);
    }
    return [...seen];
  }, [state.rules.heavenSpawn]);
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
  const monumentAction = legal.find((a) => a.type === 'buildMonument');
  const wallsAction = legal.find((a) => a.type === 'buildWalls');

  /**
   * The screen, which is allowed to be a moment behind the rules.
   *
   * `stage.view` is what the board draws; `state` stays the authority for
   * every question of legality. Under a still tempo the two are the same
   * object and this costs nothing.
   */
  const [pace, setPace] = useState<Pace>(rememberedPace);
  const tempo = useMemo(() => paced(pace), [pace]);
  const choosePace = (next: Pace) => {
    setPace(next);
    try {
      window.localStorage.setItem(PACE_KEY, next);
    } catch {
      /* Storage is a nicety. */
    }
  };

  const stage = useStage(state, tempo);

  const reset = () => {
    setSelected(null);
    setRotationIndex(0);
    setMode({ kind: 'idle' });
    setSpend([]);
    setHits({});
    setWallPicks([]);
  };
  /** Apply a command, then hand the transition to the stage to play out. */
  const advance = (command: Command) => {
    const { state: next, events } = applyMove(state, command);
    stage.play(state, events, next);
    setState(next);
  };
  const dispatch = (command: Command) => {
    advance(command);
    reset();
  };
  const restart = (next: Partial<Table> = {}) => {
    const merged = { ...table, ...next };
    /* Never more bots than there are seats. */
    const settings: Table = { ...merged, ai: Math.min(merged.ai, merged.leaders) };
    const fresh = `babel-${Date.now()}`;
    setTable(settings);
    setSeed(fresh);
    setState(setupGame(NAMES.slice(0, settings.leaders), fresh, settings.rules));
    /* Nothing from the old world should still be playing over the new one. */
    stage.skip();
    reset();
  };

  /* Which seats the machine plays, and letting it play them. */
  const aiSeats = useMemo(
    () => aiSeatsFor(state.order, table.ai),
    [state.order, table.ai],
  );
  useAiTurns(state, aiSeats, seed, advance, !stage.busy);

  const isBot = Boolean(aiSeats[active]);
  const sameKind = state.rules.barterMode === 'sameKind';

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
      <div
        className="flex h-full flex-col overflow-hidden"
        style={{ ['--pace' as string]: PACE[pace] }}
      >
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
                    <div className="space-y-1">
                      {heavenKinds.map((kind) => (
                        <div key={kind} className="flex items-start gap-2">
                          <span className="shrink-0 pt-0.5">
                            <HostIcon kind={kind} />
                          </span>
                          <p>
                            <strong>{HOST_LABEL[kind]}</strong>{' '}
                            <span className="text-muted-foreground">{HOST_BLURB[kind]}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                    {state.rules.riverPrestige && (
                      <p>
                        <strong>Babel's river:</strong> the water running into the Foundation is
                        the one Heaven can never cross. Place a tile that carries it further
                        upstream and you score{' '}
                        {state.rules.riverPrestige.perTile === 1
                          ? '1 Prestige'
                          : `${state.rules.riverPrestige.perTile} Prestige`}
                        . It has to run <em>further</em> — widening it beside Babel pays nothing.
                      </p>
                    )}
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
                <Button variant="ghost" size="icon" aria-label="New game" onClick={() => restart()}>
                  <RotateCcwIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New game</TooltipContent>
            </Tooltip>

            <Dialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Table settings">
                      <UsersIcon />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {table.leaders} Leaders, {table.ai} played by the machine
                </TooltipContent>
              </Tooltip>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>The table</DialogTitle>
                  <DialogDescription>
                    Every change starts a new game.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <Choice
                    label="Leaders"
                    hint="How many seats. Heaven scales with the count."
                    options={[2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
                    value={table.leaders}
                    onChange={(leaders) => restart({ leaders })}
                  />
                  <Choice
                    label="Played by the machine"
                    hint="Bots take the last seats, so you are always the first Leader. Set it to one below the Leader count to play solo."
                    options={Array.from({ length: table.leaders + 1 }, (_, n) => ({
                      value: n,
                      label: String(n),
                    }))}
                    value={table.ai}
                    onChange={(ai) => restart({ ai })}
                  />
                  <Choice
                    label="Barter"
                    hint="v0.2 takes four of one resource, so Barter is an escape valve for a surplus stack rather than the way to convert any pile into the one thing Babel wants. v0.1 took any three."
                    options={[
                      { value: 'mixed', label: 'Any' },
                      { value: 'sameKind', label: 'Same kind' },
                    ]}
                    value={table.rules.barterMode}
                    onChange={(barterMode) =>
                      restart({ rules: { ...table.rules, barterMode } })
                    }
                  />
                  <Choice
                    label="Babel costs"
                    hint="v0.2 spreads the same total across three resources per Stage, so your income is useful whatever ground you are on — and Metal finally has a sink. v0.1 asked for Brick and Food only, all from one terrain."
                    options={[
                      { value: 'broad', label: 'Broad' },
                      { value: 'canon', label: 'v0.1' },
                    ]}
                    value={
                      table.rules.babelPieceCost === BROAD_PIECE_COST ? 'broad' : 'canon'
                    }
                    onChange={(choice) =>
                      restart({
                        rules: {
                          ...table.rules,
                          babelPieceCost:
                            choice === 'broad'
                              ? BROAD_PIECE_COST
                              : CANON_RULES.babelPieceCost,
                        },
                      })
                    }
                  />
                  <Choice
                    label="Barter action"
                    hint="v0.3 lets you Barter without spending your turn's action, once per turn. Same-kind Barter already destroys three cards every time it runs — it was simply gated behind the one thing a Leader is short of, which is the action."
                    options={[
                      { value: 'free', label: 'Free' },
                      { value: 'action', label: 'Costs your action' },
                    ]}
                    value={table.rules.barterIsFree ? 'free' : 'action'}
                    onChange={(choice) =>
                      restart({
                        rules: { ...table.rules, barterIsFree: choice === 'free' },
                      })
                    }
                  />
                  <Choice
                    label="Heaven arrives"
                    hint="v0.3 rolls a d6 on the Stage's table for what comes and a die among the Beacons for where — one, then two a round. Canon sent one Host out of every Beacon, so the amount of Heaven was a side effect of how many people were playing."
                    options={[
                      { value: 'rolled', label: 'Rolled' },
                      { value: 'perBeacon', label: 'One per Beacon' },
                    ]}
                    value={table.rules.heavenSpawn ? 'rolled' : 'perBeacon'}
                    onChange={(choice) =>
                      restart({
                        rules: {
                          ...table.rules,
                          heavenSpawn: choice === 'rolled' ? ROLLED_HEAVEN : null,
                        },
                      })
                    }
                  />
                  <Choice
                    label="River Prestige"
                    hint="Canon since v0.4. Pays the Leader who places a tile carrying Babel’s own river further upstream — worth about 2% of the Prestige on the table. The real effect is that Heaven cannot cross water, so the reward for extending the river is also a moat."
                    options={[
                      { value: 'off', label: 'Off' },
                      { value: 'reach', label: '+1 per tile' },
                      { value: 'mile3', label: '+2 every 3rd' },
                    ]}
                    value={
                      table.rules.riverPrestige === null
                        ? 'off'
                        : table.rules.riverPrestige.milestone === null
                          ? 'reach'
                          : 'mile3'
                    }
                    onChange={(choice) =>
                      restart({
                        rules: {
                          ...table.rules,
                          riverPrestige:
                            choice === 'off'
                              ? null
                              : choice === 'reach'
                                ? { perTile: 1, requireReach: true, cap: null, milestone: null }
                                : { perTile: 2, requireReach: true, cap: null, milestone: 3 },
                        },
                      })
                    }
                  />
                  <Choice
                    label="Walls"
                    hint="Removed in v0.4. A Wall bought one Host-move of delay, once, if a Host walked that exact edge, and never changed where Heaven went. At a table with a wall-builder in it, Walls cost more games than they saved: 47.5% shared wins against 81.7% without."
                    options={[
                      { value: 'off', label: 'Removed' },
                      { value: 'on', label: 'In play' },
                    ]}
                    value={table.rules.walls ? 'on' : 'off'}
                    onChange={(choice) =>
                      restart({
                        rules: {
                          ...table.rules,
                          walls: choice === 'on' ? CANON_WALLS : null,
                        },
                      })
                    }
                  />
                  <Choice
                    label="Barter cost"
                    hint="How many cards a Barter discards. v0.2 asks four: under the old three, three quarters of all Barters were a Leader converting into Brick for Babel."
                    options={[3, 4].map((n) => ({ value: n, label: String(n) }))}
                    value={table.rules.barterCost}
                    onChange={(barterCost) => restart({ rules: { ...table.rules, barterCost } })}
                  />
                  <Choice
                    label="Attack costs"
                    hint="What each Army die costs to roll. Canon Attack is free, which is why a Leader can rationally never invest. Food is what Babel is built from, so charging dice in Food makes survival and winning fight over the same resource; Wood is the one everyone ends up drowning in."
                    options={[
                      { value: 'free', label: 'Free' },
                      { value: 'wood', label: 'Wood' },
                      { value: 'food', label: 'Food' },
                    ]}
                    value={table.rules.attackDieCost?.resource ?? 'free'}
                    onChange={(choice) =>
                      restart({
                        rules: {
                          ...table.rules,
                          attackDieCost:
                            choice === 'free'
                              ? null
                              : { resource: choice as ResourceType, amount: 1 },
                        },
                      })
                    }
                  />
                  {/* The only setting here that is about the screen rather
                      than the rules, so it takes effect where it stands. */}
                  <Choice
                    label="Pace"
                    hint="How long the screen takes to tell you what just happened. It changes nothing about the game, applies immediately, and every sequence can be skipped with a click or a key whatever this says."
                    options={[
                      { value: 'brisk', label: 'Brisk' },
                      { value: 'natural', label: 'Natural' },
                      { value: 'unhurried', label: 'Unhurried' },
                    ]}
                    value={pace}
                    onChange={choosePace}
                  />
                  <Choice
                    label="Reserve slots"
                    hint="Face-up tiles beside the bag. Swapping your draw for one is free and is not your action — but the Reserve is shared, so you leave your cast-off for the next Leader."
                    options={[0, 1, 2].map((n) => ({ value: n, label: String(n) }))}
                    value={table.rules.reserveSlots}
                    onChange={(reserveSlots) =>
                      restart({ rules: { ...table.rules, reserveSlots } })
                    }
                  />
                  {table.ai > 0 && (
                    <div className="space-y-1 border-t pt-3">
                      {state.order
                        .filter((id) => aiSeats[id])
                        .map((id) => (
                          <p key={id} className="text-xs">
                            <span className="font-medium">{state.leaders[id]!.name}</span> the{' '}
                            {ARCHETYPE_LABEL[aiSeats[id]!]}{' '}
                            <span className="text-muted-foreground">
                              — {ARCHETYPE_BLURB[aiSeats[id]!]}
                            </span>
                          </p>
                        ))}
                    </div>
                  )}
                  {table.ai > 0 && (
                    <p className="text-muted-foreground text-xs">
                      Machine Leaders:{' '}
                      Beacons, the Heaven Phase and the Confusion window stay yours — those
                      are the table's decisions, not any one Leader's.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <ConfusionBanner state={stage.view} />

        {/* ── Board + rail ───────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1">
          <main className="relative min-w-0 flex-1 p-2">
            <Board
              className="size-full"
              state={stage.view}
              selected={stage.busy ? null : selected}
              rotation={rotation}
              onSelect={(at) => {
                setSelected(at);
                setRotationIndex(0);
              }}
              buildSites={
                stage.busy
                  ? []
                  : mode.kind === 'build' && buildAction
                    ? buildAction.sites.map((s) => s.at)
                    : mode.kind === 'tower' && towerAction
                      ? towerAction.sites
                      : mode.kind === 'monument' && monumentAction
                        ? monumentAction.sites
                        : []
              }
              onBuildSite={(at) => {
                if (mode.kind === 'tower') {
                  dispatch({ type: 'buildTower', player: active, at });
                  return;
                }
                if (mode.kind === 'monument') {
                  dispatch({ type: 'buildMonument', player: active, at });
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
              wallEdges={!stage.busy && mode.kind === 'walls' && wallsAction ? wallsAction.edges : []}
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
              beaconSites={stage.busy ? [] : (state.pendingBeacon?.sites ?? [])}
              onBeaconSite={(at) => dispatch({ type: 'placeBeacon', player: active, at })}
              onHost={state.pendingAttack && !stage.busy ? tapHost : undefined}
              selectedHosts={hits}
              live={!stage.busy}
              spot={stage.spot}
              hold={stage.hold}
              focus={stage.focus}
            />
            <DiceTray state={state} />
            <Announce spot={stage.spot} state={stage.view} ms={stage.hold} />
          </main>

          <aside className="hidden w-[19rem] shrink-0 flex-col gap-2 border-l p-2 xl:flex">
            {rail}
          </aside>
        </div>

        {/* ── Action bar ─────────────────────────────────────────── */}
        <footer className="bg-papyrus-light/70 min-h-14 shrink-0 border-t px-3 py-2">
          {stage.busy ? (
            <Curtain spot={stage.spot} state={stage.view} onSkip={stage.skip} />
          ) : isBot && state.phase !== 'gameOver' && state.phase !== 'heaven' && !state.pendingBeacon ? (
            <Bar
              title={
                <>
                  <span className="font-semibold">{leader?.name}</span> the{' '}
                  {ARCHETYPE_LABEL[aiSeats[active]!]}
                </>
              }
              hint="Machine Leaders take their own turns. Beacons and the Heaven Phase still come to you."
            >
              <span className="text-muted-foreground text-sm">thinking…</span>
            </Bar>
          ) : state.phase === 'gameOver' ? (
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
              <Button size="sm" className="ml-auto" onClick={() => restart()}>
                New game
              </Button>
            </div>
          ) : state.pendingBeacon ? (
            <Bar
              title="Where does Heaven land?"
              hint={`${state.pendingBeacon.sites.length} legal frontier tiles are lit. Every Beacon spawns a Host each Heaven Phase, for the rest of the game.`}
            />
          ) : state.phase === 'confusion' && state.confusion.card ? (
            <Bar
              title={`${CONFUSION[state.confusion.card].label} revealed`}
              hint={CONFUSION[state.confusion.card].text}
            >
              {state.order.some((id) =>
                state.leaders[id]?.schemeHand.includes('common-tongue'),
              ) && <SchemeCard scheme="common-tongue" />}
              {state.order
                .filter((id) => state.leaders[id]?.schemeHand.includes('common-tongue'))
                .map((id) => (
                  <Act
                    key={id}
                    label={`${state.leaders[id]?.name} plays it`}
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
            <Bar title={`${state.leaders[state.bonusWindow]?.name} may play a Scheme`}>
              <SchemeCard scheme="frenzied-works" />
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
              title={
                assigned === successes
                  ? `${successes} hit${successes === 1 ? '' : 's'} assigned`
                  : `${successes - assigned} hit${
                      successes - assigned === 1 ? '' : 's'
                    } still to place`
              }
              hint="The dice are on the table: every face, and the Defence each one had to beat. A Seraph needs two hits — the first only breaks its shield."
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
              {/*
                A hit that is never given a target is simply thrown away, and
                "Confirm" was perfectly happy to throw all of them away on one
                tap. It cannot be disabled outright — a roll can beat the bar
                and still have nothing left it is allowed to kill — so it says
                what it is about to do instead, and stops looking like the
                ordinary way to finish.
              */}
              <Act
                label={
                  assigned === 0
                    ? `Waste ${successes} hit${successes === 1 ? '' : 's'}`
                    : assigned < successes
                      ? `Confirm · ${successes - assigned} unspent`
                      : 'Confirm'
                }
                variant={assigned === 0 ? 'outline' : 'accent'}
                hint={
                  assigned === 0
                    ? 'Nothing has been targeted, so every hit is lost. Tap a Host above first.'
                    : assigned < successes
                      ? `${successes - assigned} hit${
                          successes - assigned === 1 ? '' : 's'
                        } will be lost — tap another Host if there is one worth hitting.`
                      : 'Apply the hits and end your turn.'
                }
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
              {/* Milestone 6: the swap is free and is not your action. */}
              {state.reserve.map((tile, slot) => (
                <Act
                  key={`reserve-${slot}`}
                  label={`Take ${TERRAIN_LABEL[tile.terrain]}${
                    tile.river === 'none' ? '' : ' ~'
                  }`}
                  hint={`Swap your draw for this Reserve tile. Free, and not your action — but your ${
                    TERRAIN_LABEL[state.drawnTile!.terrain]
                  } goes into the slot for whoever is next.`}
                  onClick={() => dispatch({ type: 'swapReserve', player: active, slot })}
                />
              ))}
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
          ) : mode.kind === 'build' || mode.kind === 'tower' || mode.kind === 'monument' ? (
            <Bar
              title={
                mode.kind === 'tower'
                  ? 'Choose a Tower site'
                  : mode.kind === 'monument'
                    ? 'Choose a Monument site'
                    : 'Choose a building site'
              }
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
            /*
             * Two taps, not five.
             *
             * Same-kind Barter spends a fixed pile of one resource, so picking
             * the resource *is* picking the pile — there was never a decision
             * in the four separate taps it used to take, only the chance to
             * get halfway and be stuck. A resource you cannot complete a
             * Barter with is disabled and says why, rather than letting you
             * find out on the last tap.
             *
             * Mixed Barter is the one variant where the taps carry a real
             * choice, since the cards may differ, so there it stays one at a
             * time.
             */
            <Bar
              title={spend.length > 0 ? 'Barter · take what you need' : 'Barter'}
              hint={
                spend.length > 0
                  ? `Giving up ${spend.length} ${RESOURCE_LABEL[spend[0]!]}.`
                  : sameKind
                    ? `Give up ${state.rules.barterCost} of one resource for any single resource you choose.`
                    : `Give up any ${state.rules.barterCost} cards for any single resource you choose.`
              }
            >
              {spend.length < state.rules.barterCost &&
                RESOURCE_TYPES.map((resource) => {
                  const held =
                    leader.resources[resource] - spend.filter((s) => s === resource).length;
                  const need = sameKind ? state.rules.barterCost : 1;
                  const offKind = sameKind && spend.length > 0 && spend[0] !== resource;
                  const short = held < need;
                  return (
                    <Act
                      key={resource}
                      label={`${RESOURCE_LABEL[resource]} ${held}`}
                      disabled={short || offKind}
                      hint={
                        short
                          ? `You hold ${held}. A Barter gives up ${need}.`
                          : offKind
                            ? `You have already committed ${RESOURCE_LABEL[spend[0]!]}.`
                            : sameKind
                              ? `Give up ${need} ${RESOURCE_LABEL[resource]}.`
                              : `Add one ${RESOURCE_LABEL[resource]} to the pile.`
                      }
                      onClick={() =>
                        setSpend((s) =>
                          sameKind
                            ? Array.from({ length: state.rules.barterCost }, () => resource)
                            : [...s, resource],
                        )
                      }
                    />
                  );
                })}
              {spend.length === state.rules.barterCost && (
                <>
                  {RESOURCE_TYPES.map((resource) => (
                    <Act
                      key={resource}
                      label={`Take ${RESOURCE_LABEL[resource]}`}
                      variant={resource === spend[0] ? 'outline' : 'accent'}
                      hint={
                        resource === spend[0]
                          ? `Trading ${RESOURCE_LABEL[resource]} for itself would only lose you cards.`
                          : `Take one ${RESOURCE_LABEL[resource]} and end the Barter.`
                      }
                      onClick={() =>
                        dispatch({ type: 'barter', player: active, spend, gain: resource })
                      }
                    />
                  ))}
                </>
              )}
              <Act
                label={spend.length > 0 ? 'Start over' : 'Cancel'}
                variant="ghost"
                hint={spend.length > 0 ? 'Put the cards back.' : 'Back to your actions.'}
                onClick={spend.length > 0 ? () => setSpend([]) : reset}
              />
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
                onMonument={() => setMode({ kind: 'monument' })}
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

/**
 * What is going on, why, and what you can do about it.
 *
 * The explanation used to hang off a "why?" that was `hidden sm:inline`, which
 * meant that on a phone — where the rail is also hidden — there was no way to
 * reach it at all, and the surrounding buttons explain themselves through
 * tooltips, which a touchscreen has no way to open either. A player on a
 * phone was simply told less. It is plain text now, on every screen.
 */
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
      <div className="flex min-w-0 shrink flex-col justify-center">
        <span className="truncate text-sm">{title}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
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
      <SchemeCard scheme="false-prophet" />
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
