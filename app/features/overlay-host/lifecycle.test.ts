import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  canDismissOverlay,
  focusOverlayOnOpen,
  resolveOpenFocusTarget,
  resolveRestoreFocusTarget,
  restoreFocusForOverlay,
} from './lifecycle';
import { installTestDom } from './testDom';

describe('overlay lifecycle', () => {
  let cleanupDom = () => {};

  beforeEach(() => {
    cleanupDom = installTestDom();
  });

  afterEach(() => {
    cleanupDom();
  });

  it('blocks outside pointer and escape dismiss when overlay is not dismissible', () => {
    expect(canDismissOverlay({ dismissible: false }, 'outside-pointer')).toBe(false);
    expect(canDismissOverlay({ dismissible: false }, 'escape-key')).toBe(false);
    expect(canDismissOverlay({ dismissible: false }, 'programmatic-close')).toBe(true);
  });

  it('focuses the first actionable element on open', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div>plain text</div>
      <button type="button" data-overlay-actionable="true" id="first-action">Action</button>
    `;
    document.body.appendChild(root);

    const focused = focusOverlayOnOpen(root, {
      openTarget: 'first-actionable',
      restoreTarget: 'none',
    });

    expect(focused).toBe(true);
    expect(resolveOpenFocusTarget(root, {
      openTarget: 'first-actionable',
      restoreTarget: 'none',
    })?.id).toBe('first-action');

    root.remove();
  });

  it('restores focus to the trigger element on close', () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.appendChild(trigger);

    const resolved = resolveRestoreFocusTarget({
      focusPolicy: {
        openTarget: 'none',
        restoreTarget: 'trigger',
      },
      triggerElement: trigger,
    });

    expect(resolved).toBe(trigger);
    expect(restoreFocusForOverlay({
      focusPolicy: {
        openTarget: 'none',
        restoreTarget: 'trigger',
      },
      triggerElement: trigger,
      selectionOwnerElement: null,
    })).toEqual({ restored: true });

    trigger.remove();
  });

  it('returns an explicit-target failure when restore id is missing', () => {
    expect(restoreFocusForOverlay({
      focusPolicy: {
        openTarget: 'none',
        restoreTarget: 'explicit-target',
        restoreTargetId: 'missing-target',
      },
      triggerElement: null,
      selectionOwnerElement: null,
    })).toEqual({
      restored: false,
      errorCode: 'OVERLAY_FOCUS_TARGET_INVALID',
    });
  });
});
