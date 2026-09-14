# BABEL — Canonical Game Design Document

**Version:** 0.1 pre-alpha canon  
**Date:** 2026-09-15  
**Format:** digital-first board game, solo / 2–4 player cooperative-competitive  

> Humanity is building the Tower of Babel to reach Heaven and kill a tyrannical God. The players are rival leaders of the city beneath the Tower. Everyone must help Babel survive long enough to reach Heaven; if humanity succeeds, the leader with the most **Prestige** is remembered as its greatest hero.

This document freezes the core rules that survived the design conversation and software modelling pass. Numbers marked **TUNEABLE** are balance values, not unresolved mechanics.

---

## 0. Tone, world and visual flavour

**Working title:** BABEL.

The premise is intentionally irreverent: humanity is building Babel to storm Heaven and kill a tyrannical God. The tone should be **funny, cartoonish, defiant and visually strange**, not grimdark or faux-scriptural. Think civic works project, revolutionary hubris and cosmic bureaucracy colliding. The humans should feel scrappy and ambitious; Heaven should feel terrifying in silhouette but just ridiculous enough to stay playful.

The visual enemy language takes loose inspiration from the modern "biblically accurate angel" aesthetic without claiming literal theological accuracy:

- **Ophanim Host** — the standard Heavenly force. A readable cartoon mass of concentric halo/wheel forms, too many eyes, small wings and offended divine authority. Mechanically this is the normal 1-hit, Movement-1 Host.
- **Seraph** — the late-game elite. A tall six-winged blazing form with a shielded core, more imposing and less comic at a glance. Mechanically this is the Movement-2, Shield-1 Host that requires two successful hits.

Keep the base roster to these two enemy silhouettes for the first playable. Variety should come from board state, geography and escalation before content bloat.

Babel's three stages may use light flavour labels in UI without adding rules:

1. **Foundation of Defiance**
2. **The Great Ascent**
3. **The Siege of Heaven**

Confusion and Scheme cards are the best place for jokes and flavour text. Keep names short and mechanically legible. The theme should support the game, not require lore reading.

## 1. Design pillars

1. **The shared map is the game.** Economy, invasion paths, defensive geography and player interaction all emerge from tile placement.
2. **Cooperate to survive; compete to be remembered.** Humanity wins or loses together. Prestige determines the individual winner only after a shared victory.
3. **Every tile placement has multiple consequences.** It should affect personal resources, other players' engines, and the geography Heaven must traverse.
4. **One meaningful action.** Turns stay restrictive and board-game legible: draw/place/resolve, then one action.
5. **Babel is progress and health.** The Tower physically grows, permanently escalates Heaven, and can be smashed back piece by piece.
6. **Defense must be spatial.** Armies are flexible; Towers reward prepared ground; Walls buy time; rivers permanently shape routes.
7. **Confusion changes the round.** Confusion effects are few, strong and easy to remember.
8. **No strategy is a class.** Architect, Commander and Industrialist are viable strategic identities, but players can move between them.

---

## 2. Shared victory, loss and Prestige

### Shared victory
Complete the final piece of Babel.

Babel always has **three Stages**. The number of pieces per Stage scales with player count (see Section 4).

Reaching the end of Stage I or Stage II permanently escalates Heaven. If Heaven later destroys Tower pieces, the escalation does **not** reverse.

### Host reaches Babel
If Babel has at least one completed piece:

1. Remove the most recently built Babel piece.
2. Remove the Host that struck Babel.

If Babel has **zero** pieces:

1. The first Host to reach Babel occupies the **Foundation**.
2. Babel cannot be built while the Foundation is occupied.
3. Players may Attack the occupying Host normally.
4. If a second Host reaches an already occupied Foundation, **humanity loses immediately**.

### Individual victory
If humanity completes Babel, the player with the most Prestige wins individually.

In solo mode, Prestige is a performance score rather than an internal competition.

---

## 3. Board layers

