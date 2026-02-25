const JITTER_ANGLES = [
  -5, -4, -3, -2, -1,
  1, 2, 3, 4, 5,
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
  return JITTER_ANGLES[hash % JITTER_ANGLES.length];
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
