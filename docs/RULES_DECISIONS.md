# Rules decisions log

`README.md` asks that a rule which blocks implementation be **documented rather
than silently redesigned**. This file is that record. Each entry names the
canon it interprets, the reading adopted, and why.

Nothing here overrides `docs/GDD.md`. Where canon is explicit, canon wins.

---

## RD-001 — River edge matching is symmetric

**Canon:** GDD §7. "If a river edge touches an existing tile, that edge must
meet another river edge." Also: "A river may point into unexplored space."

**Problem:** stated one-directionally. Read literally it constrains a new
tile's *river* edges but says nothing about its *plain* edges, which would let
a plain edge dead-end an existing river.

**Decision:** legality is symmetric. For every edge shared with an already
placed tile, `hasRiver(new, edge)` must equal `hasRiver(existing, edge)`. Edges
facing empty space are unconstrained, preserving "may point into unexplored
space".

**Status:** approved 2026-09-15. Implemented in Milestone 1.

---

## RD-002 — An unplaceable tile is discarded and redrawn

**Canon:** none. GDD §6 requires a legal placement but never says what happens
when a drawn tile has none.

**Problem:** RD-001 makes this reachable. A river tile can be drawn when no
open square accepts its geometry in any of four rotations — more likely early,
when the board is small.

**Decision:** if a drawn tile has no legal placement under any rotation,
discard it, emit a log event, and draw again. The tile bag is drawn with
replacement (RD-003), so nothing is exhausted. Repeat until a placeable tile
appears.

**Watch:** if this fires often in play it is evidence the river bag is wrong,
not that the rule is wrong. Milestone 6 telemetry should count it.

**Status:** adopted for the prototype. Flagged for playtest review.

---

## RD-003 — The tile bag is authored, and drawn with replacement

**Canon:** GDD §22 gives terrain percentages (24 / 24 / 22 / 16 / 14) and river
chances (~23% of Farmland/Forest, ~10% of Mountains are sources). §22 also
states a finite terrain deck is deliberately not a loss condition.

**Problem:** percentages are not a bag. Nothing specifies which of a tile's
four edges carry river geometry per shape, nor the mix of straight / bend /
T-junction / source / terminator.

**Decision:** draw with replacement from weights rather than shuffling a finite
deck — this follows directly from "not a loss condition". River geometry is
authored in `packages/game-data` to hit §22's stated frequencies, marked as
invented-to-spec rather than canon, and tuned from playtest.

**Status:** approved 2026-09-15. Terrain weights landed in Milestone 0; river
shapes land in Milestone 1.

---

## RD-004 — Lake is defined but never drawn

**Canon:** GDD §3 and §7 define Lake as a river terminator. §22: "Lake
frequency has not yet been modelled", and the five listed percentages already
sum to 100.

**Decision:** Lake exists in the type system and renders, at draw weight 0.
Enabling it is a one-line tuning change once a frequency is chosen.

**Status:** implemented in Milestone 0.

---

## RD-005 — Collective decisions resolve by majority, ties by seeded coin flip

**Canon:** GDD §13 (Beacon siting) and §14 (choosing between equally short Host
routes) both say the players choose together. No arbiter is named.

**Problem:** "the table agrees" works in hot-seat and is unimplementable over a
network, where a deadlocked table has no resolution.

**Decision:** every Leader casts a ballot; the majority option wins; a tie is
broken by a coin flip drawn from the game's seeded RNG. Leaders may change
their ballot until the last one is cast. Because the flip comes from the
seeded RNG, the outcome is deterministic and replays identically.

**Note:** this deliberately does not change the *social* experience in
hot-seat, where players will still talk it out before voting. It exists so the
rule is total.

**Status:** approved 2026-09-15. Implemented in Milestone 0.

---

## RD-006 — A merged feature pays each owner once

**Canon:** GDD §9. "A player may own at most **one** harvesting building of a
given type in the same connected feature." Each foreign building owner is paid
the placer's base payout.

**Problem:** a placement can merge two features in which the same Leader holds
one matching building each. The per-feature limit was never violated when they
were built, and canon does not say what the merged feature pays them.

**Decision:** pay that Leader once. The rule's intent is one trigger per player
per feature, and paying twice would make deliberately engineered merges a
stronger play than the harvesting economy itself.

**Status:** adopted 2026-09-15. Implemented in Milestone 2 and covered by a
test in `harvest.test.ts`.

---

## RD-007 — A Prestige tie leaves no individual winner

**Canon:** GDD §2. "If humanity completes Babel, the player with the most
Prestige wins individually." Ties are not mentioned.

**Decision:** humanity still wins the shared game; the `humanityWins` event
lists every Leader tied on top, and no single individual winner is recorded.
Titles and tie-breakers are deferred content (GDD §20, §23), so inventing a
tie-break now would pre-empt a design decision.

**Status:** adopted 2026-09-15. Implemented in Milestone 2.
