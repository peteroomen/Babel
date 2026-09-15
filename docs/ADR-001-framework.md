# ADR-001 — Orchestration framework

**Status:** accepted
**Date:** 2026-09-15
**Milestone:** 0 (framework spike)

## Context

`TECH_ARCHITECTURE.md` asks for a short spike proving whether `boardgame.io`
can represent BABEL's turn/Heaven-phase flow, hidden Scheme hands and future
multiplayer "without fighting the library", and to reject it on friction rather
than sunk cost. `FRAMEWORK_SPIKE_NOTE.md` flags its release cadence as a risk.

A further requirement arrived with the spike: the demo is hot-seat, but the
framework must not foreclose **players joining a shared match URL from their
own phones**.

## What was actually built

- `packages/game-core` — framework-free rules: seeded RNG, turn rotation,
  placement legality, hidden hands, collective votes. 32 tests.
- `spike/boardgame-io` — two adapters over that core (`game.ts`,
  `game-stages.ts`), a React binding, and a running lobby server. 7 tests.
- `apps/web` — the same core driving a UI with no framework in the path.

Every adapter move delegates to `applyMove`. No rule was reimplemented inside a
framework callback, which was the architectural bar to clear.

## Findings

### Works, and works well

1. **The core stays pure.** boardgame.io accepts a new `G` returned from a
   move, so `applyMove` drops in unchanged. Rules never entered callbacks.
2. **Hidden Scheme hands work.** `playerView` was verified over a real
   `Local()` transport: each seat sees its own hand and `[]` for everyone else.
3. **Collective decisions are natively supported.** This was the biggest risk.
   A non-active Leader is refused by default (`player not active`), but
   `stages` + `setActivePlayers({ all: 'voting' })` opens the vote to the whole
   table, and the core's majority-plus-coin-flip rule resolves it. GDD §13
   Beacon siting and §14 Host route ties both fit this shape.
4. **The multiplayer server does the thing we want.** `POST /create` returns a
   `matchID`; each player joins and receives credentials. That is the shared
   URL and per-phone identity the demo eventually needs.
5. **It builds on a current toolchain.** Vite 8 + React 19, no overrides.

### Costs and hazards

6. **Turn order is duplicated.** boardgame.io owns `ctx.currentPlayer`; the
   core must also know whose turn it is, since it is the authority for
   legality. Keeping them in lockstep needs hand-written `turn.order.first`,
   `turn.order.next` and `endIf`. It works, but it is a standing source of
   desync bugs and is asserted against in the spike tests.
7. **Type safety stops at the boundary.** `moves` is a string-indexed record of
   `(...args: any[]) => void`, so `moves.placeTile('nonsense', 42)` compiles.
   Mitigated by one explicit cast in `src/typed-moves.ts`.
8. **The package is stale.** `0.50.2` was published **2022-11-10**. It ships no
   `exports` map, so `import ... from 'boardgame.io/server'` fails under Node
   ESM with `ERR_UNSUPPORTED_DIR_IMPORT`; the server must be loaded from CJS or
   by deep path.
9. **Its dependency tree carries the CVEs.** Of 12 npm advisories in this
   workspace, **10 come from boardgame.io** — `ws`, `engine.io`,
   `socket.io-parser`, `@koa/cors`, `svelte`, `react-cookies`. They sit in the
   networking layer, they are the part we would expose publicly, and they
   cannot be fixed without an upstream release.
10. **Bundle cost.** 110.5 KB gzip with boardgame.io versus 70.6 KB without.

## Decision

**Adopt boardgame.io as the eventual transport/orchestration layer. Do not put
the hot-seat demo through it.**

Concretely:

- Milestone 1 onward, `apps/web` drives `game-core` **directly**. Hot-seat
  needs no lobby, no server and no framework tax, and the 40 KB and the turn
  order duplication buy nothing yet.
- `spike/boardgame-io` stays in the repo as a maintained second entry point
  with tests that run in CI. It is the proof that the core is portable, and the
  head start on multi-phone play.
- The rules stay in `game-core`. Both entry points import the same
  `applyMove`, so the framework remains swappable.

## Why not the alternatives

- **PartyKit / Cloudflare Durable Objects** — excellent room-per-match model
  and a modern dependency tree, but no turn, phase, hidden-state or
  simultaneous-input primitives. We would rebuild finding 3 by hand.
- **Colyseus (0.18.5, actively maintained)** — a solid authoritative server,
  but general-purpose realtime rather than turn-based; same rebuild, plus a
  schema layer we do not need for a JSON-serializable state.
- **Rune / Playroom** — built for exactly the multi-phone case, but opinionated
  toward short party games and sandboxed to their own platforms.
- **Custom server over the command log** — genuinely viable, because the core
  is already command-and-event shaped with seeded RNG. This is the fallback if
  boardgame.io's staleness becomes blocking, and the adapter is ~100 lines.

## Consequences and follow-ups

- Pin boardgame.io exactly. Treat it as replaceable infrastructure.
- **Before any public multiplayer deploy**, re-assess findings 8 and 9. A
  self-hosted game server holding no personal data is a modest risk; an
  internet-facing one on unpatched `ws`/`engine.io` is a real one. That
  re-assessment is a gate on networked play, not on the hot-seat demo.
- Keep `game-core` free of framework imports. CI enforces it by building
  `apps/web` without boardgame.io present in its dependency graph.
