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

## Canon versus tuning

Rules explicitly marked **TUNEABLE** in the GDD are balance values. Do not casually change structural rules during the first implementation milestone. If a rule blocks implementation or produces an obvious contradiction, document it rather than silently redesigning it.

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

## Next implementation step

Start with the Milestone 0 framework spike and Milestone 1 spatial-economy vertical slice in `IMPLEMENTATION_PLAN.md`. Keep the first PR small enough to review: grid, terrain/rivers, feature detection, payouts, hot-seat turn rotation, deterministic RNG/logging, and tests.
