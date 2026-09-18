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

---

## RD-008 — Host route ties use an overridable default, not a vote

**Canon:** GDD §14. "If several equally short routes exist, the players choose
which valid route the Host takes."

**Problem:** on a square grid, shortest routes to Babel tie constantly — most
Hosts, most phases. Putting RD-005's formal vote on every tie would mean
several votes per Heaven Phase, every round, which is unplayable.

**Decision:** the core computes a deterministic default route for every Host
from the seeded RNG, and exposes the alternatives through `stepOptions` so the
table can override any of them before confirming the phase. One click resolves
a phase nobody wants to change; the choice is still there when it matters.
An override that is not a legal shortest route is ignored rather than
rejected, so a malformed plan cannot corrupt the phase.

RD-005's majority-with-coin-flip still stands for decisions with a small,
discrete option set, and remains implemented and tested for networked play.

**Status:** adopted 2026-09-15. Implemented in Milestone 3.

---

## RD-009 — A Beacon with nowhere legal to go is deferred

**Canon:** GDD §13 requires a Beacon site to be a frontier land tile, not
river or Lake, with at least one legal land route to Babel. §4 fixes when
Beacons are owed.

**Problem:** early on, or on a waterlogged map, no tile satisfies all three.
Canon does not say what happens, and the game cannot simply stall.

**Decision:** the Beacon is deferred, logged as `beaconDeferred`, and offered
again at the next opportunity. Heaven arrives when the geography allows it.
This also quietly rewards players who keep the frontier hostile — which is the
behaviour §13 says Beacons are meant to encourage.

**Watch:** if deferral happens often it means the river bag is too wet, not
that the rule is wrong. Milestone 6 telemetry should count it.

**Status:** adopted 2026-09-15. Implemented in Milestone 3.

---

## RD-010 — A Build Walls action places fewer than two only when it must

**Canon:** GDD §17. "Build action: spend 1 Wood to place 2 Wall segments on
edges between adjacent land tiles."

**Problem:** early on, or on a nearly-empty board, fewer than two legal edges
may exist. Canon assumes two are always available.

**Decision:** the action places two segments, or every legal edge if fewer than
two exist. It still costs 1 Wood and still pays its +1 Prestige, because the
action's scarcity is the cost, not the number of planks. The action is not
offered at all when no legal edge exists.

**Status:** adopted 2026-09-15. Implemented in Milestone 4.

---

## RD-011 — A Tower support die targets the lowest-id Host in its feature

**Canon:** GDD §16. "For each occupied terrain feature containing a Tower, roll
one extra Tower support die; that die is committed to a Host occupying that
same feature."

**Problem:** canon says the die is committed to *a* Host in the feature, but
never says who chooses which. With several Hosts stacked in one feature that is
ambiguous.

**Decision:** it targets the lowest-id Host in that feature — that is, the one
that has been on the board longest. Deterministic, replayable, and it avoids
handing the attacker an extra micro-decision on every single Attack, on top of
the Army dice assignment they already make.

**Watch:** if play shows that choosing the Tower's target matters (holding a
shielded Seraph rather than finishing an Ophanim, say), this should become a
real choice in the assignment step rather than a default.

**Status:** adopted 2026-09-15. Implemented in Milestone 4.

---

## RD-012 — Lost Ledgers removes the base payout, not the harvest bonus

**Canon:** GDD §19. "The player placing a terrain tile receives no normal base
terrain payout this round. Foreign harvesting buildings still resolve
normally." GDD §9 gives the placer **+1 extra matching resource** when any
foreign harvesting building triggers.

**Problem:** the +1 goes to the placer, but it is part of the harvest trigger
rather than the base payout. Canon cancels one and explicitly preserves the
other, without saying which the +1 belongs to.

**Decision:** the +1 survives. §19 cancels "the normal base terrain payout" by
name, and says the foreign buildings "still resolve normally" — the +1 is part
of how they resolve. This also keeps the card interesting rather than flatly
punishing: under Lost Ledgers, expanding a feature somebody else has invested
in is the only way a placer gets paid at all.

**Status:** adopted 2026-09-15. Implemented in Milestone 5.

---

## RD-013 — Passing is exempt from Fractured Command

**Canon:** GDD §19. "Each action category may be chosen by only one player this
round." GDD §11 lists Pass among the seven action categories.

**Problem:** read literally, once one Leader passes nobody else may. A Leader
who cannot afford any remaining category would then have no legal move at all,
and the round would deadlock with no rule to break the tie.

**Decision:** Pass is always available. Every other category is restricted as
written. The card's intent is to stop the table converging on the same strong
action, and nobody converges on passing.

**Status:** adopted 2026-09-15. Implemented in Milestone 5, and covered by a
test that builds the deadlock case explicitly.

---

## RD-014 — One selected Tower supplies support per merged feature

**Canon:** GDD §16 grants one targeted support die for each occupied feature
containing a Tower.

**Problem:** separate physical Towers can end up in one connected feature, but
the text does not say whether each building fires or which owner receives the
support Prestige.

**Decision:** preserve every physical building, while allowing the attacker to
select one Tower in each occupied feature. If no selection is supplied, the
oldest surviving Tower (the first building in board state order) is used. The
selected Tower's owner receives Prestige for a successful support hit.

**Status:** adopted for implementation review 2026-09-17. The UI asks only when
a feature has multiple Towers; other callers use the deterministic fallback.