The board has three spatial layers plus Babel.

### Layer 1 — Land tiles
Square tiles form the world.

| Terrain | Resource |
|---|---|
| Farmland | Food |
| Forest | Wood |
| Hills | Brick |
| Mountain | Metal |
| Desert | None |

A **Lake** is a special non-resource water tile used as a river terminator. Exact frequency is TUNEABLE.

### Layer 2 — Barriers
- **Rivers** are permanent natural barriers.
- **Walls** are temporary player-built barricades placed on edges between land tiles.

Roads are not part of the base game.

### Layer 3 — Buildings
Buildings sit on land tiles. Land is communal; buildings are player-owned.

There is normally **one building per land tile**.

### Babel
Babel occupies the centre and is neither terrain nor a normal building. It is represented as a physically/digitally growing monument.

---

## 4. Player-count scaling

The game intentionally scales the **Tower burden and Heaven pressure**, rather than pretending one ruleset works unchanged at every count.

### Solo
A solo player controls **two Leaders** with separate resource hands, buildings, Armies and turns, using the 2-Leader setup below. Prestige is summed for a final solo score.

### Canonical starting scale

| Leaders | Pieces / Stage | Total Babel pieces | Beacons by Stage I / II / III | First Beacon | Host Defence I / II / III |
|---:|---:|---:|---|---|---|
| 2 | 3 | 9 | 1 / 1 / 2 | End of Round 3 | 4 / 5 / 6 |
| 3 | 5 | 15 | 1 / 2 / 3 | End of Round 2 | 5 / 6 / 7 |
| 4 | 6 | 18 | 1 / 3 / 4 | End of Round 2 | 5 / 6 / 7 |

These values are the current **TUNEABLE balance baseline** from simulation.

The design principle is that the first contact with Heaven happens after roughly six player tile placements, and that total Tower work grows with the table's action/resource economy.

---

## 5. Starting state

- Place the Babel Foundation at the centre.
- Place one fixed **Farmland + straight river** tile immediately north of Babel. Its river runs north–south and feeds Babel.
- Each Leader begins with:
  - 2 Wood
  - 1 Food
  - Army size 1
  - 0 Prestige
- No Beacon exists at setup.
- Randomise the First Player.

---

## 6. Terrain placement and geographic features

### Blind draw
At the start of every player turn, draw **one random terrain tile**. There is no tile market in the base game.

Characters and Schemes may later bend this randomness.

### Legal placement
A tile:

- must be orthogonally adjacent to the existing board or Babel;
- may be rotated freely before placement;
- must obey river-edge matching rules.

### Geographic feature
A **feature** is an orthogonally connected group of the same base terrain.

Example: seven connected Forest tiles are one Forest feature.

River overlays do not split terrain connectivity.

### Placement payout
When an unoccupied resource terrain tile is placed:

**Base payout = 1 + number of orthogonally adjacent tiles of the same terrain.**

Examples:

- isolated Forest = 1 Wood
- Forest touching two Forests = 3 Wood
- Hills touching three Hills = 4 Brick

Desert and Lake give no resource.

---

## 7. Rivers and Lakes

Rivers are printed through tile centres and connect through tile edges.

Base river shapes include:

- straight
- bend
- T-junction
- Mountain source
- Lake terminator

River variants primarily appear on Farmland and Forest. Some Mountains are sources.

### River continuity
If a river edge touches an existing tile, that edge must meet another river edge. A river may point into unexplored space.

This means a newly revealed tile may show only one segment of a larger unseen river.

### Heaven and water
A Heavenly Host **cannot enter a river or Lake tile**.

Rivers therefore permanently shape the invasion map.

A Beacon cannot be placed on water/river terrain and must always have a legal land route to Babel when placed.

No Bridge rule exists in the base game.

---

## 8. Resources

Resources are represented as cards even in the digital game.

### Food
Represents manpower. Used for Babel and increasing Army size.

### Wood
Basic construction. Used heavily for harvesting buildings, Towers and Walls.

