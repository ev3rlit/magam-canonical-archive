import { OVERLAY_SAFE_MARGIN } from './layers';
import type {
  OverlayAnchorDescriptor,
  OverlayPlacement,
  OverlaySize,
  OverlayViewport,
} from './types';

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function resolveAnchorOrigin(
  anchor: OverlayAnchorDescriptor,
  size: OverlaySize,
  placement: OverlayPlacement,
  gap: number,
  viewport: OverlayViewport,
): { x: number; y: number } {
  if (anchor.type === 'pointer') {
    const nextX = placement === 'top-center'
      ? anchor.x - size.width / 2
      : placement === 'bottom-center'
        ? anchor.x - size.width / 2
        : anchor.x;
    const nextY = placement === 'bottom-center' ? anchor.y - size.height : anchor.y;

    return {
      x: nextX + size.width > viewport.width - OVERLAY_SAFE_MARGIN ? anchor.x - size.width : nextX,
      y: nextY + size.height > viewport.height - OVERLAY_SAFE_MARGIN ? anchor.y - size.height : nextY,
    };
  }

  if (anchor.type === 'selection-bounds') {
    const centerX = anchor.x + (anchor.width / 2);
    const aboveY = anchor.y - size.height - gap;
    const belowY = anchor.y + anchor.height + gap;

    return {
      x: centerX - (size.width / 2),
      y: aboveY < OVERLAY_SAFE_MARGIN ? belowY : aboveY,
    };
  }

  if (placement === 'bottom-center') {
    return {
      x: anchor.x - (size.width / 2),
      y: anchor.y - size.height,
    };
  }

  if (placement === 'top-center') {
    return {
      x: anchor.x - (size.width / 2),
      y: anchor.y,
    };
  }

  return {
    x: anchor.x,
    y: anchor.y,
  };
}

export function isValidOverlayAnchor(anchor: OverlayAnchorDescriptor): boolean {
  if (anchor.type === 'selection-bounds') {
    return Number.isFinite(anchor.x)
      && Number.isFinite(anchor.y)
      && Number.isFinite(anchor.width)
      && Number.isFinite(anchor.height)
      && anchor.width >= 0
      && anchor.height >= 0;
  }

  return Number.isFinite(anchor.x) && Number.isFinite(anchor.y);
}

export function resolveOverlayPosition(input: {
  anchor: OverlayAnchorDescriptor;
  placement: OverlayPlacement;
  overlaySize: OverlaySize;
  viewport: OverlayViewport;
  safeMargin?: number;
  gap?: number;
}): { x: number; y: number } {
  const safeMargin = input.safeMargin ?? OVERLAY_SAFE_MARGIN;
  const gap = input.gap ?? 12;
  const origin = resolveAnchorOrigin(
    input.anchor,
    input.overlaySize,
    input.placement,
    gap,
    input.viewport,
  );

  return {
    x: clamp(origin.x, safeMargin, input.viewport.width - input.overlaySize.width - safeMargin),
    y: clamp(origin.y, safeMargin, input.viewport.height - input.overlaySize.height - safeMargin),
  };
}

export function getWindowViewport(): OverlayViewport {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}
