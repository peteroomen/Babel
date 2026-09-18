# Next work after Host-bank adoption

Updated 2026-09-18. This ordering supersedes the historical “Next” labels in the milestone plan. It is a work queue, not approval of further rule changes.

The adopted direction is Host-only riverbanks and the fixed mountain-source Beacon. Resource features, occupation, harvesters, Tower support and Herald auras retain their existing terrain-feature scope. The player-count spawn cadence is unchanged. The bank-resource experiment remains available as evidence, not canon.

## 1. Make the bots a more reliable measuring instrument

**Next coding priority; medium scope.** Diagnose the Merchant policy before changing difficulty again. In the 60-game two-player Host-bank cell, Merchant teams produced 1 win, 12 losses and 11 timeouts out of 24 games. Other teams produced 32 wins, 3 losses and 1 timeout out of 36. This is a limitation of the model, not a prediction about human play.

The policy currently prioritises buying Schemes over Babel, while the collective driver only plays Common Tongue. The driver declines Frenzied Works; hit assignment also needs review for threat priority rather than simply difficult targets. These are concrete investigation leads, not established explanations for every timeout.

Work:

- Record Scheme purchases, uses and unused hands; Babel opportunities declined; resource shortages; and repeated action loops in stalled games.
- Preserve the existing policy as a named historical model so the 540-game comparison remains reproducible.
- Improve card use and cooperative survival decisions while keeping the archetypes distinct. Check Tower placement for actual useful coverage.
- Replay the known stalls, then compare old and revised policies on fresh paired seeds across all counts. Keep wins, losses and timeouts separate; report roster effects.

Exit: no unexplained card-buying or infrastructure loop substitutes for pursuing the shared objective. Publish revised bot baselines before drawing another difficulty conclusion. Do not tune the game merely to make the weakest bot win.

## 2. Make the first family playtest practical

**Can proceed alongside model work; medium scope.** The browser currently keeps game state in React memory; a refresh loses the game. This is a higher priority than new presentation effects for passing a phone around.

- Versioned local save/resume, including rules version, RNG, pending choices and hidden hands. Offer a clear new-game action without silently discarding the saved game.
- A pass-phone handoff that identifies the next player and keeps private Schemes hidden until they accept the phone. Verify a full two-human turn cycle on a narrow viewport.
- A printable short rulebook and one-page turn/reference sheet using the adopted bank diagram, setup, exact spawn cadence, combat and victory rules.
- A minimal session export: seed, rules version, commands, outcomes and elapsed time. Add a short feedback prompt about whether players could pursue their intended plan.

Exit: parent and child can start, hand off, refresh/resume, and finish or pause a two-player session without developer tools. Record human turn duration and confusing decisions before setting a playtime target.

## 3. Shorten games, then revisit difficulty

**Next rules experiment; medium scope, after item 1.** Host-only winning games averaged 106.8, 178.1 and 229.9 total player turns at 2, 3 and 4 players. Two-player games still had 12/60 timeouts. The bank-resource variant did not improve the overall balance picture and should not be used as the next pacing lever.

Test construction requirements first: fewer required Babel pieces per Stage, then a separately tested construction-cost change. Keep three Stages, Host statistics, starting geography and spawn cadence fixed for the initial screen. Piece counts currently live in the scaling table; expose an explicit experimental override rather than mutating shared constants.

Measure total turns and human elapsed time where available, turns to each Stage, repeated piece destruction, attack share, economic access, and timeouts as well as wins. Validate any selected schedule on fresh seeds and multiple cooperative policies. Only then adjust arrival cadence if the shortened game needs it.

Exit: choose a shorter construction target that preserves meaningful escalation and decisions. The five-Stage proposal stays deferred: adding escalation steps does not by itself shorten a game.

## 4. Integrate presentation work against the new rules

**After the first playtest blockers; medium scope.** Review the existing visual-work branch rather than merging it wholesale. Its combat animations must respect persistent damage, effective Defence, simultaneous Army hit assignment and bank positions. Reconcile Confusion visibility, placement feedback and sequential Heaven movement with the adopted core.

Exit: players can explain what changed and why from the screen; motion is skippable and reduced-motion mode remains usable.

## Later

Shared-URL multiplayer, 3D graphics, additional stages, character powers and more content stay behind the first human playtest. None is required for the proposed pass-phone session.

Evidence: [bank comparison](experiments/banks/RESULTS.md), [cadence comparison](experiments/cadence/RESULTS.md). Bot policy and card handling are in `packages/game-ai/src/policy.ts` and `driver.ts`; current browser state ownership is in `apps/web/src/App.tsx`.
