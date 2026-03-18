import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  ContextMenu,
  clampContextMenuPosition,
  createContextMenuOverlayContribution,
} from './ContextMenu';
import type { ContextMenuContext } from '@/types/contextMenu';

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
  onClose?: (reason?: string) => void;
}) {
  await act(async () => {
    environment.root.render(
      <ContextMenu
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
  });

  afterEach(async () => {
    await act(async () => {
      environment.root.unmount();
    });
    environment.container.remove();
  });

  it('creates overlay contributions that preserve pointer anchor and slot ownership', () => {
    const contribution = createContextMenuOverlayContribution({
      slot: 'pane-context-menu',
      items: [],
      context: {
        type: 'pane',
        position: { x: 120, y: 96 },
        selectedNodeIds: [],
      },
    });

    expect(contribution.slot).toBe('pane-context-menu');
    expect(contribution.anchor).toEqual({
      type: 'pointer',
      x: 120,
      y: 96,
    });
  });

  it('closes with programmatic-close after action click', async () => {
    const onClose = mock((_reason?: string) => {});

    await renderMenu(environment, {
      context: {
        type: 'pane',
        position: { x: 20, y: 20 },
        selectedNodeIds: [],
      },
      onClose,
    });

    const button = environment.dom.window.document.querySelector('[data-context-menu-action]') as HTMLButtonElement | null;
    await act(async () => {
      button?.dispatchEvent(new environment.dom.window.MouseEvent('click', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledWith('programmatic-close');
  });

  it('clamps menu positions inside the viewport bounds', () => {
    expect(clampContextMenuPosition({
      position: { x: 980, y: 740 },
      menuSize: { width: 200, height: 120 },
      viewport: { width: 1000, height: 760 },
    })).toEqual({ x: 792, y: 632 });
  });
});
