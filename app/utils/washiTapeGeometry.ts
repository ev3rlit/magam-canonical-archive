import type { Node } from 'reactflow';
import type { AtDef, ResolvedGeometry } from '@/types/washiTape';
import { resolveWashiAngle } from './stickerJitter';

const MIN_LENGTH = 24;
const DEFAULT_LENGTH = 180;
const DEFAULT_THICKNESS = 36;

interface ResolveWashiGeometryInput {
  at?: AtDef;
  nodes?: Node[];
  seed?: string | number;
  fallbackPosition?: { x: number; y: number };
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampThickness(value: unknown): number {
  return Math.max(8, toNumber(value) ?? DEFAULT_THICKNESS);
}

function normalizeLine(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { from: { x: number; y: number }; to: { x: number; y: number }; length: number; angle: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt((dx * dx) + (dy * dy));
  if (!Number.isFinite(length) || length < MIN_LENGTH) {
    return {
      from,
      to: { x: from.x + DEFAULT_LENGTH, y: from.y },
      length: DEFAULT_LENGTH,
      angle: 0,
    };
  }
  return {
    from,
    to,
    length,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

function resolveAttachGeometry(
  at: Extract<AtDef, { type: 'attach' }>,
  nodes: Node[] | undefined,
  fallbackPosition: { x: number; y: number },
): Omit<ResolvedGeometry, 'mode'> {
  const target = nodes?.find((node) => node.id === at.target);

  if (!target) {
    return {
      ...normalizeLine(
        fallbackPosition,
        { x: fallbackPosition.x + DEFAULT_LENGTH, y: fallbackPosition.y },
      ),
      thickness: clampThickness(at.thickness),
    };
  }

  const targetWidth = Math.max(
    MIN_LENGTH,
    toNumber((target as { measured?: { width?: unknown } }).measured?.width)
      ?? toNumber(target.width)
      ?? toNumber((target.data as { width?: unknown } | undefined)?.width)
      ?? 150,
  );
  const targetHeight = Math.max(
    MIN_LENGTH,
    toNumber((target as { measured?: { height?: unknown } }).measured?.height)
      ?? toNumber(target.height)
      ?? toNumber((target.data as { height?: unknown } | undefined)?.height)
      ?? 80,
  );

  const targetX = target.position.x;
  const targetY = target.position.y;
  const placement = at.placement ?? 'center';
  const span = clamp(toNumber(at.span) ?? 0.75, 0.1, 1);
  const align = clamp(toNumber(at.align) ?? 0.5, 0, 1);
  const offset = toNumber(at.offset) ?? 0;

  let from = { x: targetX, y: targetY };
  let to = { x: targetX + targetWidth, y: targetY };

  if (placement === 'top' || placement === 'bottom' || placement === 'center') {
    const spanLength = targetWidth * span;
    const startX = targetX + ((targetWidth - spanLength) * align);
    const y =
      placement === 'top'
        ? targetY - offset
        : placement === 'bottom'
          ? targetY + targetHeight + offset
          : targetY + (targetHeight / 2) + offset;
    from = { x: startX, y };
    to = { x: startX + spanLength, y };
  } else {
    const spanLength = targetHeight * span;
    const startY = targetY + ((targetHeight - spanLength) * align);
    const x =
      placement === 'left'
        ? targetX - offset
        : targetX + targetWidth + offset;
    from = { x, y: startY };
    to = { x, y: startY + spanLength };
  }

  const normalizedLine = normalizeLine(from, to);
  return {
    ...normalizedLine,
    thickness: clampThickness(at.thickness),
    targetSnapshot: {
      id: target.id,
      x: targetX,
      y: targetY,
      width: targetWidth,
      height: targetHeight,
    },
  };
}

export function resolveWashiGeometry({
  at,
  nodes,
  seed,
  fallbackPosition,
}: ResolveWashiGeometryInput): ResolvedGeometry {
  const fallback = fallbackPosition ?? { x: 0, y: 0 };
  const seedKey = String(seed ?? 'washi-default');

  if (!at) {
    const angle = resolveWashiAngle(undefined, seedKey);
    const line = normalizeLine(
      fallback,
      {
        x: fallback.x + (Math.cos((angle * Math.PI) / 180) * DEFAULT_LENGTH),
        y: fallback.y + (Math.sin((angle * Math.PI) / 180) * DEFAULT_LENGTH),
      },
    );
    return {
      ...line,
      thickness: DEFAULT_THICKNESS,
      mode: 'polar',
      angle,
    };
  }

  if (at.type === 'segment') {
    const line = normalizeLine(at.from, at.to);
    return {
      ...line,
      thickness: clampThickness(at.thickness),
      mode: 'segment',
    };
  }

  if (at.type === 'polar') {
    const angle = resolveWashiAngle(at.angle, seedKey);
    const length = Math.max(MIN_LENGTH, toNumber(at.length) ?? DEFAULT_LENGTH);
    const from = { x: at.x, y: at.y };
    const to = {
      x: at.x + (Math.cos((angle * Math.PI) / 180) * length),
      y: at.y + (Math.sin((angle * Math.PI) / 180) * length),
    };
    return {
      ...normalizeLine(from, to),
      thickness: clampThickness(at.thickness),
      mode: 'polar',
      angle,
    };
  }

  if (at.type === 'attach') {
    return {
      ...resolveAttachGeometry(at, nodes, fallback),
      mode: 'attach',
    };
  }

  const fallbackAngle = resolveWashiAngle(undefined, seedKey);
  const fallbackLine = normalizeLine(
    fallback,
    {
      x: fallback.x + (Math.cos((fallbackAngle * Math.PI) / 180) * DEFAULT_LENGTH),
      y: fallback.y + (Math.sin((fallbackAngle * Math.PI) / 180) * DEFAULT_LENGTH),
    },
  );
  return {
    ...fallbackLine,
    thickness: DEFAULT_THICKNESS,
    mode: 'polar',
    angle: fallbackAngle,
  };
}

export function getWashiNodePosition(
  geometry: Pick<ResolvedGeometry, 'from' | 'to' | 'length' | 'thickness'>,
): { x: number; y: number } {
  const centerX = (geometry.from.x + geometry.to.x) / 2;
  const centerY = (geometry.from.y + geometry.to.y) / 2;
  return {
    x: centerX - (geometry.length / 2),
    y: centerY - (geometry.thickness / 2),
  };
}