### Brick
The Tower resource. Brick is overwhelmingly for Babel.

### Metal
Advanced construction and war. Used for Army growth, Mines, Towers and Schemes.

### No direct trade
Players cannot freely hand resources to one another.

### Barter
**Action:** discard any 3 resource cards in any combination to gain 1 resource card of your choice.

This is deliberately inefficient. It is bad luck protection, not the primary economy.

---

## 9. Harvesting buildings and shared industry

### Base harvesting buildings

| Terrain | Building | Current cost |
|---|---|---|
| Forest | Sawmill | 2 Wood |
| Farmland | Farmstead | 1 Wood + 1 Food |
| Hills | Brickworks | 1 Wood + 1 Brick |
| Mountain | Mine | 1 Wood + 1 Metal |

Costs are **TUNEABLE**.

A player may own at most **one harvesting building of a given type in the same connected feature**. Different players may each invest in that feature.

### Foreign expansion trigger
When another player places a tile that expands a feature containing your matching harvesting building, provided the feature is not occupied:

1. The placing player gets their normal base payout.
2. **Each foreign building owner** gets that same base payout in the matching resource.
3. If one or more foreign harvesting buildings triggered, the placer gains **+1 extra matching resource total**. This +1 does not stack with the number of owners/buildings.

Your harvesting building does not trigger from your own tile placement.

Example:

Ada places a Forest touching two Forests, so the base payout is 3 Wood. Peter and Rook each own a Sawmill in that Forest.

- Ada gets 3 Wood + 1 infrastructure bonus = 4 Wood.
- Peter gets 3 Wood.
- Rook gets 3 Wood.

This is intentionally powerful: shared industrial features reward cooperation, but one Host can shut down the entire feature.

### Prestige
Constructing a harvesting building gives **+1 Prestige**.

Harvesting triggers themselves do **not** repeatedly award Prestige in the canonical prototype; their recurring reward is economic power and the +1 help given to the placer.

---

## 10. Occupation

If any Host occupies any tile belonging to a connected terrain feature, the **whole feature is occupied**.

While occupied:

- tile placements into that feature give no normal resource payout;
- harvesting buildings in that feature do not trigger.

Defensive Towers still function for combat support.

When the last Host leaves/is defeated, the feature immediately returns to normal.

This is the core economic reason to fight Heaven before it reaches Babel.

---

## 11. Round and turn structure

### Round
1. Reveal one **Confusion** card.
2. Players take turns clockwise from the First Player.
3. Resolve the **Heaven Phase**.
4. Pass the First Player marker clockwise.

### Player turn
1. Draw one terrain tile.
2. Place it legally.
3. Resolve terrain and harvesting effects.
4. Take exactly **one action**.

### Actions
- **Build** — construct one building or a Wall set.
- **Babel** — add one complete Tower piece.
- **Attack** — roll your Army and any Tower support dice.
- **Muster** — increase Army size.
- **Scheme** — buy one blind Scheme card.
- **Barter** — convert 3 resources into 1.
- **Pass**.

One-action scarcity is core to the design.

---

## 12. Babel construction

A Babel action builds exactly **one complete piece**. There is no partial piece construction.

### Cost per piece — TUNEABLE baseline

| Stage | Cost |
|---|---|
| I | 2 Brick + 1 Food |
| II | 4 Brick + 1 Food |
| III | 6 Brick + 2 Food |

### Permanent escalation
When the final piece of Stage I is built:

- Stage II begins permanently.
- Stage-II Host Defence applies.
- Stage-II Beacon count is established.
- Stage-II Confusion cards are added.

The same happens at the end of Stage II for Stage III.

If Heaven later knocks Babel below the threshold, the stronger Heaven rules remain.

### Babel Prestige
The player who adds a Babel piece gains:

- Stage I: **2 Prestige**
- Stage II: **3 Prestige**
- Stage III: **4 Prestige**

---

