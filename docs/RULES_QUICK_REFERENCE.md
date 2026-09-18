# BABEL — Quick Rules Reference (Canon v0.4)

Written from `CANON_RULES` in `packages/game-data/src/rules.ts`, which is the
source of truth. Where this page and the GDD disagree, the GDD is the older
document: it describes v0.1, and §§7, 11, 17 and 20 have been overtaken.

The historical balance measurements in this repository predate the repairs
below and must be rerun before they are used to tune the canon.

## Turn
**Draw 1 tile → Place → Resolve resources/buildings → Take 1 action.**

Actions: **Build / Babel / Attack / Muster / Scheme / Pass**.
Barter is free and does not spend the action — once per turn.

## Terrain
- Farmland → Food
- Forest → Wood
- Hills → Brick
- Mountain → Metal
- Desert → nothing

Placement payout = **1 + adjacent matching terrain**.

A Host anywhere in a connected feature shuts down that whole feature's resource
payout and harvesting buildings.

## Harvesting buildings
Sawmill (2 Wood) / Farmstead (1 Wood + 1 Food) / Brickworks (1 Wood + 1 Brick) /
Mine (1 Wood + 1 Metal). **+1 Prestige** to build one.

When another player expands your building's feature:
- placer gets normal payout;
- you get the same payout;
- placer gets **+1 extra matching resource total** if any foreign harvester
  triggered.

One matching harvester per player per connected feature.

## Babel
Cost per piece:
- Stage I: 1 Brick + 1 Wood + 1 Food
- Stage II: 2 Brick + 2 Wood + 1 Metal
- Stage III: 3 Brick + 2 Wood + 2 Metal + 1 Food

Prestige: **2 / 3 / 4** by Stage.

Host reaches Babel → remove newest piece and Host. At 0 pieces, first Host
occupies Foundation; second Host arriving while occupied = shared loss.

## Rivers
River edges must connect. River tiles and Lakes are impassable to Heaven, which
is what makes water the one ground Heaven can never take. Beacons cannot be
placed on them.

### Babel's river — **+1 Prestige** (v0.4)
A fixed Farmland tile north of Babel runs its river into the Foundation. The
connected chain of water reaching Babel is **Babel's river**.

Place a tile that joins that chain **and carries it further from Babel than it
has ever run**, and score **1 Prestige**. Widening the river beside the
Foundation, or branching it sideways, pays nothing — it has to run *further*.

There is no cap. The bag is the cap: you can only extend on a turn it deals you
a river tile that fits.

## Barter
**Free action, once per turn.** Discard **4 of one resource**, take 1 of any.

## Army
Start with **1 Army die**. Muster: **1 Food + 1 Metal → +1 Army die**, max 5.

Attack costs the action but no resources. Roll your Army dice: each is **d6 + 2
vs Host Defence**; a natural 6 always hits. Assign successful dice among any
Hosts, hardest target first — a die that only beat a 6 cannot be spent on a 7.
One success = one hit, and damage persists between turns.

**+1 Prestige** per Host killed.

## Towers
Cost: **2 Wood + 1 Metal**. One per connected feature. **+1 Prestige** to build.

During any player's Attack action, each occupied Tower feature adds **1 targeted
support die** against a Host in that feature. Same d6+2 test. Tower owner gets
**+1 Prestige per successful support hit**. A Warded Host is immune to them.
If a feature has multiple Towers, the attacker selects one Tower for that die;
its owner receives the Prestige. Unselected features use the oldest surviving
Tower.

## Heaven
Existing Hosts move, resolve Babel impacts, then new Hosts arrive.

**Arrivals per Heaven Phase, by Stage: 1 / 2 / 2.** Roll a d6 on the Stage's
table for what comes; the open Beacons say where.

| Stage | What a d6 sends |
|---|---|
| I | Ophanim (6) |
| II | Ophanim (4), Warded (2) |
| III | Ophanim (2), Warded (1), Herald (1), Colossus (1), Swarm (1) |

| Host | Move | Hits | Defence | Note |
|---|---|---|---|---|
| Ophanim | 1 | 1 | base | The one everything else is measured against |
| Warded | 1 | 3 | +2 | Tower dice cannot touch it |
| Herald | 1 | 1 | base | +2 Defence to every other Host in the same feature |
| Colossus | 1 | 4 | +2 | Stops at the first building it reaches and razes it |
| Swarm | 1 | 2 | base | Killing it leaves 3 Ophanim behind |

Where several equally short routes exist, **the table chooses** which one the
Host takes.

## Scheme deck — 6 cards
2× False Prophet — redirect one Host for a phase.
2× Common Tongue — cancel Confusion.
2× Frenzied Works — take one extra non-Scheme action.

Buy blind: **1 Food + 1 Metal**.

## Confusion
Stage I: 2× Silent Workshops, 2× Lost Ledgers, 2× Fractured Command.
Stage II adds Stalled Works + March of Heaven.
Stage III adds Broken Swords.

## Scaling
| Leaders | Pieces/stage | Beacons I/II/III | First Beacon | Defence I/II/III |
|---:|---:|---|---|---|
| 2 | 3 | 1/1/2 | Round 3 | 4/5/6 |
| 3 | 5 | 1/2/3 | Round 2 | 5/6/7 |
| 4 | 6 | 1/3/4 | Round 2 | 5/6/7 |

Solo controls two Leaders and uses 2-Leader scaling.

## Removed in v0.4: Walls

Walls were 1 Wood for two segments on tile edges; a Host crossing one destroyed
it and spent its movement. They are gone. A Wall never changed *where* Heaven
walked, so it only ever did anything if a Host happened to step on that exact
edge — and a table that leaned on them lost more games than one that had none
(47.5% shared wins against 81.7%). The river does the same job better: permanent,
free, on a tile you were placing anyway, and it scores.

The rule is still implemented as a variant. `walls: CANON_WALLS` puts it back.
