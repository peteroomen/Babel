# BABEL — Final Pre-Canon Modelling Pass

Date: 2026-09-15

## Purpose
Validate the final Tower timing rule and check four gates before canonizing the design:

1. shared win/loss pressure is plausible;
2. selfish Prestige play endangers but does not automatically destroy cooperation;
3. Architect / Commander / Industrialist can all plausibly win Prestige;
4. major mechanics are used and defensive infrastructure is meaningful.

## Final Tower rule tested
Towers no longer act passively during Heaven.

During a player's Attack action, every occupied connected feature containing a Tower contributes one **targeted support die** against a Host in that feature. Tower dice resolve first and use the same `d6 + 2 >= Defence` test as Army dice. The Tower owner gains 1 Prestige for a successful support hit.

Testing only one Tower support die for the entire Attack made defense too weak. Allowing one local die per occupied Tower feature produced the healthier game and matches the spatial fiction.

## Final military model
- Army size = number of attack dice.
- Army starts at 1 die; Muster costs 1 Food + 1 Metal.
- Each die uses `d6 + 2 >= Host Defence`.
- Army dice can be assigned across Hosts globally.
- Standard Hosts need one hit.
- Stage III mixes in ~25% shielded Move-2 Seraphs needing two hits.
- Walls cost 1 Wood per Build action and place two barricades; crossing consumes a movement and destroys the Wall.

## 3-Leader scoring check
Representative final batch with Architect / Commander / Industrialist:

- Shared win rate: about 50% in the final 28-game scoring batch. Other representative compact-Confusion batches landed up to roughly 65%.
- Successful-game average Prestige:
  - Architect: 53.9
  - Commander: 50.5
  - Industrialist: 52.0
- Individual Prestige wins in the scoring batch: 4 Architect / 4 Commander / 6 Industrialist.

Conclusion: no strategy is mathematically locked into winning the Prestige race. This is close enough for pre-alpha; human play is now more valuable than further heuristic tuning.

## Action mix
Representative final scoring batch:

- Attack: 39.5%
- Barter: 21.1%
- Babel: 13.1%
- Build: 12.7%
- Muster: 6.3%
- Scheme: 3.6%
- Pass/other: remainder

All core action types are used. Barter is probably over-used by the bots and is a specific human-playtest watch item.

## Defensive play
- Towers materially contribute to successful attacks and make prepared features easier to reclaim.
- Walls are used situationally; they are not mandatory every round.
- A pure Fortress agent that continually rebuilds Walls is worse than a Commander who mixes Army investment, Towers, Walls and Attack actions.

Conclusion: defensive infrastructure is a real **military style**, not a separate pacifist role. This matches the intended decision: attack now, invest in Army, or spend an action preparing the battlefield.

## Cooperation / selfishness
Across adversarial batches:

- one greedy/selfish player remains survivable and can win Prestige;
- two greedy players sharply reduce shared survival and often kill the run;
- fully selfish tables usually fail.

This is the desired semi-cooperative pressure: selfish play is permitted, but collective neglect has consequences.

## Player-count scaling
Current baseline:

- 2 leaders: 3 Babel pieces/stage, 1/1/2 Beacons, first Beacon Round 3, Host Defence 4/5/6.
- 3 leaders: 5 pieces/stage, 1/2/3 Beacons, first Beacon Round 2, Defence 5/6/7.
- 4 leaders: 6 pieces/stage, 1/3/4 Beacons, first Beacon Round 2, Defence 5/6/7.
- Solo controls two Leaders and uses 2-Leader scaling.

Small batches place these modes in broadly comparable difficulty bands, but round-limit timeouts remain noisy. Player-count tuning should continue with human/real-game telemetry rather than more elaborate heuristic AI.

## Canon decisions from this pass
- Lock Army dice model.
- Lock Towers as Attack-action support dice; no passive Heaven-phase firing.
- Lock temporary Wood Walls.
- Lock rivers as permanent impassable geography.
- Lock Standard Host + late shielded/fast Seraph model.
- Remove recurring Industrialist trigger Prestige; harvester construction is +1 Prestige and the recurring reward is economic.
- Keep Scheme deck to 3 effects / 6 cards.
- Keep Confusion to 6 unique effects / 9 cards at maximum Stage.
- Adopt explicit 2/3/4-leader scaling and solo-as-two-leaders.

## Remaining balance work belongs in the real alpha
- exact tile-bag composition and Lake frequency;
- exact Babel costs if games feel too long;
- whether ~40% Attack actions feels tense or repetitive for humans;
- whether 3:1 Barter is too central;
- Seraph frequency;
- Wall placement quantity/cost;
- visual and UX readability of multiple Hosts/buildings/barriers on one map.