## 13. Beacons and Host spawning

Beacons are physical markers placed by the players. They are the places Heaven descends into the world.

### Placing a Beacon
The players collectively choose its location.

A valid Beacon site:

- is an existing frontier land tile;
- is not a river/Lake tile;
- has at least one legal land route to Babel.

Players are therefore encouraged to create distant sacrificial terrain and intentional invasion lanes before new Stages begin.

### Beacon timing
Beacon counts are determined by player-count scaling in Section 4.

When a Stage requires additional Beacons, place them immediately after the Babel piece that triggered the Stage is completed.

### Heaven Phase order
1. Existing Hosts move.
2. Resolve Hosts that reach Babel.
3. Every Beacon spawns one new Host.

Multiple Hosts may occupy the same tile if movement delays cause them to stack.

---

## 14. Heavenly movement

### Ophanim Host
- Movement: **1 tile per Heaven Phase**.
- Hits required: **1**.
- Defence: determined by Stage/player count.

An Ophanim Host follows a **shortest legal land route to Babel**.

If several equally short routes exist, the players choose which valid route the Host takes. Schemes can break this rule.

### Tier-III Seraph — TUNEABLE frequency
At Stage III, approximately **25%** of newly spawned Hosts are Seraphs.

A Seraph has:

- the same Stage Defence;
- **Shield 1** — it requires two successful hits total;
- **Movement 2**.

The first successful hit removes its Shield. The second kills it. A removed Shield remains removed between turns.

Seraph frequency is a balance parameter, not a separate enemy subsystem.

---

## 15. Army and Attack actions

Player armies are abstract. There are no player unit tokens moving around the map.

### Army size
Each Leader starts with **1 Army die**.

**Muster action:** spend 1 Food + 1 Metal to gain +1 Army die.

Current intended maximum: **5 Army dice**.

### Attack
When you choose Attack:

1. Resolve eligible Tower support dice (Section 16).
2. Roll all of your Army dice.
3. Each Army die is resolved independently as **d6 + 2** against a Host's Defence.
4. After rolling, assign successful dice among any Hosts on the board.
5. Each successful die deals one hit.

A die can hit only one Host.

This makes a developed Army capable of fighting multiple fronts, but late-game shields and multiple Beacons ensure one player cannot automatically erase Heaven every round.

### Combat Prestige
When a Host is killed during your Attack action, gain **+1 Prestige**.

---

## 16. Defensive Towers

**Current cost:** 2 Wood + 1 Metal. **TUNEABLE.**

At most **one Tower may defend a connected terrain feature**.

### Tower support
Towers do **not** fire automatically during Heaven's turn.

When any player takes an Attack action:

- for each occupied terrain feature containing a Tower, roll **one extra Tower support die**;
- that die is committed to a Host occupying that same feature;
- resolve Tower support dice before Army dice;
- Tower support uses the same combat test: **d6 + 2 vs Host Defence**;
- a successful support die deals one hit and can remove a Seraph Shield.

A Tower is communal defense: any player's Attack action can benefit from it.

### Tower Prestige
Whenever a Tower support die scores a successful hit, the Tower's owner gains **+1 Prestige**.

If that hit kills the Host, the attacking player also receives the normal +1 combat Prestige. These may be the same player.

The purpose of Towers is to make prepared ground more efficient without replacing the need to spend an Attack action.

---

## 17. Walls

Walls are temporary barricades, not permanent pathfinding blockers.

### Build Walls
**Build action:** spend **1 Wood** to place **2 Wall segments** on edges between adjacent land tiles.

Cost and quantity are **TUNEABLE**, but this is the current model baseline.

### Host crossing a Wall
When a Host would move across a Wall:

1. destroy/remove that Wall;
2. that movement is spent;
3. the Host remains on its current tile.

A normal Movement-1 Host therefore loses the whole Heaven Phase at the Wall.

A Movement-2 Seraph may destroy the Wall with its first movement and cross with its second.

