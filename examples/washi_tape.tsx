import { Canvas, Image, Markdown, Shape, Sticker, Text, WashiTape } from '@magam/core';

/**
 * Washi Tape Example
 *
 * Demonstrates preset, solid, svg, image patterns and attach/segment/polar placement,
 * mixed with sticker-style decoration samples.
 */
export default function WashiTapeExample() {
  const stripeTexture =
    'data:image/svg+xml;utf8,'
    + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="24" viewBox="0 0 80 24">
        <rect width="80" height="24" fill="#fef3c7" />
        <rect width="80" height="8" fill="#fcd34d" fill-opacity="0.42" />
        <rect y="12" width="80" height="6" fill="#f59e0b" fill-opacity="0.25" />
      </svg>
    `);

  const dotMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="36" viewBox="0 0 160 36">
      <rect width="160" height="36" fill="#fce7f3" />
      <circle cx="18" cy="18" r="3" fill="#ec4899" fill-opacity="0.55" />
      <circle cx="58" cy="18" r="3" fill="#ec4899" fill-opacity="0.55" />
      <circle cx="98" cy="18" r="3" fill="#ec4899" fill-opacity="0.55" />
      <circle cx="138" cy="18" r="3" fill="#ec4899" fill-opacity="0.55" />
    </svg>
  `;

  const washiTapeSticker =
    'data:image/svg+xml;utf8,'
    + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="220" height="96" viewBox="0 0 220 96">
        <defs>
          <linearGradient id="mini-tape" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#fde68a" stop-opacity="0.86" />
            <stop offset="100%" stop-color="#fbcfe8" stop-opacity="0.86" />
          </linearGradient>
        </defs>
        <path d="M12 18 Q110 4 208 18 L208 78 Q110 92 12 78 Z" fill="url(#mini-tape)" />
        <path d="M20 26 Q110 14 200 26" stroke="#ffffff" stroke-opacity="0.64" stroke-width="3" fill="none" />
      </svg>
    `);

  const polaroidHeartSticker =
    'data:image/svg+xml;utf8,'
    + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
        <rect x="20" y="16" width="120" height="130" rx="14" fill="#ffffff" />
        <rect x="34" y="30" width="92" height="74" rx="10" fill="#fef3c7" />
        <path d="M80 96 C86 84, 106 78, 106 66 C106 58,100 52,92 52 C87 52,83 55,80 59 C77 55,73 52,68 52 C60 52,54 58,54 66 C54 78,74 84,80 96Z" fill="#fb7185" />
      </svg>
    `);

  return (
    <Canvas>
      <Text id="washi-title" x={84} y={38}>Washi Tape Diary Deco</Text>

      <Shape id="washi-card-1" x={110} y={128}>Dear Diary</Shape>
      <Shape id="washi-card-2" x={412} y={128}>Weekend Trip!</Shape>
      <Shape id="washi-card-3" x={740} y={128}>Cafe Tour</Shape>
      <Shape id="washi-markdown-card" x={112} y={382}>
        <Markdown>{`### March Plan

- [x] Morning walk
- [ ] Brunch with friends
- [ ] Photo edit`}</Markdown>
      </Shape>

      <WashiTape
        id="washi-markdown-top-left"
        at={{
          type: 'attach',
          target: 'washi-markdown-card',
          placement: 'top',
          span: 0.5,
          align: 0,
          offset: -4,
          thickness: 24,
        }}
        preset="kraft-grid"
        text={{ align: 'center', color: '#78350f', size: 12 }}
        opacity={0.62}
      >
        PLAN
      </WashiTape>

      <WashiTape
        id="washi-preset"
        x={108}
        y={92}
        width={224}
        height={34}
        preset="pastel-dots"
        text={{ align: 'center', size: 14 }}
      >
        Don't Forget!
      </WashiTape>

      <WashiTape
        id="washi-solid-segment"
        at={{
          type: 'segment',
          from: { x: 382, y: 288 },
          to: { x: 650, y: 320 },
          thickness: 34,
        }}
        pattern={{ type: 'solid', color: '#fed7aa' }}
        edge={{ torn: true, roughness: 1.3 }}
        text={{ align: 'center', color: '#7c2d12', size: 13 }}
      >
        Movie Night
      </WashiTape>

      <WashiTape
        id="washi-svg-attach"
        at={{
          type: 'attach',
          target: 'washi-card-3',
          placement: 'top',
          span: 0.72,
          align: 0.5,
          offset: 10,
          thickness: 28,
        }}
        pattern={{ type: 'svg', markup: dotMarkup }}
        texture={{ opacity: 0.18, blendMode: 'multiply' }}
        text={{ align: 'center', color: '#831843', size: 12 }}
      >
        Yum Yum
      </WashiTape>

      <WashiTape
        id="washi-image-polar"
        at={{
          type: 'polar',
          x: 728,
          y: 370,
          length: 250,
          angle: -8,
          thickness: 36,
        }}
        pattern={{
          type: 'image',
          src: stripeTexture,
          scale: 1,
          repeat: 'repeat-x',
        }}
        text={{ align: 'center', color: '#78350f', size: 14 }}
        opacity={0.84}
      >
        Shopping List
      </WashiTape>

      <Sticker id="sticker-mood" x={1020} y={34}>
        Happy vibes 🌸
      </Sticker>

      <Sticker id="sticker-emoji" x={1184} y={46}>
        ☕️🍰✨
      </Sticker>

      <Sticker id="sticker-washi-image" x={1008} y={116}>
        <Image src={washiTapeSticker} alt="Washi tape sticker" width={158} height={70} />
      </Sticker>

      <Sticker id="sticker-polaroid" x={1200} y={202}>
        <Image src={polaroidHeartSticker} alt="Polaroid heart sticker" width={112} height={112} />
      </Sticker>

      <Sticker id="sticker-star-svg" x={1086} y={338}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="120"
          height="92"
          viewBox="-72 -66 144 132"
          role="img"
          aria-label="Star badge"
        >
          <path
            d="M0 -58 L14 -20 L58 -20 L22 6 L36 50 L0 24 L-36 50 L-22 6 L-58 -20 L-14 -20 Z"
            fill="#fef08a"
            stroke="#1e3a8a"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="0" r="14" fill="#ffffff" fillOpacity="0.9" />
          <text
            x="0"
            y="6"
            textAnchor="middle"
            fontSize="14"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fill="#1e3a8a"
          >
            CUTE
          </text>
        </svg>
      </Sticker>
    </Canvas>
  );
}
