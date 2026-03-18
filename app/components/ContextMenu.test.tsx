import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ContextMenu, clampContextMenuPosition } from './ContextMenu';
import type { ContextMenuContext } from '@/types/contextMenu';
import { useGraphStore } from '@/store/graph';

type TestDom = {
  window: Window & typeof globalThis;
};

const { JSDOM }: {
  JSDOM: new (html: string, options?: { url?: string }) => TestDom;
} = require('jsdom');

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

async function renderMenu(environment: TestEnvironment, input: {
  context: ContextMenuContext;
  onClose?: () => void;
}) {
  await act(async () => {
    environment.root.render(
      <ContextMenu
        isOpen
        position={{ x: 8, y: 8 }}
        items={[{
          type: 'action',
          id: 'rename',
          label: 'Rename',
          handler: () => {},
        }]}
        context={input.context}
        onClose={input.onClose ?? (() => {})}
      />,
    );
  });
}

describe('ContextMenu runtime-state integration', () => {
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

  it('prefers the shared runtime-state anchor position when available', async () => {
    useGraphStore.setState((state) => ({
      ...state,
      entrypointRuntime: {
        ...state.entrypointRuntime,
        anchorsById: {
          'menu-anchor': {
            anchorId: 'menu-anchor',
            kind: 'pointer',
            screen: { x: 120, y: 96 },
          },
        },
      },
    }));

    await renderMenu(environment, {
      context: {
        type: 'pane',
        position: { x: 4, y: 4 },
        anchorId: 'menu-anchor',
        selectedNodeIds: [],
      },
    });

    const menu = environment.dom.window.document.querySelector('[data-context-menu-root]') as HTMLDivElement | null;
    expect(menu?.style.left).toBe('120px');
    expect(menu?.style.top).toBe('96px');
  });

  it('closes on outside click while open', async () => {
    let closed = false;

    await renderMenu(environment, {
      context: {
        type: 'pane',
        position: { x: 20, y: 20 },
        selectedNodeIds: [],
      },
      onClose: () => {
        closed = true;
      },
    });

    environment.dom.window.document.body.dispatchEvent(new environment.dom.window.MouseEvent('mousedown', { bubbles: true }));
    expect(closed).toBe(true);
  });

  it('clamps menu positions inside the viewport bounds', () => {
    expect(clampContextMenuPosition({
      position: { x: 980, y: 740 },
      menuSize: { width: 200, height: 120 },
      viewport: { width: 1000, height: 760 },
    })).toEqual({ x: 792, y: 632 });
  });
});