Walls are meant to buy time and hold enemies in defended features, not permanently seal Heaven away.

### Wall Prestige
A Build Walls action gives **+1 Prestige**.

Defensive play is intentionally a hybrid of Army + Towers + situational Walls, not a fourth player who does nothing except rebuild barricades.

---

## 18. Schemes — compact prototype deck

**Buy Scheme action:** spend 1 Food + 1 Metal and blind-draw one Scheme.

The prototype deck contains only **three effects**, with two copies of each (6 cards total). Reshuffle the discard when empty.

### False Prophet ×2
During the Heaven Phase, when one Host would move, choose any adjacent legal tile for it instead of following the shortest route. It may move sideways or away from Babel. This replacement movement ends that Host's movement for the phase.

### Common Tongue ×2
Play immediately after Confusion is revealed. Cancel that Confusion card for the round.

### Frenzied Works ×2
After completing your normal action, immediately take one additional action. The bonus action cannot Buy a Scheme.

Schemes should feel powerful and rule-breaking. Direct theft and nastier interaction can be added only after the base game proves it needs them.

---

## 19. Confusion — compact escalating deck

Confusion replaces a generic Event deck. Reveal exactly one card each round.

Confusion should change the round in one sentence. Avoid arithmetic modifiers and fiddly exceptions.

### Stage-I starting deck — 6 cards
Two copies each:

**Silent Workshops**  
Harvesting buildings do not trigger this round.

**Lost Ledgers**  
The player placing a terrain tile receives no normal base terrain payout this round. Foreign harvesting buildings still resolve normally.

**Fractured Command**  
Each action category may be chosen by only one player this round. Once somebody has Attacked, nobody else may Attack; once somebody Builds, nobody else may Build; etc.

### Add at Stage II — 2 cards

**Stalled Works**  
Nobody may take the Babel action this round.

**March of Heaven**  
Every existing Host gets +1 movement during this Heaven Phase.

### Add at Stage III — 1 card

**Broken Swords**  
Nobody may take the Attack action this round.

At each Stage transition, shuffle the new card(s) into the remaining deck. When the draw pile empties, reshuffle the discard pile.

This produces only **six unique Confusion effects/cards types** and nine physical/digital cards at maximum difficulty.

---

## 20. Prestige and viable strategies

The base game currently supports three primary Prestige identities plus defensive variation.

### Architect
- Babel piece Prestige: 2 / 3 / 4 by Stage.
- Prioritises Brick/Food and timing Stage escalation.

### Commander
- +1 Prestige per Host killed during their Attack action.
- Builds Army size and uses Attack actions efficiently across multiple fronts.

### Industrialist
- +1 Prestige when constructing a harvesting building.
- Gains recurring resource payouts when other players expand invested features.
- Helps other players by giving the placer +1 matching resource when shared infrastructure triggers.
- Usually converts that superior economy into Babel, defensive construction or Schemes rather than receiving automatic recurring Prestige.

### Defender / fortified Commander
- +1 Prestige for building a Tower.
- +1 Prestige for a Build Walls action.
- +1 Prestige whenever their Tower support die scores a hit.

This is **not** intended as a fully separate class. Modelling showed that pure wall-building is weak; successful defensive play combines military readiness with prepared geography.

### Titles
Contested endgame/public Titles remain deferred. They are not needed to make the three current scoring paths competitive in the model.

---

## 21. Current balance snapshot

The final pre-alpha simulation is a heuristic model, not proof of balance. It exists to catch obvious dominance and structural failure.

### 3-Leader baseline
With Architect / Commander / Industrialist agents under the canonical Tower rule and compact Confusion deck:

- shared wins generally landed around **50–65%** across representative batches;
- failed games were a mix of actual defeat and the simulator's conservative round-limit timeout;
- successful-game average Prestige in the final scoring pass was approximately:
  - Architect: **53.9**
  - Commander: **50.5**
  - Industrialist: **52.0**
