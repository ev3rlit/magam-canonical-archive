import { Canvas, Sticker } from '@magam/core';

/**
 * Single Sticker Example
 *
 * Minimal example with only one sticker node.
 */
export default function SingleStickerExample() {
  return (
    <Canvas>
      <Sticker
        id="single-sticker"
        x={320}
        y={220}
        outlineColor="#ffffff"
        outlineWidth={10}
        shadow="lg"
        padding={10}
        rotation={-6}
      >
        Limited Edition
      </Sticker>
    </Canvas>
  );
}
