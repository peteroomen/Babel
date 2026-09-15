# Image generation prompts

One self-contained prompt per tile, ready to paste. Grounded in
`ART_DIRECTION.md`; hex values match `apps/web/src/theme.ts` so generated art
drops into the prototype without a redesign.

Generate one image per request. Image models mislabel grids, and a sheet that
comes back wrong has to be re-cut by hand anyway.

**The one thing that will break the board:** rivers connect across tile edges in
any rotation, so every river must meet the edge at its exact midpoint at the
same width. The river blocks below say so explicitly. Do not trim that sentence.

---

## Terrain

### Farmland
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: cultivated farmland. Warm golden-wheat fields (#e3bc5f) in gently irregular strip-field shapes, a few darker furrow lines, one or two tiny hay bales. Busy, tended, productive.
```

### Forest
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: dense forest. Chunky clustered tree canopies in mid-green (#5f8f4e), rounded blobby crowns in two or three green tones, packed so the canopy reads as one mass rather than separate trees.
```

### Hills
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: rolling clay hills. Warm terracotta-brown earth (#c07850) in soft rounded mounds, exposed clay banks, a few scattered stones. Brick-making country — clearly softer and lower than mountains.
```

### Mountain
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: hard grey mountain rock (#8d939c). Angular faceted peaks with sharp mineral silhouettes, cool grey with a hint of blue in the shadows, a few dark crevices. Unmistakably harder and higher than the hills.
```

### Desert
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: pale barren desert (#ecdcb4). Bone-coloured sand with faint wind ripples, one or two cracked stones, conspicuously empty. It should look like nothing grows here.
```

### Lake
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: still blue water (#6aa9d6) filling the whole tile. Gentle concentric ripples, a few lighter highlights, a soft reed fringe at one edge.
```

---

## River tiles

### Farmland, straight river
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: cultivated farmland — warm golden-wheat fields (#e3bc5f) in irregular strip-field shapes with darker furrow lines.

A flat blue river (#2f7fb0) crosses the tile. It is exactly 14% of the tile width, uniform along its entire length, passes through the exact centre of the tile, and meets each edge it touches at that edge's precise midpoint, perpendicular to it. The river runs straight from the middle of the top edge to the middle of the bottom edge. The left and right edges have no water.
```

### Farmland, river bend
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: cultivated farmland — warm golden-wheat fields (#e3bc5f) in irregular strip-field shapes with darker furrow lines.

A flat blue river (#2f7fb0) crosses the tile. It is exactly 14% of the tile width, uniform along its entire length, passes through the exact centre of the tile, and meets each edge it touches at that edge's precise midpoint, perpendicular to it. The river enters at the middle of the top edge, curves smoothly through the tile centre, and exits at the middle of the right edge. The left and bottom edges have no water.
```

### Farmland, river T-junction
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: cultivated farmland — warm golden-wheat fields (#e3bc5f) in irregular strip-field shapes with darker furrow lines.

A flat blue river (#2f7fb0) crosses the tile. It is exactly 14% of the tile width, uniform along its entire length, and meets each edge it touches at that edge's precise midpoint, perpendicular to it. Three branches enter at the middles of the top, left and right edges and join at the exact centre of the tile, forming a T. The bottom edge has no water.
```

### Forest, straight river
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: dense forest — chunky clustered tree canopies in mid-green (#5f8f4e), rounded blobby crowns in two or three green tones.

A flat blue river (#2f7fb0) crosses the tile, cutting a clear channel through the canopy. It is exactly 14% of the tile width, uniform along its entire length, passes through the exact centre of the tile, and meets each edge it touches at that edge's precise midpoint, perpendicular to it. The river runs straight from the middle of the top edge to the middle of the bottom edge. The left and right edges have no water.
```

### Forest, river bend
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: dense forest — chunky clustered tree canopies in mid-green (#5f8f4e), rounded blobby crowns in two or three green tones.

A flat blue river (#2f7fb0) crosses the tile, cutting a clear channel through the canopy. It is exactly 14% of the tile width, uniform along its entire length, passes through the exact centre of the tile, and meets each edge it touches at that edge's precise midpoint, perpendicular to it. The river enters at the middle of the top edge, curves smoothly through the tile centre, and exits at the middle of the right edge. The left and bottom edges have no water.
```

### Forest, river T-junction
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: dense forest — chunky clustered tree canopies in mid-green (#5f8f4e), rounded blobby crowns in two or three green tones.

A flat blue river (#2f7fb0) crosses the tile, cutting clear channels through the canopy. It is exactly 14% of the tile width, uniform along its entire length, and meets each edge it touches at that edge's precise midpoint, perpendicular to it. Three branches enter at the middles of the top, left and right edges and join at the exact centre of the tile, forming a T. The bottom edge has no water.
```

### Mountain river source
```
Single square game tile, top-down orthographic (straight down, no perspective), cheerful handmade cartoon style, flat vector shapes, two-tone shading only. Even directionless light, no drop shadow or vignette. Art fills the whole square edge to edge — no border, frame, margin, label, text or watermark. Clean silhouettes, readable at 64px. Warm, slightly sun-bleached board-game palette.

Subject: hard grey mountain rock (#8d939c) with angular faceted peaks and dark crevices.

A spring wells up at the exact centre of the tile from between the grey rocks and flows out through the middle of the top edge only. The water is flat blue (#2f7fb0), exactly 14% of the tile width, uniform along its length, and meets the top edge at that edge's precise midpoint, perpendicular to it. The left, right and bottom edges have no water at all.
```

---

## Buildings

Overlay sprites, transparent background, about 45% of tile width.

### Sawmill
```
Small cartoon building sprite for a board game, top-down orthographic (straight down, no perspective), flat vector style, transparent background, no terrain or ground beneath it, no shadow. Chunky and readable at 32px. Practical and slightly ramshackle — a civic works project built in a hurry, not a grand monument.

Subject: a timber sawmill with a large circular saw blade and neat stacks of cut logs beside it.
```

### Farmstead
```
Small cartoon building sprite for a board game, top-down orthographic (straight down, no perspective), flat vector style, transparent background, no terrain or ground beneath it, no shadow. Chunky and readable at 32px. Practical and slightly ramshackle — a civic works project built in a hurry, not a grand monument.

Subject: a little barn with a silo beside it and a small fenced yard.
```

### Brickworks
```
Small cartoon building sprite for a board game, top-down orthographic (straight down, no perspective), flat vector style, transparent background, no terrain or ground beneath it, no shadow. Chunky and readable at 32px. Practical and slightly ramshackle — a civic works project built in a hurry, not a grand monument.

Subject: a brick kiln with a short smoking chimney and pallets of stacked red bricks.
```

### Mine
```
Small cartoon building sprite for a board game, top-down orthographic (straight down, no perspective), flat vector style, transparent background, no terrain or ground beneath it, no shadow. Chunky and readable at 32px. Practical and slightly ramshackle — a civic works project built in a hurry, not a grand monument.

Subject: a timber-framed mine entrance cut into grey rock, with a small minecart on rails outside it.
```

### Tower
```
Small cartoon building sprite for a board game, top-down orthographic (straight down, no perspective), flat vector style, transparent background, no terrain or ground beneath it, no shadow. Chunky and readable at 32px.

Subject: a squat stone defensive tower with a crenellated top and a narrow arrow slit. Obviously military, and obviously sturdier than the surrounding civilian buildings.
```

### Wall segment
```
Small cartoon sprite for a board game, top-down orthographic (straight down, no perspective), flat vector style, transparent background, no terrain or ground beneath it, no shadow. Chunky and readable at 32px. Drawn as a long thin horizontal segment that sits along the edge between two tiles.

Subject: a rough wooden palisade of lashed pointed stakes, leaning slightly, clearly hasty and temporary. NOT grand castle masonry — this is something thrown up overnight and expected to be destroyed.
```

---

## Babel

### Stage I — Foundation of Defiance
```
Top-down orthographic view (straight down, no perspective) of a monumental tower under construction, cheerful handmade cartoon style, flat vector shapes, transparent background, no shadow. Seen from directly above so it reads as concentric structure rather than a skyline. Readable at 64px.

Subject: rough, honest civic masonry. A broad stone foundation ring with timber scaffolding, earth ramps, handcarts and scattered tools around its rim. Ambitious, but unmistakably a building site.
```

### Stage II — The Great Ascent
```
Top-down orthographic view (straight down, no perspective) of a monumental tower under construction, cheerful handmade cartoon style, flat vector shapes, transparent background, no shadow. Seen from directly above so it reads as concentric structure rather than a skyline. Readable at 64px.

Subject: monumental engineering. Precise tiered stonework in concentric rings, timber cranes with counterweights, hanging banners, and an obvious spiral ramp ascending inward. Confident, organised and expensive.
```

### Stage III — The Siege of Heaven
```
Top-down orthographic view (straight down, no perspective) of an impossible tower, cheerful handmade cartoon style, flat vector shapes, transparent background, no shadow. Seen from directly above so it reads as concentric structure rather than a skyline. Readable at 64px.

Subject: absurd celestial breach architecture. Impossible cantilevers jutting outward, brass rings and orrery mechanisms, heavy chains hauling the whole structure upward into a ragged hole it has torn in the sky. Gloriously, comically overreaching.
```

---

## Heaven

### Ophanim Host
```
Cartoon enemy token for a board game, top-down orthographic (straight down, no perspective), flat vector style, transparent background, no shadow. Bright divine gold (#d9a441) and ivory (#fff6e0). Readable at 40px. Horrifying-but-cute: strange and unsettling in silhouette, yet cartoonish enough to stay funny. Not grimdark, not reverent.

Subject: concentric spinning wheel and halo rings nested inside each other, many eyes staring outward around the rims, several small and faintly inadequate wings, ornate gold filigree. Visibly indignant — like a bureaucrat who has been kept waiting.
```

### Seraph (shield intact)
```
Cartoon enemy token for a board game, top-down orthographic (straight down, no perspective), flat vector style, transparent background, no shadow. Bright divine gold (#d9a441) and ivory (#fff6e0) with a hot pale core (#ffd9a0). Readable at 40px. Horrifying-but-cute, but more imposing and less comic than a lesser angel. Not grimdark.

Subject: six wings wrapped protectively around a blazing white-hot core, eyes peeking out between the feathers, taller and more vertical than it is wide. A translucent shimmering shield bubble surrounds the whole figure, clearly intact.
```

### Seraph (shield broken)
```
Cartoon enemy token for a board game, top-down orthographic (straight down, no perspective), flat vector style, transparent background, no shadow. Bright divine gold (#d9a441) and ivory (#fff6e0) with a hot pale core (#ffd9a0). Readable at 40px. Horrifying-but-cute, but more imposing and less comic than a lesser angel. Not grimdark.

Subject: identical to a six-winged seraph with wings wrapped around a blazing core and eyes peeking between the feathers — but its surrounding shield bubble is shattered into fading translucent shards drifting outward. The figure looks exposed and considerably less pleased about it.
```

### Beacon
```
Cartoon board-game marker, top-down orthographic (straight down, no perspective), flat vector style, transparent background, no shadow. Bright divine gold (#f0c860). Readable at 40px. Ominous but stylised, not photorealistic.

Subject: a slender pillar of golden light striking down onto the ground, splayed and brighter where it lands, surrounded by a faint ring of scorched earth. Clearly a landing site — somewhere you would rather not be standing.
```

---

## After generating

- Put two river tiles side by side and look at the seam. If the water jumps
  width or sits off-centre, regenerate — that sentence is the whole ballgame.
- View each tile at 64px. If the terrain is not instantly identifiable,
  there is too much detail: ART_DIRECTION.md is explicit that terrain identity
  beats illustration detail.
- Building sprites must stay clearly separable from terrain at a glance.
- If your tool supports a style reference, feed it the first accepted tile when
  generating the rest — it keeps the set coherent far better than prose does.