- individual Prestige wins in that representative batch split **4 / 4 / 6**, rather than one strategy winning every time.

### Action use
A representative final batch spent approximately:

- Attack: **39.5%**
- Barter: **21.1%**
- Babel: **13.1%**
- Build: **12.7%**
- Muster: **6.3%**
- Scheme: **3.6%**
- Pass/other: remainder

Barter usage is probably overstated by the heuristic bots and should be watched in human playtests.

### Cooperation pressure
Modelled selfishness behaved directionally correctly:

- one selfish/greedy Leader can coexist with cooperative teammates and sometimes win Prestige;
- two selfish Leaders sharply reduce humanity's survival rate;
- fully selfish tables usually collapse.

### Defense
The final Tower rule materially affects combat while preserving action scarcity. Walls are situational rather than mandatory. A pure Fortress bot overbuilt defenses and performed poorly; hybrid Army + defensive infrastructure performed better and is the intended defensive style.

### Player count
The scaling table in Section 4 brought 2-, 3- and 4-Leader modes into broadly comparable difficulty bands in small batches. Exact win rates remain a **real-alpha tuning problem**, especially timeout/game length.

---

## 22. Tile distribution — TUNEABLE prototype baseline

The software model currently approximates:

- Farmland: 24%
- Forest: 24%
- Hills: 22%
- Mountain: 16%
- Desert: 14%

River chance:

- about 23% of Farmland/Forest tiles contain river geometry;
- about 10% of Mountains are river sources.

Lake frequency has not yet been modelled.

A finite terrain deck is deliberately **not** a loss condition yet.

---

## 23. Deferred ideas

Do not add these merely because they are appealing. Add them after a playable alpha establishes a need.

- Characters / leader powers. Strong direction: once-per-Stage abilities such as a Geologist choosing a terrain type instead of drawing blindly.
- Priest / Faith as a fourth full strategy.
- Prestige Titles such as Master Architect or Lord Commander.
- Direct player-to-player resource trading.
- More Scheme cards, including theft/sabotage.
- Roads.
- Bridges.
- A generic upgrade tree.
- Harvest-as-an-action.
- Terrain exhaustion as a loss clock.
- More enemy classes beyond Standard Host and Seraph.

---

## 24. What the first real game build must validate

1. Is **Draw → Place → Resolve → One Action** satisfying repeatedly in actual play?
2. Does the map remain readable once rivers, buildings, Walls, Beacons and Hosts overlap?
3. Do players intentionally shape invasion lanes rather than merely maximise resource adjacency?
4. Does occupation happen often enough to matter without making the economy feel constantly disabled?
5. Do Towers and Walls create clever defensive turns without replacing Attack actions?
6. Is ~40% of actions being spent on Attack too high for humans, or appropriately tense?
7. Is Barter actually used as often as the bots use it?
8. Does Stage escalation create the desired "are we ready to build the next piece?" table conversation?
9. Does selfish Prestige play generate negotiation without encouraging griefing that trivially throws the shared game?
10. Are 2-, 3- and 4-Leader games similar enough in length and tension after real-player strategy replaces heuristic bots?

---

## 25. Core rules in one paragraph

Reveal a Confusion card. On your turn, blindly draw and place one square terrain tile, gaining its adjacency-based resource payout and triggering any foreign harvesting infrastructure in the connected feature, then take exactly one action: Build, Babel, Attack, Muster, Scheme, Barter or Pass. Players jointly build Babel while individually earning Prestige. Heaven descends from player-placed Beacons; Hosts physically advance toward Babel, occupying connected resource features and shutting their economies down. Armies are pools of attack dice, Towers add local support dice during Attack actions, Walls sacrifice themselves to consume enemy movement, and rivers permanently shape invasion routes. Babel's three Stages grow progressively more expensive and permanently strengthen Heaven. If humanity completes Babel, everyone survives and highest Prestige wins; if Heaven breaches an empty Foundation twice, everyone loses.
