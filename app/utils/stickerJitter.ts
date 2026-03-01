const STICKER_JITTER_ANGLES = [
  -5, -4, -3, -2, -1,
  1, 2, 3, 4, 5,
] as const;

const WASHI_ROTATION_JITTER_ANGLES = [
  -5, -4, -3, -2, -1,
  1, 2, 3, 4, 5,
] as const;

const WASHI_SHAPE_SKEW_ANGLES = [
  -2.4, -2.2, -2.0,
  2.0, 2.2, 2.4,
] as const;

function hashFNV1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getStickerJitterAngle(seed: string): number {
  const safeSeed = seed && seed.trim().length > 0 ? seed : 'sticker-default';
  const hash = hashFNV1a(`sticker:${safeSeed}`);
  return STICKER_JITTER_ANGLES[hash % STICKER_JITTER_ANGLES.length];
}

export function resolveStickerRotation(
  explicitRotation: unknown,
  seed: string,
): number {
  if (typeof explicitRotation === 'number' && Number.isFinite(explicitRotation)) {
    return explicitRotation;
  }
  return getStickerJitterAngle(seed);
}

export function getWashiJitterAngle(seed: string): number {
  const safeSeed = seed && seed.trim().length > 0 ? seed : 'washi-default';
  const hash = hashFNV1a(`washi:${safeSeed}`);
  return WASHI_ROTATION_JITTER_ANGLES[hash % WASHI_ROTATION_JITTER_ANGLES.length];
}

export function getWashiShapeSkewAngle(seed: string): number {
  const safeSeed = seed && seed.trim().length > 0 ? seed : 'washi-default';
  const hash = hashFNV1a(`washi-shape:${safeSeed}`);
  return WASHI_SHAPE_SKEW_ANGLES[hash % WASHI_SHAPE_SKEW_ANGLES.length];
}

export function resolveWashiAngle(
  explicitAngle: unknown,
  seed: string,
): number {
  if (typeof explicitAngle === 'number' && Number.isFinite(explicitAngle)) {
    return explicitAngle;
  }
  return getWashiJitterAngle(seed);
}
