# ADR-002 — Animation is a data problem, not a library problem

**Status:** accepted
**Date:** 2026-09-17
**Milestone:** 7 (telegraphing the game state)

## Context

Milestone 7 asks the screen to say what the rules are doing: a Confusion card
that announces itself, dice that resolve where you can see them, Hosts that
step tile by tile instead of teleporting. The milestone's own rules are strict
about what that may not cost us:

- animation reads `GameState` and the event log, and never becomes a source of
  truth;
- `game-core` stays pure and synchronous — delete the animation layer and the
  game is still playable;
- every animation is skippable and interruptible, and `prefers-reduced-motion`
  collapses every transition to its end state.

The obvious move is to reach for an animation library. The obvious move is
wrong here, and it is worth writing down why before the first `npm install`.

## What the core already gives us

`applyMove` returns `{ state, events }`. The events are not a debug log — they
are a complete, ordered account of the transition:

- `hostMoved` carries `id`, `from`, `to`, and is emitted **once per movement
  point**, so a Seraph's two squares are two events and a Wall break lands
  between them in the right order;
- `attackRolled` carries every die face, the Defence and the success count;
  `towerSupport` carries one roll, its target and whether it hit;
- `babelPieceLost`, `buildingRazed`, `wallBroken`, `hostSpawned` and
  `foundationOccupied` each carry the coordinates and identities they touch.

Both UI call sites currently write `applyMove(state, command).state` and throw
the other half away. The entire milestone is downstream of picking it back up.

## Decision

**A command produces events. Events produce frames. A frame is a `GameState`.**

A pure director folds `(before, events, after)` into a list of **beats**. Each
beat carries a complete frame plus a small `Spotlight` describing what to
emphasise and what to say about it. The renderer is handed a frame exactly
where it used to be handed the live state:

```ts
<Board state={beat.frame} spot={beat.spot} />
```

No component learns a new prop type. The board is simply rendering a slightly
older world for a few hundred milliseconds.

This buys one property that makes the layer trustworthy:

> Folding every beat over `before` reproduces the visible fields of `after`,
> exactly.

That is testable in Node, with no browser, against the headless harness that
already plays thousands of games. Any event the director does not understand
degrades to a single **cut** beat that jumps straight to `after` — never a
wrong picture — and the invariant test asserts the cut is never taken. A new
event type added to `game-core` therefore fails a test loudly instead of
silently desynchronising the screen.

### No animation library

Motion/Framer, GSAP and friends are built for the problem we do not have:
interpolating continuous layout in the DOM. Our board is SVG, our frames are
already discrete, and our timing is a queue of holds. CSS transitions on
transforms plus a small scheduler is the honest size of the problem, and it
costs nothing in the bundle — which for a game that will one day be handed
around on phones is not nothing (ADR-001 finding 10 counted 40 KB as a real
cost).

### The stage lives in its own package

`packages/stagecraft` is pure and framework-free: no React import, no DOM. It
therefore lands in `npm test` and `tsc -b` with the other packages and can be
property-tested against the harness. `apps/web` owns only the scheduling, the
interrupt and the pixels.

This keeps the repository's one real architectural boundary — pure rules
versus rendering — with the new layer on the rendering side of it, reading the
core's output and never writing to it.

## Consequences

- **Interrupt is a correctness rule, not a feature.** Any click, any key, a
  new command, or `prefers-reduced-motion` drains the queue to the final frame
  at once. The state machine is *already* at `after`; the screen is merely
  behind, and catching up is always legal.
- **Stale frames must not be clickable.** Interactive overlays — legal
  placements, build sites, Host tap targets — render only when the stage is
  idle, so nobody can act on a world that has already moved on.
- **The bots wait for the story.** `useAiTurns`' fixed think-time becomes
  "when the screen has finished telling the last one", so machine Leaders stop
  racing the narration.
- **The director may re-read the board; it may never re-decide a rule.** Where
  a beat needs something the events do not carry — which tiles paid for a
  placement — the query goes into `game-core` as a pure function that the rule
  and the view both call, the way `previewPlacement` already stops the preview
  and the transition from disagreeing.
- **Scrubbing comes nearly free.** Once frames are cheap, showing the board as
  it was at any log line is a small addition rather than a project. Full
  replay-from-seed stays in Milestone 9.
- **A moving camera and live SVG filters do not mix.** Added after the fact,
  when the map was asked to zoom and pan on its own. Transforming a group that
  contains a filter forces that filter to be re-rasterised at every scale it
  is drawn at, and the papyrus is built out of turbulence: the torn edge of the
  sheet, the fibre grain, the cartouche. Measured against an identical run with
  the camera pinned wide, on a software rasteriser with no GPU:

  | | 95th percentile frame | frames over 32ms | frames rendered in 80s |
  | --- | --- | --- | --- |
  | No camera | 16.8ms | 1.5% | 4724 |
  | Camera, filters live | 66.7ms | 8.0% | 3659 |
  | Camera, paper parked while moving | 16.8ms | 4.4% | 4224 |

  `will-change: transform` does not help, because the problem is resolution
  rather than compositing. The paper is therefore a property of the still shot:
  plain while the camera moves, grain back when it settles. If the remaining
  4.4% ever matters, the next step is to stop generating the grain at runtime
  and tile a raster instead — a texture costs nothing to scale.

## Why not the alternatives

- **Re-simulating intermediate states in `game-core`** — the core would need
  to expose half-finished Heaven Phases, which means a second code path
  through the rules whose only consumer is the screen. It would also make the
  rules asynchronous in spirit, which the milestone forbids.
- **Animating from a state diff instead of events** — a diff tells you a Host
  is in a new square; it cannot tell you it walked, which route it took, or
  that it broke a Wall on the way. The ordering *is* the information.
- **Driving motion from React component lifecycle** — hooks fire on render,
  not in game order, so the sequence would be at the mercy of reconciliation.
  The queue has to be data we own.
