import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import React from 'react';
import { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRoot, type Root } from 'react-dom/client';
import { useGraphStore } from '@/store/graph';

const createWorkspaceDocumentMock = mock(async (_input: { rootPath: string }) => ({
  documentId: 'doc-2',
  workspaceId: 'ws-1',
  filePath: 'documents/doc-2.graph.tsx',
  sourceVersion: 'sha256:doc-2',
  latestRevision: 1,
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
const navigateToDocumentMock = mock((_path: string) => {});
const navigateToWorkspaceDocumentMock = mock((_rootPath: string, _document: { filePath: string }) => {});
const navigateToDashboardMock = mock(() => {});

mock.module('@/features/host/renderer/createHostRuntime', () => ({
  getHostRuntime: () => ({
    rpc: {
      createWorkspaceDocument: createWorkspaceDocumentMock,
      upsertAppStateWorkspace: upsertAppStateWorkspaceMock,
      removeAppStateWorkspace: removeAppStateWorkspaceMock,
      setAppStateWorkspaceSession: setAppStateWorkspaceSessionMock,
      setAppStatePreference: setAppStatePreferenceMock,
    },
  }),
}));

mock.module('@/features/host/renderer/navigation', () => ({
  navigateToDashboard: navigateToDashboardMock,
  navigateToDocument: navigateToDocumentMock,
  navigateToWorkspaceDocument: navigateToWorkspaceDocumentMock,
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
        'data-testid': 'create-document',
        onClick: props.onAddAction,
      },
      'New Canvas',
    ),
  ),
}));

mock.module('../components/CanvasCard', () => ({
  CanvasCard: (props: {
    document: { title: string; absolutePath: string };
    onClick: () => void;
  }) => React.createElement(
    'button',
    {
      type: 'button',
      'data-testid': `canvas-card:${props.document.title}`,
      onClick: props.onClick,
    },
    props.document.title,
  ),
}));

mock.module('../components/CanvasListItem', () => ({
  CanvasListItem: (props: {
    document: { title: string; absolutePath: string };
    onClick: () => void;
  }) => React.createElement(
    'button',
    {
      type: 'button',
      'data-testid': `canvas-list-item:${props.document.title}`,
      onClick: props.onClick,
    },
    props.document.title,
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
        documentCount: 1,
        lastModifiedAt: Date.now(),
        lastOpenedAt: Date.now(),
      }],
      workspaceDocumentsByWorkspaceId: {
        'ws-1': [{
          documentId: 'doc-1',
          workspaceId: 'ws-1',
          latestRevision: 3,
          absolutePath: '/tmp/ws-1/docs/alpha.graph.tsx',
          relativePath: 'docs/alpha.graph.tsx',
          title: 'alpha.graph.tsx',
        }],
      },
      activeWorkspaceId: 'ws-1',
    }));
    createWorkspaceDocumentMock.mockClear();
    upsertAppStateWorkspaceMock.mockClear();
    removeAppStateWorkspaceMock.mockClear();
    setAppStateWorkspaceSessionMock.mockClear();
    setAppStatePreferenceMock.mockClear();
    navigateToDocumentMock.mockClear();
    navigateToWorkspaceDocumentMock.mockClear();
    navigateToDashboardMock.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      environment.root.unmount();
    });
    environment.container.remove();
    useGraphStore.setState(initialGraphState);
  });

  it('opens existing documents through the absolute workspace document path', async () => {
    await act(async () => {
      environment.root.render(<WorkspaceDetailPage workspaceId="ws-1" />);
    });

    const trigger = environment.dom.window.document.querySelector('[data-testid="canvas-card:alpha.graph.tsx"]');
    await act(async () => {
      trigger?.dispatchEvent(new environment.dom.window.MouseEvent('click', { bubbles: true }));
    });

    expect(navigateToDocumentMock).toHaveBeenCalledWith('/tmp/ws-1/docs/alpha.graph.tsx');
  });

  it('navigates newly created documents through the canonical workspace document helper', async () => {
    await act(async () => {
      environment.root.render(<WorkspaceDetailPage workspaceId="ws-1" />);
    });

    const trigger = environment.dom.window.document.querySelector('[data-testid="create-document"]');
    await act(async () => {
      trigger?.dispatchEvent(new environment.dom.window.MouseEvent('click', { bubbles: true }));
    });

    expect(createWorkspaceDocumentMock).toHaveBeenCalledWith({ rootPath: '/tmp/ws-1' });
    expect(navigateToWorkspaceDocumentMock).toHaveBeenCalledWith('/tmp/ws-1', expect.objectContaining({
      documentId: 'doc-2',
      filePath: 'documents/doc-2.graph.tsx',
    }));
  });
});
