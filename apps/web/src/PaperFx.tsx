/**
 * Shared SVG filters, mounted once.
 *
 * Every deckled edge in the interface is turbulence pushed through a
 * displacement map: the paper's silhouette gets nudged around by noise, which
 * reads as a torn or hand-cut edge. Panels use a fine fray, the map a coarser
 * one, because a whole sheet of papyrus tears more dramatically than a card.
 */
export function PaperFx() {
  return (
    <svg
      aria-hidden
      focusable="false"
      className="pointer-events-none absolute size-0 overflow-hidden"
    >
      <defs>
        <filter id="deckle" x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.022"
            numOctaves="4"
            seed="11"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="7"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <filter id="deckle-fine" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05"
            numOctaves="3"
            seed="5"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* The map sheet: a coarser, slower tear, plus a soft shadow so the
            papyrus reads as an object lying on the desk. */}
        <filter id="deckle-map" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.019"
            numOctaves="5"
            seed="23"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="11"
            xChannelSelector="R"
            yChannelSelector="G"
            result="torn"
          />
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodColor="#4a3a22"
            floodOpacity="0.28"
          />
        </filter>

        {/* Papyrus fibre: stretched noise, so the grain runs horizontally. */}
        <filter id="fibre">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9 0.035"
            numOctaves="3"
            seed="2"
            result="grain"
          />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0.36  0 0 0 0 0.28  0 0 0 0 0.14  0 0 0 0.5 0"
          />
        </filter>
      </defs>
    </svg>
  );
}
