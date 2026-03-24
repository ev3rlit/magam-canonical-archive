import type {
  OverlayDismissReason,
  OverlayFocusPolicy,
  OverlayInstanceState,
} from './types';

export const OVERLAY_ACTIONABLE_SELECTOR = [
  '[data-overlay-actionable="true"]',
  '[data-context-menu-action]',
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function canDismissOverlay(
  overlay: Pick<OverlayInstanceState, 'dismissible'>,
  reason: OverlayDismissReason,
): boolean {
  if (!overlay.dismissible && (reason === 'outside-pointer' || reason === 'escape-key')) {
    return false;
  }

  return true;
}

export function isOutsideOverlay(
  root: HTMLElement | null | undefined,
  target: EventTarget | null | undefined,
): boolean {
  if (!root || !(target instanceof Node)) {
    return true;
  }

  return !root.contains(target);
}

export function resolveOpenFocusTarget(
  root: HTMLElement | null | undefined,
  focusPolicy?: OverlayFocusPolicy,
): HTMLElement | null {
  if (!root || focusPolicy?.openTarget === 'none') {
    return null;
  }

  if (focusPolicy?.openTarget === 'explicit-target' && focusPolicy.openTargetId) {
    return root.querySelector<HTMLElement>(`#${focusPolicy.openTargetId}`);
  }

  return root.querySelector<HTMLElement>(OVERLAY_ACTIONABLE_SELECTOR);
}

export function resolveRestoreFocusTarget(
  input: {
    focusPolicy?: OverlayFocusPolicy;
    triggerElement?: HTMLElement | null;
    selectionOwnerElement?: HTMLElement | null;
  },
): HTMLElement | null {
  const { focusPolicy } = input;

  if (!focusPolicy || focusPolicy.restoreTarget === 'none') {
    return null;
  }

  if (focusPolicy.restoreTarget === 'trigger') {
    return input.triggerElement ?? null;
  }

  if (focusPolicy.restoreTarget === 'selection-owner') {
    return input.selectionOwnerElement ?? null;
  }

  if (focusPolicy.restoreTarget === 'explicit-target' && focusPolicy.restoreTargetId) {
    return document.getElementById(focusPolicy.restoreTargetId);
  }

  return null;
}

export function focusOverlayOnOpen(
  root: HTMLElement | null | undefined,
  focusPolicy?: OverlayFocusPolicy,
): boolean {
  const target = resolveOpenFocusTarget(root, focusPolicy);
  if (!target) {
    return false;
  }

  target.focus();
  return document.activeElement === target;
}

export function restoreFocusForOverlay(
  overlay: Pick<OverlayInstanceState, 'focusPolicy' | 'triggerElement' | 'selectionOwnerElement'>,
): { restored: boolean; errorCode?: string } {
  const target = resolveRestoreFocusTarget({
    focusPolicy: overlay.focusPolicy,
    triggerElement: overlay.triggerElement,
    selectionOwnerElement: overlay.selectionOwnerElement,
  });

  if (!target) {
    return overlay.focusPolicy?.restoreTarget === 'explicit-target'
      ? { restored: false, errorCode: 'OVERLAY_FOCUS_TARGET_INVALID' }
      : { restored: false };
  }

  target.focus();
  return document.activeElement === target
    ? { restored: true }
    : { restored: false, errorCode: 'OVERLAY_FOCUS_RESTORE_FAILED' };
}
