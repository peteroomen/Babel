# Historical balance model

The design process used a runnable Python headless model to explore resource flow, Heaven pressure, player-count scaling and Prestige balance. That model predates several final canon rules, especially the final Army-dice, Tower-support and Wall implementation.

For production implementation, **do not port historical simulator behaviour blindly**. The source of truth is:

1. `docs/GDD.md`
2. `docs/RULES_QUICK_REFERENCE.md`
3. `docs/FINAL_BALANCE_PASS_2026-09-15.md`
4. `docs/MODEL_NOTES.md`

The historical simulator is intentionally treated as disposable design tooling rather than production architecture. Rebuild future simulation/playtest tooling from the canonical TypeScript `game-core` once that exists, so the playable game and model cannot drift apart.
