import {
  anchor,
  attach,
  Canvas,
  Edge,
  image,
  polar,
  preset,
  segment,
  Shape,
  solid,
  Sticky,
  svg,
  Text,
  texture,
  torn,
  WashiTape,
} from '@magam/core';

/**
 * Sticky + WashiTape Showcase
 *
 * Covers:
 * - Sticky pattern modes: preset / solid / svg / image
 * - Sticky shape modes: rectangle / heart / cloud / speech
 * - Sticky sizing modes: auto / width-only / fixed frame
 * - Sticky placement modes: x,y / at=anchor(...) / at=attach(...)
 * - WashiTape mixed usage around sticky notes
 */
export default function StickyShowcase() {
  const paperTextureDataUri =
    'data:image/svg+xml;utf8,'
    + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="280" height="180" viewBox="0 0 280 180">
        <defs>
          <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff7ed" />
            <stop offset="100%" stop-color="#ffedd5" />
          </linearGradient>
        </defs>
        <rect width="280" height="180" fill="url(#paper)" />
        <circle cx="36" cy="36" r="1.3" fill="#d6a46f" fill-opacity="0.30" />
        <circle cx="92" cy="86" r="1.1" fill="#d6a46f" fill-opacity="0.24" />
        <circle cx="142" cy="54" r="1.2" fill="#d6a46f" fill-opacity="0.26" />
        <circle cx="198" cy="124" r="1.3" fill="#d6a46f" fill-opacity="0.28" />
        <circle cx="252" cy="72" r="1.1" fill="#d6a46f" fill-opacity="0.22" />
      </svg>
    `);

  const stripeTapeDataUri =
    'data:image/svg+xml;utf8,'
    + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="180" height="36" viewBox="0 0 180 36">
        <rect width="180" height="36" fill="#fef3c7" />
        <rect width="180" height="9" fill="#f59e0b" fill-opacity="0.22" />
        <rect y="18" width="180" height="8" fill="#fb7185" fill-opacity="0.20" />
      </svg>
    `);

  const dotMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="48" viewBox="0 0 120 48">
      <rect width="120" height="48" fill="#fdf2f8" />
      <circle cx="16" cy="24" r="2" fill="#ec4899" fill-opacity="0.55" />
      <circle cx="40" cy="24" r="2" fill="#ec4899" fill-opacity="0.55" />
      <circle cx="64" cy="24" r="2" fill="#ec4899" fill-opacity="0.55" />
      <circle cx="88" cy="24" r="2" fill="#ec4899" fill-opacity="0.55" />
      <circle cx="112" cy="24" r="2" fill="#ec4899" fill-opacity="0.55" />
    </svg>
  `;

  return (
    <Canvas>
      <Text id="sticky-title" x={74} y={30}>
        Sticky Material Playground + WashiTape
      </Text>

      <Shape id="focus-board" x={80} y={92} width={320} height={120}>
        Focus Board
      </Shape>

      <WashiTape
        id="t-focus-header"
        at={attach({
          target: 'focus-board',
          placement: 'top',
          span: 0.52,
          align: 0.5,
          offset: 8,
          thickness: 24,
        })}
        pattern={preset('pastel-dots')}
        text={{ align: 'center', color: '#7f1d1d', size: 12 }}
      >
        WEEKLY PLAN
      </WashiTape>

      <Sticky id="s-auto-default" x={102} y={252}>
        Auto size (default postit)
        <Edge to="s-width-cloud" />
      </Sticky>

      <Sticky
        id="s-width-cloud"
        at={anchor('s-auto-default', { position: 'right', gap: 28 })}
        width={250}
        shape="cloud"
        pattern={preset('lined-warm')}
      >
        Width-only sizing. This note wraps text and grows height automatically.
        <Edge to="s-fixed-speech" />
      </Sticky>

      <WashiTape
        id="t-width-note"
        at={attach({
          target: 's-width-cloud',
          placement: 'top',
          span: 0.64,
          align: 0.5,
          offset: 6,
          thickness: 22,
        })}
        pattern={preset('masking-solid')}
        text={{ align: 'center', color: '#713f12', size: 11 }}
      >
        WRAP MODE
      </WashiTape>

      <Sticky
        id="s-fixed-speech"
        at={anchor('s-width-cloud', { position: 'right', gap: 28 })}
        width={240}
        height={128}
        shape="speech"
        pattern={preset('grid-standard')}
      >
        Fixed frame sizing clips overflow. Keep notes concise when height is constrained.
      </Sticky>

      <Sticky
        id="s-heart-preset-color"
        at={anchor('s-auto-default', { position: 'bottom', gap: 30 })}
        width={194}
        shape="heart"
        pattern={preset('postit', { color: '#ffc7d6' })}
      >
        Preset with color override
      </Sticky>

      <Sticky
        id="s-solid-attach"
        at={attach({
          target: 'focus-board',
          placement: 'right',
          span: 0.72,
          align: 0.28,
          offset: 16,
          thickness: 110,
        })}
        width={220}
        shape="rectangle"
        pattern={solid('#fef08a')}
      >
        Attached note using solid pattern
      </Sticky>

      <Sticky
        id="s-svg-pattern"
        x={970}
        y={236}
        width={238}
        shape="speech"
        pattern={svg({ markup: dotMarkup })}
      >
        SVG pattern note with speech shape
      </Sticky>

      <Sticky
        id="s-image-pattern"
        x={968}
        y={434}
        width={250}
        height={146}
        pattern={image(paperTextureDataUri, { scale: 1.15, repeat: 'repeat' })}
      >
        Image pattern note (fixed frame)
      </Sticky>

      <WashiTape
        id="t-svg-tag"
        at={attach({
          target: 's-svg-pattern',
          placement: 'top',
          span: 0.58,
          align: 0.5,
          offset: 8,
          thickness: 24,
        })}
        pattern={svg({ markup: dotMarkup })}
        texture={texture({ opacity: 0.2, blendMode: 'multiply' })}
        text={{ align: 'center', color: '#831843', size: 12 }}
      >
        SVG TAPE
      </WashiTape>

      <WashiTape
        id="t-segment-bridge"
        at={segment({ x: 420, y: 598 }, { x: 820, y: 638 }, { thickness: 34 })}
        pattern={solid('#fed7aa')}
        edge={torn(1.25)}
        text={{ align: 'center', color: '#7c2d12', size: 13 }}
      >
        Bridge tape (segment)
      </WashiTape>

      <WashiTape
        id="t-polar-angle"
        at={polar(934, 152, 270, -9, { thickness: 34 })}
        pattern={image(stripeTapeDataUri, { scale: 1, repeat: 'repeat-x' })}
        text={{ align: 'center', color: '#78350f', size: 12 }}
        opacity={0.88}
      >
        Polar tape with custom image
      </WashiTape>
    </Canvas>
  );
}

