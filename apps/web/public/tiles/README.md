# Tile art

Painted terrain tiles, generated from the prompts in `docs/ART_PROMPTS.md` and
supplied by the project owner.

Source images were 1254×1254 PNGs totalling about 9.5 MB. They are stored here
resized to 256×256 WebP at quality 82 — roughly 76 KB for the whole set —
because tiles render at around 64 CSS pixels, so 256 covers a 2× display with
room to spare.

Rivers are **not** baked into these images. They are drawn as an SVG overlay in
`apps/web/src/Board.tsx`, which keeps one image per terrain rather than one per
terrain-and-river-shape combination, and lets RD-001's edge alignment be exact
rather than something an illustration has to hit by hand.

To replace a tile, drop in a new 256×256 WebP under the same name. The flat
colours in `apps/web/src/theme.ts` stay as the fallback painted underneath.
