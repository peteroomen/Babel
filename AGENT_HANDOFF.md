# Agent handoff — build the first playable BABEL prototype

## Mission

Populate a new repository with an ugly-but-complete local playable version of the game described in `docs/GDD.md`.

The goal is **rules validation through human play**, not production polish. Preserve the spatial decisions and one-action turn economy above everything else.

## Source of truth

Priority when documents disagree:

1. `docs/GDD.md`
2. `docs/RULES_QUICK_REFERENCE.md`
3. `docs/FINAL_BALANCE_PASS_2026-09-15.md`
4. `docs/MODEL_NOTES.md`
5. `reference_model/` only as non-canonical modelling precedent

The Python model is heuristic historical balance scaffolding and predates some final canon rules. It is not canonical production architecture or behaviour.

## Do not redesign in milestone 1

Keep these structural rules intact:

- Draw one terrain tile, place it, resolve, then take exactly one action.
- Shared map with square terrain tiles and connected geographic features.
- Terrain economy: Farmland/Food, Forest/Wood, Hills/Brick, Mountain/Metal, Desert/nothing.
- Rivers are permanent Heavenly barriers; Walls are temporary movement-consuming barricades.
- One occupied tile shuts down the whole connected feature's economic output.
- Harvesting buildings reward foreign expansion as specified in the GDD.
- Babel has three permanent difficulty stages and loses its newest physical piece when struck.
- Foundation breach uses the two-step loss state.
- Players place Beacons collectively on legal frontier locations.
- Army uses multiple attack dice; player units are abstract, Heavenly units are physical.
- Towers add local support dice only when a player takes an Attack action.
- Shared survival first; individual Prestige only matters if humanity wins.

## Prototype UX requirements

The prototype should make state understandable even if it looks plain.

The board must visually distinguish:

- terrain type;
- rivers and their orientation;
- buildings and ownership;
- Walls;
- Beacons;
- Ophanim Hosts vs Seraphs;
- occupied features;
- Babel stage / piece count.

The side panel should show, per Leader:

- resource hand;
- Prestige;
- Army dice;
- owned buildings;
- Scheme hand.

Always show:

- active player;
- current Confusion;
- legal actions;
- current Tower stage and next escalation;
- a chronological game log.

During tile placement, highlight legal squares and show a projected resource payout before confirmation if practical.

During Attack, show Army dice, Tower support dice, which Host each successful hit is assigned to, and shield state.

## Implementation behaviour

Prefer pure deterministic functions for rules. Randomness should be injected through a seeded RNG so bugs can be reproduced.

Keep UI state separate from authoritative game state. The UI should ask the core for legal moves rather than recreate legality rules itself.

Every complex state transition should emit a structured log entry. Examples: tile payout, harvester trigger, occupation change, Host path choice, Wall break, Tower support hit, Babel strike, stage escalation.

## Tests expected before calling milestone 1 complete

At minimum cover:

- tile adjacency payout;
- foreign harvester payouts and +1 placer bonus;
- occupied feature suppresses payouts;
- river edge legality;
- feature connectivity with river overlays;
- Beacon legality;
- shortest Host path and player tie choice;
- Wall consumes movement then disappears;
- Seraph movement 2 and Shield 1;
- Tower support die only for an occupied feature containing that Tower;
- Babel stage escalation never reverses;
- Babel piece removal;
- Foundation first breach / second breach loss;
- player-count scaling table;
- Confusion and Scheme effects;
- Prestige attribution.

## Explicitly deferred

Do not let these delay the first playable:

- character powers;
- more than the canonical small Scheme / Confusion decks;
- Titles / achievements;
- roads;
- trading between players;
- finite terrain-deck loss;
- campaign/meta progression;
- matchmaking/accounts;
- elaborate animation;
- final art/audio;
- monetisation.

## Suggested first PR

One vertical slice:

1. deterministic square board and tile placement;
2. all five terrain types plus river overlays;
3. connected-feature calculation;
4. resource payout;
5. 2–4 hot-seat turn rotation;
6. minimal browser UI with debug log;
7. tests for all of the above.

Do not try to build the entire game in one unreviewable commit.
