import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import React from 'react';
import { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRoot, type Root } from 'react-dom/client';
import { FloatingToolbar } from './FloatingToolbar';
import { useGraphStore } from '@/store/graph';

type TestDom = JSDOM;

type TestEnvironment = {
  dom: TestDom;
  container: HTMLDivElement;
  root: Root;
};

const initialGraphState = useGraphStore.getState();

function installDomGlobals(dom: TestDom) {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: dom.window,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: dom.window.document,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis, 'HTMLElement', {
    configurable: true,
    value: dom.window.HTMLElement,
  });
  Object.defineProperty(globalThis, 'Node', {
    configurable: true,
    value: dom.window.Node,
  });
  Object.defineProperty(globalThis, 'MouseEvent', {
    configurable: true,
    value: dom.window.MouseEvent,
  });
  Object.defineProperty(globalThis, 'KeyboardEvent', {
    configurable: true,
    value: dom.window.KeyboardEvent,
  });
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: (id: number) => clearTimeout(id),
  });
}

function createEnvironment(): TestEnvironment {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost',
  });
  installDomGlobals(dom);
  const container = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  return { dom, container, root };
}

async function renderToolbar(environment: TestEnvironment) {
  await act(async () => {
    environment.root.render(
      <FloatingToolbar
        interactionMode="pointer"
        onInteractionModeChange={() => {}}
        createMode={null}
        onCreateModeChange={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onFitView={() => {}}
        washiPresets={[{ id: 'preset-1', label: 'Preset 1' }]}
        washiPresetEnabled
        activeWashiPresetId="preset-1"
        onSelectWashiPreset={() => {}}
      />,
    );
  });
}

describe('FloatingToolbar runtime-state integration', () => {
  let environment: TestEnvironment;

  beforeEach(() => {
    environment = createEnvironment();
    useGraphStore.setState(initialGraphState);
  });

  afterEach(async () => {
    await act(async () => {
      environment.root.unmount();
    });
    environment.container.remove();
    useGraphStore.setState(initialGraphState);
  });

  it('renders the create surface from the shared runtime-state owner', async () => {
    useGraphStore.setState((state) => ({
      ...state,
      entrypointRuntime: {
        ...state.entrypointRuntime,
        openSurface: {
          kind: 'toolbar-create-menu',
          anchorId: 'toolbar:create-anchor',
          ownerId: 'toolbar-create-menu',
          dismissOnSelectionChange: false,
          dismissOnViewportChange: false,
        },
      },
    }));

    await renderToolbar(environment);

    expect(environment.dom.window.document.body.textContent).toContain('Create on pane click');
  });

  it('disables shared-surface toggles while pending actions exist', async () => {
    useGraphStore.setState((state) => ({
      ...state,
      entrypointRuntime: {
        ...state.entrypointRuntime,
        pendingByRequestId: {
          'request-1': {
            requestId: 'request-1',
            actionType: 'node.create',
            targetIds: ['node-1'],
            status: 'pending',
            startedAt: Date.now(),
          },
        },
      },
    }));

    await renderToolbar(environment);

    const createToggle = environment.dom.window.document.querySelector('[data-floating-toolbar-create-toggle]') as HTMLButtonElement | null;
    const presetToggle = environment.dom.window.document.querySelector('[data-floating-toolbar-preset-toggle]') as HTMLButtonElement | null;

    expect(createToggle?.disabled).toBe(true);
    expect(presetToggle?.disabled).toBe(true);
  });

  it('consumes the toolbar presenter binding instead of inline runtime-state wiring', async () => {
    const source = await Bun.file(new URL('./FloatingToolbar.tsx', import.meta.url)).text();

    expect(source).toContain('resolveToolbarPresenterState({');
    expect(source).toContain('toggleToolbarCreateSurface({');
    expect(source).toContain('toggleToolbarPresetSurface({');
    expect(source).toContain('selectToolbarCreateMode({');
    expect(source).toContain('selectToolbarPreset({');
    expect(source).not.toContain('createOpenSurfaceDescriptor({');
    expect(source).not.toContain('createEntrypointAnchor({');
  });
});
