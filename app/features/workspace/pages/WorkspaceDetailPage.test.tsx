import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import React from 'react';
import { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRoot, type Root } from 'react-dom/client';
import { useGraphStore } from '@/store/graph';

const createWorkspaceCanvasMock = mock(async (_input: { rootPath: string }) => ({
  canvasId: 'doc-2',
  workspaceId: 'ws-1',
  title: null,
  sourceVersion: 'sha256:doc-2',
  latestRevision: 1,
}));
const listWorkspaceCanvasesMock = mock(async (_rootPath: string) => ({
  rootPath: '/tmp/ws-1',
  workspaceName: 'Workspace 1',
  health: {
    state: 'ok' as const,
  },
  canvasCount: 1,
  canvases: [{
    canvasId: 'doc-1',
    workspaceId: 'ws-1',
    latestRevision: 3,
    title: 'Untitled Canvas',
  }],
  lastModifiedAt: Date.now(),
}));
const upsertAppStateWorkspaceMock = mock(async (input: Record<string, unknown>) => ({
  ...input,
  isPinned: false,
  createdAt: new Date('2026-03-23T00:00:00Z'),
  updatedAt: new Date('2026-03-23T00:00:00Z'),
}));
const removeAppStateWorkspaceMock = mock(async (_workspaceId: string) => {});
const setAppStateWorkspaceSessionMock = mock(async (input: { activeWorkspaceId: string | null }) => ({
  singletonKey: 'global',
  activeWorkspaceId: input.activeWorkspaceId,
  updatedAt: new Date('2026-03-23T00:00:00Z'),
}));
const setAppStatePreferenceMock = mock(async (input: { key: string; valueJson: unknown }) => ({
  key: input.key,
  valueJson: input.valueJson,
  updatedAt: new Date('2026-03-23T00:00:00Z'),
}));
const navigateToCanvasMock = mock((_path: string) => {});
const navigateToDashboardMock = mock(() => {});

mock.module('@/features/host/renderer/createHostRuntime', () => ({
  getHostRuntime: () => ({
    rpc: {
      createWorkspaceCanvas: createWorkspaceCanvasMock,
      listWorkspaceCanvases: listWorkspaceCanvasesMock,
      upsertAppStateWorkspace: upsertAppStateWorkspaceMock,
      removeAppStateWorkspace: removeAppStateWorkspaceMock,
      setAppStateWorkspaceSession: setAppStateWorkspaceSessionMock,
      setAppStatePreference: setAppStatePreferenceMock,
    },
  }),
}));

mock.module('@/features/host/renderer/navigation', () => ({
  navigateToDashboard: navigateToDashboardMock,
  navigateToCanvas: navigateToCanvasMock,
}));

mock.module('../components/DashboardSidebar', () => ({
  DashboardSidebar: () => React.createElement('div', { 'data-testid': 'dashboard-sidebar' }),
}));

mock.module('../components/DashboardHeader', () => ({
  DashboardHeader: (props: {
    title: string;
    onAddAction: () => void;
  }) => React.createElement(
    'div',
    { 'data-testid': 'dashboard-header' },
    React.createElement('h1', null, props.title),
        React.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'create-canvas',
            onClick: props.onAddAction,
          },
          'New Canvas',
        ),
  ),
}));

mock.module('../components/CanvasCard', () => ({
  CanvasCard: (props: {
    canvas: { title: string; canvasId: string };
    onClick: () => void;
  }) => React.createElement(
    'button',
    {
      type: 'button',
      'data-testid': `canvas-card:${props.canvas.title}`,
      onClick: props.onClick,
    },
    props.canvas.title,
  ),
}));

mock.module('../components/CanvasListItem', () => ({
  CanvasListItem: (props: {
    canvas: { title: string; canvasId: string };
    onClick: () => void;
  }) => React.createElement(
    'button',
    {
      type: 'button',
      'data-testid': `canvas-list-item:${props.canvas.title}`,
      onClick: props.onClick,
    },
    props.canvas.title,
  ),
}));

const { WorkspaceDetailPage } = await import('./WorkspaceDetailPage');

type TestEnvironment = {
  dom: JSDOM;
  container: HTMLDivElement;
  root: Root;
};

const initialGraphState = useGraphStore.getState();

function installDomGlobals(dom: JSDOM) {
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

describe('WorkspaceDetailPage canonical navigation flows', () => {
  let environment: TestEnvironment;

  beforeEach(() => {
    environment = createEnvironment();
    useGraphStore.setState(initialGraphState);
    useGraphStore.setState((state) => ({
      ...state,
      registeredWorkspaces: [{
        id: 'ws-1',
        name: 'Workspace 1',
        rootPath: '/tmp/ws-1',
        status: 'ok',
        canvasCount: 1,
        lastModifiedAt: Date.now(),
        lastOpenedAt: Date.now(),
      }],
      workspaceCanvasesByWorkspaceId: {},
      activeWorkspaceId: 'ws-1',
    }));
    createWorkspaceCanvasMock.mockClear();
    listWorkspaceCanvasesMock.mockClear();
    upsertAppStateWorkspaceMock.mockClear();
    removeAppStateWorkspaceMock.mockClear();
    setAppStateWorkspaceSessionMock.mockClear();
    setAppStatePreferenceMock.mockClear();
    navigateToCanvasMock.mockClear();
    navigateToDashboardMock.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      environment.root.unmount();
    });
    environment.container.remove();
    useGraphStore.setState(initialGraphState);
  });

  it('opens existing canvases through the absolute workspace canvas path', async () => {
    await act(async () => {
      environment.root.render(<WorkspaceDetailPage workspaceId="ws-1" />);
    });

    expect(listWorkspaceCanvasesMock).toHaveBeenCalledWith('/tmp/ws-1');

    const trigger = environment.dom.window.document.querySelector('[data-testid="canvas-card:Untitled Canvas"]');
    await act(async () => {
      trigger?.dispatchEvent(new environment.dom.window.MouseEvent('click', { bubbles: true }));
    });

    expect(navigateToCanvasMock).toHaveBeenCalledWith('doc-1');
  });

  it('navigates newly created canvases through the canonical workspace canvas helper', async () => {
    await act(async () => {
      environment.root.render(<WorkspaceDetailPage workspaceId="ws-1" />);
    });

    const trigger = environment.dom.window.document.querySelector('[data-testid="create-canvas"]');
    await act(async () => {
      trigger?.dispatchEvent(new environment.dom.window.MouseEvent('click', { bubbles: true }));
    });

    expect(createWorkspaceCanvasMock).toHaveBeenCalledWith({ rootPath: '/tmp/ws-1' });
    expect(navigateToCanvasMock).toHaveBeenCalledWith('doc-2');
  });
});
