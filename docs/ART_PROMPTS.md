# Image generation prompts

Prompts for generating placeholder and production art. Grounded in
`ART_DIRECTION.md`; the palette hex values match `apps/web/src/theme.ts` so
generated tiles drop into the prototype without a redesign.

Generate **one tile per request** where possible. Image models are far more
reliable producing a single square than a labelled grid, and a sheet that comes
back mislabelled has to be re-cut by hand anyway.

---

## The critical constraint: rivers must align

BABEL's rivers run through tile centres and connect across tile **edges**. Any
river tile can sit beside any other, in any of four rotations, so every river
must meet the tile edge at **the exact midpoint, at the same width**. If one
tile's river is 12% of the tile width and another's is 18%, or one meets the
edge slightly off-centre, the board visibly breaks.

State this in every river-tile prompt. It is the single most common failure.

---

## Master style preamble

Reuse this verbatim at the top of every tile prompt.

> A single square game tile for a tabletop-style strategy board game, drawn in a
> cheerful, handmade, cartoon style — flat vector shapes with visible charm, no
> photorealism, no gradients beyond simple two-tone shading. Top-down
> orthographic view, straight down, absolutely no perspective or isometric
> angle. Even, directionless lighting; no drop shadows, no vignette, no outer
> glow. The artwork fills the entire square edge to edge with no border, frame,
> margin, caption, label, watermark, or text of any kind. Flat colour, clean
> silhouettes, readable at 64×64 pixels. Warm, slightly sun-bleached palette
> like a well-loved board game printed on matte card.

---

## Terrain tiles

Append to the preamble. Hex values are the prototype's fills.

| Tile | Prompt body |
|---|---|
| **Farmland** | Cultivated farmland: warm golden-wheat fields (#e3bc5f) in gently irregular strip-field shapes, a few darker furrow lines, one or two tiny hay bales. Busy, tended, productive. |
| **Forest** | Dense forest: chunky clustered tree canopies in mid-green (#5f8f4e), rounded blobby crowns of two or three green tones, packed so the canopy reads as one mass rather than separate trees. |
| **Hills** | Rolling clay hills: warm terracotta-brown earth (#c07850) in soft rounded mounds with exposed clay banks and a few scattered stones. Reads as brick-making country, not mountains. |
| **Mountain** | Hard grey mountain rock (#8d939c): angular faceted peaks with sharp mineral silhouettes, cool grey with a hint of blue in the shadows, a few darker crevices. Unmistakably harder than the hills. |
| **Desert** | Pale barren desert (#ecdcb4): bone-coloured sand with faint wind ripples, one or two cracked stones, conspicuously empty. It should look like nothing grows here. |
| **Lake** | Still blue water (#6aa9d6) filling the whole tile: gentle concentric ripples, a few lighter highlights, a soft reed fringe at one edge. |

---

## River overlay tiles

Same terrain art as above, with a river crossing it. **Include the alignment
sentence every time:**

> A river of flat blue water (#2f7fb0) crosses the tile. The river is exactly
> 14% of the tile width, uniform along its whole length, and meets each tile
> edge it touches at the precise midpoint of that edge, perpendicular to it.
> The river passes through the exact centre of the tile.

Then one of:

- **Straight** — "The river runs straight from the middle of the top edge to the middle of the bottom edge."
- **Bend** — "The river enters at the middle of the top edge, curves smoothly through the tile centre, and exits at the middle of the right edge."
- **T-junction** — "The river enters at the middles of the top, left and right edges and meets at the tile centre, forming a T."
- **Mountain source** — "A spring wells up at the tile centre from between grey rocks and flows out through the middle of the top edge only. The other three edges have no water."

Generate these on Farmland and Forest (GDD §22 puts river variants mostly
there), plus the source on Mountain.

---

## Buildings

Buildings sit **on top of** terrain and must never read as terrain themselves.
Render each on a transparent background as an overlay sprite, roughly 45% of
the tile width, centred.

> A small charming cartoon building sprite for a board game, top-down
> orthographic, flat vector style, transparent background, no terrain beneath
> it, no shadow. Chunky and readable at 32×32 pixels. Practical and slightly
> ramshackle rather than grand — a civic works project built in a hurry.

- **Sawmill** — a timber mill with a circular saw blade and stacked logs.
- **Farmstead** — a little barn with a silo and a fenced yard.
- **Brickworks** — a kiln with a short chimney and pallets of red bricks.
- **Mine** — a timber-framed mine entrance cut into rock, with a minecart.
- **Tower** — a squat stone defensive tower with a crenellated top and an arrow slit. Obviously military.
- **Wall segment** — a rough wooden palisade of lashed stakes, clearly temporary and hasty, NOT grand castle masonry.

---

## Babel, by Stage

One image per Stage. Babel is the visual hero and should grow more audacious,
not merely taller.

> A top-down orthographic view of a monumental tower under construction at the
> centre of a city, flat cartoon vector style, transparent background. Seen
> from directly above, so it reads as concentric structure rather than a
> skyline.

- **Stage I — Foundation of Defiance** — rough honest civic masonry: a broad stone ring, timber scaffolding, ramps, carts, scattered tools. Ambitious but unmistakably a building site.
- **Stage II — The Great Ascent** — monumental engineering: precise tiered stonework, cranes and counterweights, banners, an obvious spiral ascent. Confident and expensive.
- **Stage III — The Siege of Heaven** — absurd celestial breach architecture: impossible cantilevers, brass rings and orreries, chains hauling the structure upward into a hole it has torn in the sky. Gloriously overreaching.

---

## Heaven

> A cartoon enemy token for a board game, top-down orthographic, flat vector
> style, transparent background, bright divine gold and ivory, readable at
> 40×40 pixels. Horrifying-but-cute: strange and unsettling in silhouette, yet
> cartoonish enough to stay funny. Not grimdark, not reverent.

- **Ophanim Host** — concentric spinning wheel and halo rings, many eyes staring outward around the rims, several small and faintly inadequate wings, ornate gold filigree. Visibly indignant, like a bureaucrat who has been kept waiting.
- **Seraph** — taller and more vertical: six wings wrapped protectively around a blazing white-hot core, eyes peeking out between the feathers, a translucent shimmering shield bubble around it. More imposing and less comic than the Ophanim. Also generate a **shield-broken** variant: identical, with the bubble shattered into fading shards.
- **Beacon** — a slender gold pillar of light striking down onto the ground, splayed at the base, with a faint ring of scorched earth. Ominous and clearly a landing site.

---

## After generating

- Check that every river tile's water meets each edge at the midpoint at the
  same width. Place two beside each other and look at the seam.
- Check each tile at 64×64. If the terrain type is not instantly identifiable
  at that size, the illustration has too much detail — ART_DIRECTION.md is
  explicit that terrain identity beats illustration detail.
- Keep building sprites clearly separable from terrain at a glance.
