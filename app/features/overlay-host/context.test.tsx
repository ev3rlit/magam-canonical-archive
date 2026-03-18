import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OverlayHostProvider, useOverlayHost } from './context';
import { createSlotContribution } from './slots';
import { createDismissTracker, setTestViewportSize } from './testUtils';
import { installTestDom } from './testDom';

function renderInHost(element: React.ReactElement): {
  root: Root;
  container: HTMLDivElement;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });

  return {
    root,
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function HostHarness(input: {
  slot?: 'pane-context-menu' | 'selection-floating-menu';
  onDismiss?: (reason: 'outside-pointer' | 'escape-key' | 'programmatic-close' | 'programmatic-replace' | 'selection-change' | 'viewport-teardown') => void;
}) {
  const host = useOverlayHost();
  return (
    <button
      id="overlay-trigger"
      type="button"
      onClick={() => {
        host.open(createSlotContribution(input.slot ?? 'pane-context-menu', {
          anchor: input.slot === 'selection-floating-menu'
            ? { type: 'selection-bounds', x: 120, y: 80, width: 60, height: 24 }
            : { type: 'pointer', x: 120, y: 160 },
          focusPolicy: {
            openTarget: 'first-actionable',
            restoreTarget: 'trigger',
          },
          triggerElement: document.getElementById('overlay-trigger') as HTMLButtonElement | null,
          onDismiss: input.onDismiss,
          render: () => (
            <div>
              <button type="button" data-overlay-actionable="true">
                Slot action
              </button>
            </div>
          ),
        }));
      }}
    >
      Open
    </button>
  );
}

describe('overlay host provider', () => {
  let cleanupDom = () => {};

  beforeEach(() => {
    cleanupDom = installTestDom();
    setTestViewportSize({ width: 800, height: 600 });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    cleanupDom();
  });

  it('renders and dismisses a slot-only overlay contribution', () => {
    const dismiss = createDismissTracker();
    const rendered = renderInHost(
      <OverlayHostProvider>
        <HostHarness slot="selection-floating-menu" onDismiss={dismiss.onDismiss} />
      </OverlayHostProvider>,
    );

    const trigger = document.getElementById('overlay-trigger') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    expect(document.querySelector('[data-overlay-slot="selection-floating-menu"]')).not.toBeNull();

    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(document.querySelector('[data-overlay-slot="selection-floating-menu"]')).toBeNull();
    expect(dismiss.reasons).toEqual(['outside-pointer']);

    rendered.unmount();
  });

  it('closes the topmost overlay on Escape', () => {
    const dismiss = createDismissTracker();
    const rendered = renderInHost(
      <OverlayHostProvider>
        <HostHarness onDismiss={dismiss.onDismiss} />
      </OverlayHostProvider>,
    );

    act(() => {
      (document.getElementById('overlay-trigger') as HTMLButtonElement).click();
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('[data-overlay-slot="pane-context-menu"]')).toBeNull();
    expect(dismiss.reasons).toEqual(['escape-key']);

    rendered.unmount();
  });
});
