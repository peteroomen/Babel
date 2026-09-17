# Known defects

Bugs found and not yet fixed, with enough evidence to act on without
rediscovering them. This is not the roadmap — `IMPLEMENTATION_PLAN.md` is —
and it is not for interpretations of under-specified canon, which are
`RULES_DECISIONS.md`. It is for places where the code does not do what the
rules say it does.

## D-001 — Only a Seraph survives its first hit

**Found:** 2026-09-17, during Milestone 7.
**Where:** `applyHit`, in `packages/game-core/src/combat/index.ts`.
**Severity:** balance. Four of the eight Host kinds are far weaker than the
spawn table assumes.

`HostSpec.hits` says how many successful hits a kind takes to kill, and four
kinds ask for more than one:

| Kind | `hits` | Killed by one hit? |
| --- | --- | --- |
| Ophanim | 1 | yes, correctly |
| Seraph | 2 | no, correctly — the Shield takes the first |
| Zealot | 2 | **yes** |
| Swarm | 2 | **yes** |
| Warded | 3 | **yes** |
| Colossus | 4 | **yes** |

`applyHit` only knows about the Shield: a Host with the `shield` flag and its
Shield still up loses the Shield, and *every other hit kills*. Nothing else
counts damage, and `Host` has no field in which damage could be counted.

It compounds: `validateAssignments` correctly allows up to `hitsRemaining(host)`
hits to be assigned to a target, so a player may commit four dice to a Colossus,
the first kills it, and the other three are silently discarded. `hitsRemaining`
and `applyHit` disagree about the same rule.

### Why it is still here

Milestone 7 is a visual pass with no rule changes, and this is a rule change
with teeth. Every number in `docs/MILESTONE_6_BASELINE.md` — the 67% shared win
rate that made v0.3 canon, the arrival mix, the Stage III composition — was
measured against this behaviour. Making Colossus take four hits makes Heaven
substantially stronger than any measurement we have.

Milestone 7 did make it easier to *see*: every Host now shows the Defence a die
must beat while hits are being assigned, and hits are dragged onto a target one
at a time, so a Colossus dying to a single die is now something a player
watches happen.

### What fixing it needs

1. Somewhere to keep damage. Either a `damage` counter on `Host`, or spend
   `hits` down as they are taken. It must survive between turns the way a
   broken Shield does (GDD §14), and it must be serializable, since `GameState`
   is.
2. `applyHit` consuming one hit rather than assuming a kill, with `hostKilled`
   emitted only on the last one. `hitsRemaining` then becomes the single answer
   both it and `validateAssignments` read.
3. The board showing it. A Colossus on its fourth hit and one on its first look
   identical today; if they take four, they must not.
4. A re-run of the Milestone 6 sweep before it becomes canon. This will move
   the win rate and it is not obvious by how much — the harness exists for
   exactly this question, and `ARRIVALS_BY_STAGE` or the spawn weights may have
   to come down to pay for it.

Sequence it before Milestone 8: the five-Stage curve is meant to introduce one
new Host kind per Stage, and measuring that curve against kinds that die to one
hit measures the wrong thing.
