# BABEL — prototype implementation

BABEL is a digital-first solo / 2–4 leader cooperative-competitive board game.

> Humanity is building the Tower of Babel to reach Heaven and kill a tyrannical God. Everyone must keep the project alive; if Babel reaches Heaven, the surviving leader with the most Prestige wins the glory.

## Start here

1. `docs/GDD.md` — **canonical rules and design source of truth**.
2. `docs/RULES_QUICK_REFERENCE.md` — compact implementation reference.
3. `AGENT_HANDOFF.md` — what to build, what not to redesign, and prototype acceptance criteria.
4. `TECH_ARCHITECTURE.md` — recommended code boundaries and framework guidance.
5. `IMPLEMENTATION_PLAN.md` — milestone order.
6. `ART_DIRECTION.md` — visual/tone brief.
7. `docs/FINAL_BALANCE_PASS_2026-09-15.md` and `docs/MODEL_NOTES.md` — modelling evidence and tuning context.
8. `docs/NEXT_WORK_TRIAGE.md` — current deferred-work order and scope notes.

## Canon versus tuning

Rules explicitly marked **TUNEABLE** in the GDD are balance values. Do not casually change structural rules during the first implementation milestone. If a rule blocks implementation or produces an obvious contradiction, document it rather than silently redesigning it.

The live default is canon v0.6: rolled Heaven uses the adopted player-count
cadence and Hosts route on dry river banks from the fixed Beacon start.
`V05_RULES` and `V04_RULES` remain available as frozen rulesets for historical
comparisons.

## First playable goal

A complete local hot-seat game for 2–4 Leaders (solo controls two Leaders) with:

- square tile placement and river legality;
- feature detection and resource payouts;
- harvesting buildings and occupation;
- Babel construction and permanent stage escalation;
- Beacons, Ophanim Hosts and Seraphs;
- shortest-path Heavenly movement;
- Army dice, Towers and Walls;
- Prestige;
- the compact Scheme and escalating Confusion decks;
- win/loss states;
- a transparent game/event log.

Visual polish, networking, accounts, characters, expanded content and animation are explicitly deferred until the core game is fun.

## Architecture direction

Use **TypeScript + React + Vite + Vitest**, with a pure deterministic `game-core` separated from rendering. Spike `boardgame.io` briefly as an orchestration/multiplayer candidate, but do not put core rules inside framework-specific callbacks.

The art/tone target is a **cheerful, handmade civic project to murder God, besieged by horrifying-but-cute celestial geometry**. See `ART_DIRECTION.md`.

## Repository layout

```text
packages/game-core   pure deterministic rules; no framework imports
packages/game-data   TUNEABLE values: terrain weights, player-count scaling
apps/web             hot-seat UI, drives game-core directly
spike/boardgame-io   maintained multiplayer spike (see ADR-001)
```

```bash
npm install
npm test          # vitest, all packages and the spike
npm run typecheck # packages, web app and spike
npm run verify    # typecheck + tests
npm run dev       # hot-seat app
```

## Progress

- **Milestone 0 — framework spike.** Complete. See
  `docs/ADR-001-framework.md` for the orchestration decision.
- **Milestone 1 — spatial economy.** Complete. Square grid, five terrain types,
  river shapes with free rotation and symmetric edge matching, connected-feature
  detection, adjacency payouts with occupation suppression, 2–4 hot-seat
  Leaders, and a board UI that highlights legal squares and projects the payout
  before you commit.
- **Milestone 2 — industry, Babel and Prestige.** Complete. Sawmill, Farmstead,
  Brickworks and Mine with per-feature ownership; the foreign expansion trigger
  paying every foreign owner plus a single +1 to the placer; Babel's growing
  stack with permanent Stage escalation and shared victory; Barter; Prestige
  for buildings and Babel pieces.
- **Milestone 3 — Heaven.** Complete. Beacons sited collectively on legal
  frontier tiles; Ophanim Hosts and Stage-III Seraphs; shortest-path movement
  that rivers permanently reshape; Babel strikes and the two-step Foundation
  breach; Army dice, Muster, and Attack with hit assignment. **The game can now
  be won or lost.**
- **Milestone 4 — defensive geography.** Complete. Towers contributing one
  targeted support die per occupied feature during any Leader's Attack, and
  Walls as temporary barricades that a Host destroys by spending its movement.
- **Milestone 5 — the compact card layer.** Complete. The three Schemes with
  hidden hands, and the six Confusion effects with the deck growing as Babel
  escalates. **Canon v0.1 is now fully playable.**
- **Canon v0.5 cadence adoption.** Complete. Heaven's Stage I/II/III arrival
  cycles now scale by the 2/3/4-Leader table size from the scheduled first
  Beacon round, while `V04_RULES` keeps historical fixed-arrival comparisons
  reproducible.
- **Canon v0.6 bank-routing adoption.** Complete. Hosts use the adopted dry-bank
  route from the fixed Beacon start; `V05_RULES` freezes the preceding canon for
  historical controls and experiment replay.
- **Milestone 6 — playtest instrumentation.** Next: per-game telemetry and
  deterministic replay from seed plus command log.

Interpretations of under-specified canon are recorded in
`docs/RULES_DECISIONS.md`.

## What is not implemented yet

All seven actions are live. The deferred content in GDD §23 — character powers,
Titles, roads, trading, more cards or enemies — stays deferred until human play
says the game needs it.
