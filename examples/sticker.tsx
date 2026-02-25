import { Canvas, Edge, Image, Markdown, Sticker } from '@magam/core';

/**
 * Sticker Example
 *
 * Demonstrates text, emoji, image, and markdown sticker children.
 */
export default function StickerExample() {
  const inlineStickerImage =
    'data:image/svg+xml;utf8,'
    + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#22d3ee" />
            <stop offset="100%" stop-color="#3b82f6" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="320" height="200" rx="26" fill="url(#bg)" />
        <circle cx="92" cy="98" r="36" fill="#ffffff" fill-opacity="0.95" />
        <path d="M76 98 L90 112 L114 84" fill="none" stroke="#0f172a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
        <text x="146" y="106" fill="#ffffff" font-size="30" font-family="Arial, sans-serif" font-weight="700">APPROVED</text>
      </svg>
    `);

  return (
    <Canvas>
      <Sticker
        id="sticker-text"
        x={90}
        y={80}
      >
        Limited Edition
      </Sticker>

      <Sticker
        id="sticker-emoji"
        x={270}
        y={84}
        outlineColor="#ffffff"
        outlineWidth={10}
        shadow="lg"
        padding={8}
        rotation={12}
      >
        🔥
      </Sticker>

      <Sticker
        id="sticker-image"
        x={480}
        y={76}
        outlineColor="#ffffff"
        outlineWidth={12}
        shadow="md"
        padding={8}
        rotation={-6}
      >
        <Image src={inlineStickerImage} alt="Inline sample image" width={180} height={110} />
      </Sticker>

      <Sticker
        id="sticker-markdown"
        x={700}
        y={84}
        outlineColor="#ffffff"
        outlineWidth={9}
        shadow="md"
        padding={8}
        rotation={-2}
      >
        Quick
        <Markdown>**Ready**</Markdown>
      </Sticker>

      <Edge from="sticker-text" to="sticker-emoji" />
      <Edge from="sticker-emoji" to="sticker-image" />
      <Edge from="sticker-image" to="sticker-markdown" />
    </Canvas>
  );
}
