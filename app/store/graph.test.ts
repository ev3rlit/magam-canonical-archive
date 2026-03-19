import { beforeEach, describe, expect, it } from 'bun:test';
import type { SearchResult } from '../utils/search';
import {
  LAST_ACTIVE_DOCUMENT_SESSION_STORAGE_KEY,
  useGraphStore,
} from './graph';
import { GLOBAL_FONT_STORAGE_KEY } from '../utils/fontHierarchy';

const initialGraphState = useGraphStore.getState();

const getFixtureResults = (): SearchResult[] => ([
  { type: 'element', key: 'node-a', title: 'A', score: 100, matchKind: 'exact' },
  { type: 'element', key: 'node-b', title: 'B', score: 90, matchKind: 'exact' },
]) as SearchResult[];

const resetSearchState = () => {
  useGraphStore.setState((current) => ({
    ...current,
    isSearchOpen: false,
    searchMode: 'global',
    searchQuery: '',
    searchResults: [],
    activeResultIndex: -1,
    highlightElementIds: [],
  }));
};

describe('graph metadata state', () => {
  it('clientId는 초기화 후 고정되고 sourceVersion/sourceVersions를 저장할 수 있다', () => {
    const firstClientId = useGraphStore.getState().clientId;
    expect(typeof firstClientId).toBe('string');

    useGraphStore.getState().setCurrentFile('examples/main.tsx');
    useGraphStore.getState().setGraph({
      nodes: [],
      edges: [],
      sourceVersion: 'sha256:v1',
      sourceVersions: {
        'examples/main.tsx': 'sha256:v1',
        'examples/components/auth.tsx': 'sha256:v2',
      },
    });
    useGraphStore.getState().setSourceVersionForFile('examples/components/auth.tsx', 'sha256:v3');
    useGraphStore.getState().setLastAppliedCommandId('cmd-1');

    const state = useGraphStore.getState();
    expect(state.clientId).toBe(firstClientId);
    expect(state.sourceVersion).toBe('sha256:v1');
    expect(state.sourceVersions['examples/main.tsx']).toBe('sha256:v1');
    expect(state.sourceVersions['examples/components/auth.tsx']).toBe('sha256:v3');
    expect(state.lastAppliedCommandId).toBe('cmd-1');
  });

  it('pendingActionRoutingByKey는 register/clear lifecycle을 유지한다', () => {
    useGraphStore.getState().registerPendingActionRouting({
      pendingKey: 'selection-floating-menu:selection.style.update:shape-1:sha256:v1',
      baseVersion: 'sha256:v1',
      intentId: 'selection.style.update',
      surfaceId: 'selection-floating-menu',
      filePath: 'examples/main.tsx',
      nodeId: 'shape-1',
      rollbackSteps: [],
      startedAt: 10,
    });

    expect(
      useGraphStore.getState().pendingActionRoutingByKey['selection-floating-menu:selection.style.update:shape-1:sha256:v1'],
    ).toBeDefined();

    useGraphStore.getState().clearPendingActionRouting('selection-floating-menu:selection.style.update:shape-1:sha256:v1');

    expect(
      useGraphStore.getState().pendingActionRoutingByKey['selection-floating-menu:selection.style.update:shape-1:sha256:v1'],
    ).toBeUndefined();
  });
});

describe('document session persistence', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LAST_ACTIVE_DOCUMENT_SESSION_STORAGE_KEY);
    }
    useGraphStore.setState(initialGraphState);
  });

  it('re-activates the same document tab instead of duplicating it', () => {
    const firstOpen = useGraphStore.getState().openTab('docs/overview.graph.tsx');
    const secondOpen = useGraphStore.getState().openTab('docs/overview.graph.tsx');
    const state = useGraphStore.getState();

    expect(firstOpen.status).toBe('opened');
    expect(secondOpen).toEqual({
      status: 'activated',
      tabId: firstOpen.status === 'opened' ? firstOpen.tabId : secondOpen.tabId,
    });
    expect(state.openTabs).toHaveLength(1);
    expect(state.activeTabId).toBe(firstOpen.status === 'opened' ? firstOpen.tabId : null);
    expect(state.currentFile).toBe('docs/overview.graph.tsx');
  });

  it('keeps the stored viewport and selection snapshot when switching away and back', () => {
    const firstOpen = useGraphStore.getState().openTab('docs/overview.graph.tsx');
    const secondOpen = useGraphStore.getState().openTab('docs/guide.graph.tsx');

    expect(firstOpen.status).toBe('opened');
    expect(secondOpen.status).toBe('opened');

    if (firstOpen.status !== 'opened' || secondOpen.status !== 'opened') {
      throw new Error('expected tabs to open during snapshot test');
    }

    useGraphStore.getState().updateTabSnapshot(firstOpen.tabId, {
      lastViewport: { x: 120, y: 48, zoom: 1.25 },
      lastSelection: {
        nodeIds: ['node-a'],
        edgeIds: ['edge-a'],
        updatedAt: 100,
      },
    });

    useGraphStore.getState().activateTab(secondOpen.tabId);
    useGraphStore.getState().activateTab(firstOpen.tabId);

    const restoredTab = useGraphStore.getState().openTabs.find((tab) => tab.tabId === firstOpen.tabId);
    expect(restoredTab?.lastViewport).toEqual({ x: 120, y: 48, zoom: 1.25 });
    expect(restoredTab?.lastSelection).toEqual({
      nodeIds: ['node-a'],
      edgeIds: ['edge-a'],
      updatedAt: 100,
    });
  });

  it('treats repeated tab snapshot writes as a no-op when values are unchanged', () => {
    const opened = useGraphStore.getState().openTab('docs/overview.graph.tsx');
    if (opened.status !== 'opened') {
      throw new Error('expected tab to open for snapshot no-op test');
    }

    useGraphStore.getState().updateTabSnapshot(opened.tabId, {
      lastViewport: { x: 12, y: 24, zoom: 1.1 },
      lastSelection: {
        nodeIds: ['node-a'],
        edgeIds: [],
        updatedAt: 10,
      },
    });

    const before = useGraphStore.getState();
    useGraphStore.getState().updateTabSnapshot(opened.tabId, {
      lastViewport: { x: 12, y: 24, zoom: 1.1 },
      lastSelection: {
        nodeIds: ['node-a'],
        edgeIds: [],
        updatedAt: 10,
      },
    });
    const after = useGraphStore.getState();

    expect(after).toBe(before);
  });

  it('persists lastActive document metadata per workspace source', () => {
    useGraphStore.getState().setFiles(['docs/resume.graph.tsx']);
    useGraphStore.getState().hydrateDocumentSession('workspace:docs/resume.graph.tsx');
    useGraphStore.getState().rememberLastActiveDocument('docs/resume.graph.tsx');

    expect(useGraphStore.getState().lastActiveDocumentPath).toBe('docs/resume.graph.tsx');
    if (typeof window !== 'undefined') {
      expect(
        window.localStorage.getItem(LAST_ACTIVE_DOCUMENT_SESSION_STORAGE_KEY),
      ).toContain('docs/resume.graph.tsx');
    }
  });

  it('tracks new-document empty-canvas entry state without requiring a pre-open naming gate', () => {
    useGraphStore.getState().setFiles(['docs/resume.graph.tsx']);
    useGraphStore.getState().setFileTree({
      name: 'workspace',
      path: '/',
      type: 'directory',
      children: [
        {
          name: 'docs',
          path: 'docs',
          type: 'directory',
          children: [
            {
              name: 'resume.graph.tsx',
              path: 'docs/resume.graph.tsx',
              type: 'file',
            },
          ],
        },
      ],
    });

    useGraphStore.getState().registerDraftDocument('docs/untitled-1.graph.tsx');

    expect(useGraphStore.getState().files).toContain('docs/untitled-1.graph.tsx');
    expect(useGraphStore.getState().draftDocuments).toContain('docs/untitled-1.graph.tsx');
    expect(useGraphStore.getState().fileTree?.children?.[0]?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'docs/untitled-1.graph.tsx', type: 'file' }),
      ]),
    );
  });

  it('ignores repeated empty selection commits to avoid render loops', () => {
    const before = useGraphStore.getState();
    useGraphStore.getState().setSelectedNodes([]);
    const after = useGraphStore.getState();

    expect(after).toBe(before);
  });
});

describe('font hierarchy state', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(GLOBAL_FONT_STORAGE_KEY);
    }

    useGraphStore.setState((state) => ({
      ...state,
      globalFontFamily: 'hand-gaegu',
      canvasFontFamily: undefined,
    }));
  });

  it('setGlobalFontFamily stores value in state and localStorage', () => {
    useGraphStore.getState().setGlobalFontFamily('hand-caveat');

    const state = useGraphStore.getState();
    expect(state.globalFontFamily).toBe('hand-caveat');

    if (typeof window !== 'undefined') {
      expect(window.localStorage.getItem(GLOBAL_FONT_STORAGE_KEY)).toBe('hand-caveat');
    }
  });

  it('setGraph applies canvas-level fontFamily from parser meta', () => {
    useGraphStore.getState().setGraph({
      nodes: [],
      edges: [],
      canvasFontFamily: 'sans-inter',
    });

    expect(useGraphStore.getState().canvasFontFamily).toBe('sans-inter');
  });
});

describe('mind map layout state', () => {
  it('setGraph defaults layoutType to compact when no explicit layout metadata is provided', () => {
    useGraphStore.getState().setGraph({
      nodes: [],
      edges: [],
    });

    expect(useGraphStore.getState().layoutType).toBe('compact');
  });

  it('setGraph infers compact layoutType and defaults omitted group spacing to 50', () => {
    useGraphStore.getState().setGraph({
      nodes: [],
      edges: [],
      needsAutoLayout: true,
      mindMapGroups: [
        {
          id: 'map',
          layoutType: 'compact',
          basePosition: { x: 0, y: 0 },
        },
      ],
    });

    const state = useGraphStore.getState();
    expect(state.needsAutoLayout).toBe(true);
    expect(state.layoutType).toBe('compact');
    expect(state.mindMapGroups).toEqual([
      {
        id: 'map',
        layoutType: 'compact',
        basePosition: { x: 0, y: 0 },
        spacing: 50,
      },
    ]);
  });

  it('setGraph preserves explicit compact group spacing overrides', () => {
    useGraphStore.getState().setGraph({
      nodes: [],
      edges: [],
      needsAutoLayout: true,
      layoutType: 'compact',
      mindMapGroups: [
        {
          id: 'map',
          layoutType: 'compact',
          basePosition: { x: 10, y: 20 },
          spacing: 72,
        },
      ],
    });

    expect(useGraphStore.getState().mindMapGroups).toEqual([
      {
        id: 'map',
        layoutType: 'compact',
        basePosition: { x: 10, y: 20 },
        spacing: 72,
      },
    ]);
  });
});

describe('search state', () => {
  beforeEach(() => {
    resetSearchState();
  });

  it('openSearch/closeSearch는 isSearchOpen과 하이라이트/쿼리를 초기화한다', () => {
    const { openSearch, closeSearch, setSearchHighlightElementIds, setSearchQuery } = useGraphStore.getState();

    openSearch();
    expect(useGraphStore.getState().isSearchOpen).toBe(true);

    setSearchHighlightElementIds(['node-a']);
    setSearchQuery('auth');
    closeSearch();

    const state = useGraphStore.getState();
    expect(state.isSearchOpen).toBe(false);
    expect(state.searchQuery).toBe('');
    expect(state.searchResults).toEqual([]);
    expect(state.activeResultIndex).toBe(-1);
    expect(state.highlightElementIds).toEqual([]);
  });

  it('setSearchMode는 mode 변경 시 activeResultIndex를 안전하게 리셋한다', () => {
    const { setSearchResults, setSearchMode } = useGraphStore.getState();
    setSearchResults(getFixtureResults());
    setSearchMode('page');

    const state = useGraphStore.getState();
    expect(state.searchMode).toBe('page');
    expect(state.activeResultIndex).toBe(0);
  });

  it('setSearchQuery는 결과 인덱스/하이라이트를 초기화한다', () => {
    const { setSearchResults, setSearchQuery, setSearchHighlightElementIds } = useGraphStore.getState();
    setSearchResults(getFixtureResults());
    setSearchHighlightElementIds(['node-a']);
    setSearchQuery('');

    const state = useGraphStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.searchResults).toEqual([]);
    expect(state.activeResultIndex).toBe(-1);
    expect(state.highlightElementIds).toEqual([]);
  });

  it('moveSearchActiveIndex는 상하 이동과 wrap-around 동작을 한다', () => {
    const { setSearchResults, moveSearchActiveIndex, setSearchActiveIndex } = useGraphStore.getState();
    setSearchResults(getFixtureResults());
    setSearchActiveIndex(0);
    moveSearchActiveIndex('up');

    expect(useGraphStore.getState().activeResultIndex).toBe(1);

    moveSearchActiveIndex('down');
    expect(useGraphStore.getState().activeResultIndex).toBe(0);

    moveSearchActiveIndex('up');
    expect(useGraphStore.getState().activeResultIndex).toBe(1);
  });
});

describe('sticker node updates', () => {
  it('updateNodeData는 선택된 sticker data를 현재 state 모델에 반영한다', () => {
    useGraphStore.setState((state) => ({
      ...state,
      nodes: [
        {
          id: 'sticker-1',
          type: 'sticker',
          position: { x: 0, y: 0 },
          data: { kind: 'text', text: 'before', outlineWidth: 4 },
        } as any,
      ],
    }));

    useGraphStore.getState().updateNodeData('sticker-1', {
      text: 'after',
      outlineWidth: 8,
      outlineColor: '#fff',
    });

    const nextNode = useGraphStore
      .getState()
      .nodes.find((node) => node.id === 'sticker-1');

    expect(nextNode?.data).toMatchObject({
      kind: 'text',
      text: 'after',
      outlineWidth: 8,
      outlineColor: '#fff',
    });
  });
});

describe('washi node updates', () => {
  it('updateNodeData는 선택된 washi data를 현재 state 모델에 반영한다', () => {
    useGraphStore.setState((state) => ({
      ...state,
      nodes: [
        {
          id: 'washi-1',
          type: 'washi-tape',
          position: { x: 0, y: 0 },
          data: {
            pattern: { type: 'preset', id: 'pastel-dots' },
            at: { type: 'polar', x: 0, y: 0, length: 180, thickness: 36 },
          },
        } as any,
      ],
    }));

    useGraphStore.getState().updateNodeData('washi-1', {
      pattern: { type: 'preset', id: 'kraft-grid' },
      opacity: 0.9,
    });

    const nextNode = useGraphStore
      .getState()
      .nodes.find((node) => node.id === 'washi-1');

    expect(nextNode?.data).toMatchObject({
      pattern: { type: 'preset', id: 'kraft-grid' },
      opacity: 0.9,
      at: { type: 'polar', x: 0, y: 0, length: 180, thickness: 36 },
    });
  });
});

describe('washi selection helpers', () => {
  it('selectNodesByType는 지정 타입 노드만 선택한다', () => {
    useGraphStore.setState((state) => ({
      ...state,
      nodes: [
        { id: 'w1', type: 'washi-tape', position: { x: 0, y: 0 }, data: {} } as any,
        { id: 'w2', type: 'washi-tape', position: { x: 0, y: 0 }, data: {} } as any,
        { id: 's1', type: 'sticker', position: { x: 0, y: 0 }, data: {} } as any,
      ],
      selectedNodeIds: [],
    }));

    const ids = useGraphStore.getState().selectNodesByType('washi-tape');

    expect(ids).toEqual(['w1', 'w2']);
    expect(useGraphStore.getState().selectedNodeIds).toEqual(['w1', 'w2']);
  });

  it('focusNextNodeByType는 같은 타입 내에서 선택 포커스를 순환한다', () => {
    useGraphStore.setState((state) => ({
      ...state,
      nodes: [
        { id: 'w1', type: 'washi-tape', position: { x: 0, y: 0 }, data: {} } as any,
        { id: 'w2', type: 'washi-tape', position: { x: 0, y: 0 }, data: {} } as any,
        { id: 'w3', type: 'washi-tape', position: { x: 0, y: 0 }, data: {} } as any,
      ],
      selectedNodeIds: ['w1'],
    }));

    const first = useGraphStore.getState().focusNextNodeByType('washi-tape');
    const second = useGraphStore.getState().focusNextNodeByType('washi-tape');
    const third = useGraphStore.getState().focusNextNodeByType('washi-tape');

    expect(first).toBe('w2');
    expect(second).toBe('w3');
    expect(third).toBe('w1');
    expect(useGraphStore.getState().selectedNodeIds).toEqual(['w1']);
  });
});

describe('group hover registry', () => {
  it('tracks hovered node ids per group and removes empty groups on leave', () => {
    useGraphStore.getState().registerGroupHover('map-1', 'node-a');
    useGraphStore.getState().registerGroupHover('map-1', 'node-b');
    useGraphStore.getState().registerGroupHover('map-1', 'node-a');

    expect(useGraphStore.getState().hoveredNodeIdsByGroupId).toEqual({
      'map-1': ['node-a', 'node-b'],
    });

    useGraphStore.getState().unregisterGroupHover('map-1', 'node-a');
    expect(useGraphStore.getState().hoveredNodeIdsByGroupId).toEqual({
      'map-1': ['node-b'],
    });

    useGraphStore.getState().unregisterGroupHover('map-1', 'node-b');
    expect(useGraphStore.getState().hoveredNodeIdsByGroupId).toEqual({});
  });
});

describe('entrypoint runtime state', () => {
  it('기본 runtime-only slice를 제공한다', () => {
    const state = useGraphStore.getState();

    expect(state.entrypointRuntime.activeTool).toEqual({
      interactionMode: 'pointer',
      createMode: null,
    });
    expect(state.entrypointRuntime.openSurface).toBeNull();
    expect(state.entrypointRuntime.anchorsById).toEqual({});
    expect(state.entrypointRuntime.hover).toEqual({
      nodeIdsByGroupId: {},
      targetNodeId: null,
    });
    expect(state.entrypointRuntime.pendingByRequestId).toEqual({});
  });

  it('active tool을 graph store 단일 owner로 업데이트한다', () => {
    useGraphStore.getState().setEntrypointInteractionMode('hand');
    useGraphStore.getState().setEntrypointCreateMode('shape');

    expect(useGraphStore.getState().entrypointRuntime.activeTool).toEqual({
      interactionMode: 'hand',
      createMode: 'shape',
    });
  });

  it('anchor가 없는 surface는 열지 않고 anchor 등록 후에는 연다', () => {
    useGraphStore.getState().openEntrypointSurface({
      kind: 'pane-context-menu',
      anchorId: 'missing-anchor',
      dismissOnSelectionChange: false,
      dismissOnViewportChange: true,
    });
    expect(useGraphStore.getState().entrypointRuntime.openSurface).toBeNull();

    useGraphStore.getState().registerEntrypointAnchor({
      anchorId: 'pane-anchor',
      kind: 'pointer',
      screen: { x: 10, y: 20 },
    });
    useGraphStore.getState().openEntrypointSurface({
      kind: 'pane-context-menu',
      anchorId: 'pane-anchor',
      dismissOnSelectionChange: false,
      dismissOnViewportChange: true,
    });

    expect(useGraphStore.getState().entrypointRuntime.openSurface?.kind).toBe('pane-context-menu');

    useGraphStore.getState().closeEntrypointSurface();
    expect(useGraphStore.getState().entrypointRuntime.openSurface).toBeNull();
  });

  it('selection 변경 시 selection 의존 surface를 닫고 stale selection anchor를 정리한다', () => {
    useGraphStore.getState().registerEntrypointAnchor({
      anchorId: 'selection-floating-menu:selection-bounds',
      kind: 'selection-bounds',
      nodeIds: ['node-a'],
      flow: { x: 0, y: 0 },
    });
    useGraphStore.getState().openEntrypointSurface({
      kind: 'selection-floating-menu',
      anchorId: 'selection-floating-menu:selection-bounds',
      dismissOnSelectionChange: true,
      dismissOnViewportChange: false,
    });

    useGraphStore.getState().setSelectedNodes(['node-b']);

    expect(useGraphStore.getState().entrypointRuntime.openSurface).toBeNull();
    expect(
      useGraphStore.getState().entrypointRuntime.anchorsById['selection-floating-menu:selection-bounds'],
    ).toBeUndefined();
  });

  it('viewport change dismiss는 viewport-sensitive surface만 닫는다', () => {
    useGraphStore.getState().registerEntrypointAnchor({
      anchorId: 'pane-anchor',
      kind: 'pointer',
      screen: { x: 8, y: 8 },
    });
    useGraphStore.getState().openEntrypointSurface({
      kind: 'pane-context-menu',
      anchorId: 'pane-anchor',
      dismissOnSelectionChange: false,
      dismissOnViewportChange: true,
    });

    useGraphStore.getState().dismissEntrypointSurfaceOnViewportChange();
    expect(useGraphStore.getState().entrypointRuntime.openSurface).toBeNull();
  });

  it('hover registry를 기존 hoveredNodeIdsByGroupId와 동기화한다', () => {
    useGraphStore.getState().registerGroupHover('map-2', 'node-a');
    useGraphStore.getState().registerGroupHover('map-2', 'node-b');

    expect(useGraphStore.getState().entrypointRuntime.hover.nodeIdsByGroupId).toEqual({
      'map-2': ['node-a', 'node-b'],
    });

    useGraphStore.getState().unregisterGroupHover('map-2', 'node-a');
    useGraphStore.getState().unregisterGroupHover('map-2', 'node-b');
    expect(useGraphStore.getState().entrypointRuntime.hover.nodeIdsByGroupId).toEqual({});
  });

  it('pending lifecycle을 request id 기준으로 기록하고 정리한다', () => {
    useGraphStore.getState().beginPendingUiAction({
      requestId: 'request-1',
      actionType: 'node.create',
      targetIds: ['shape'],
      startedAt: 1,
    });
    expect(useGraphStore.getState().entrypointRuntime.pendingByRequestId['request-1']?.status).toBe('pending');

    useGraphStore.getState().failPendingUiAction('request-1', 'boom');
    expect(useGraphStore.getState().entrypointRuntime.pendingByRequestId['request-1']?.status).toBe('failed');

    useGraphStore.getState().clearPendingUiAction('request-1');
    expect(useGraphStore.getState().entrypointRuntime.pendingByRequestId['request-1']).toBeUndefined();
  });

  it('edit completion은 matching command id pending entry를 자동으로 정리한다', () => {
    useGraphStore.getState().beginPendingUiAction({
      requestId: 'cmd-1',
      actionType: 'node.move.absolute',
      targetIds: ['node-1'],
      startedAt: 1,
    });

    useGraphStore.getState().pushEditCompletionEvent({
      eventId: 'event-1',
      type: 'ABSOLUTE_MOVE_COMMITTED',
      nodeId: 'node-1',
      filePath: 'examples/a.tsx',
      commandId: 'cmd-1',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: { x: 0, y: 0 },
      after: { x: 10, y: 20 },
      committedAt: Date.now(),
    });

    expect(useGraphStore.getState().entrypointRuntime.pendingByRequestId['cmd-1']).toBeUndefined();
  });

  it('graph reload는 active tool만 유지하고 open surface/anchor/pending을 초기화한다', () => {
    useGraphStore.getState().setEntrypointInteractionMode('hand');
    useGraphStore.getState().registerEntrypointAnchor({
      anchorId: 'pane-anchor',
      kind: 'pointer',
      screen: { x: 20, y: 30 },
    });
    useGraphStore.getState().openEntrypointSurface({
      kind: 'pane-context-menu',
      anchorId: 'pane-anchor',
      dismissOnSelectionChange: false,
      dismissOnViewportChange: true,
    });
    useGraphStore.getState().beginPendingUiAction({
      requestId: 'request-2',
      actionType: 'node.create',
      targetIds: ['shape'],
      startedAt: 2,
    });

    useGraphStore.getState().setGraph({
      nodes: [],
      edges: [],
    });

    const state = useGraphStore.getState().entrypointRuntime;
    expect(state.activeTool.interactionMode).toBe('hand');
    expect(state.openSurface).toBeNull();
    expect(state.anchorsById).toEqual({});
    expect(state.pendingByRequestId).toEqual({});
  });
});

describe('text edit session state', () => {
  it('active node id 기반으로 draft를 관리하고 commit 요청을 생성한다', () => {
    useGraphStore.getState().startTextEditSession({
      nodeId: 'md-1',
      initialDraft: '# hello',
      mode: 'markdown-wysiwyg',
    });
    useGraphStore.getState().updateTextEditDraft('# hello world');
    useGraphStore.getState().requestTextEditCommit('md-1');

    const state = useGraphStore.getState();
    expect(state.activeTextEditNodeId).toBe('md-1');
    expect(state.textEditDraft).toBe('# hello world');
    expect(state.textEditMode).toBe('markdown-wysiwyg');
    expect(state.pendingTextEditAction?.type).toBe('commit');
    expect(state.pendingTextEditAction?.nodeId).toBe('md-1');
  });

  it('선택이 다른 노드로 바뀌면 편집 세션을 정리한다', () => {
    useGraphStore.getState().startTextEditSession({
      nodeId: 'text-1',
      initialDraft: 'A',
      mode: 'text',
    });

    useGraphStore.getState().setSelectedNodes(['other-node']);
    const state = useGraphStore.getState();
    expect(state.activeTextEditNodeId).toBeNull();
    expect(state.textEditDraft).toBe('');
    expect(state.pendingTextEditAction).toBeNull();
  });
});

describe('edit completion history', () => {
  beforeEach(() => {
    useGraphStore.setState((state) => ({
      ...state,
      editHistoryPast: [],
      editHistoryFuture: [],
      entrypointRuntime: {
        ...state.entrypointRuntime,
        pendingByRequestId: {},
      },
    }));
  });

  it('undo/redo는 이벤트 1건 단위로 past/future를 이동한다', () => {
    const event = {
      eventId: 'event-1',
      type: 'ABSOLUTE_MOVE_COMMITTED' as const,
      nodeId: 'node-1',
      filePath: 'examples/a.tsx',
      commandId: 'cmd-1',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: { x: 10, y: 20 },
      after: { x: 30, y: 40 },
      committedAt: Date.now(),
    };

    useGraphStore.getState().pushEditCompletionEvent(event);

    const undoTarget = useGraphStore.getState().peekUndoEditEvent();
    expect(undoTarget?.eventId).toBe('event-1');
    useGraphStore.getState().commitUndoEventSuccess('event-1');
    expect(useGraphStore.getState().editHistoryPast).toEqual([]);
    expect(useGraphStore.getState().editHistoryFuture.map((item) => item.eventId)).toEqual(['event-1']);

    const redoTarget = useGraphStore.getState().peekRedoEditEvent();
    expect(redoTarget?.eventId).toBe('event-1');
    useGraphStore.getState().commitRedoEventSuccess('event-1');
    expect(useGraphStore.getState().editHistoryFuture).toEqual([]);
    expect(useGraphStore.getState().editHistoryPast.map((item) => item.eventId)).toEqual(['event-1']);
  });

  it('create/reparent 이벤트도 동일한 1-step history 규칙을 따른다', () => {
    const createEvent = {
      eventId: 'event-create',
      type: 'NODE_CREATED' as const,
      nodeId: 'shape-1',
      filePath: 'examples/a.tsx',
      commandId: 'cmd-create',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:create',
      before: { created: false },
      after: { create: { id: 'shape-1' } },
      committedAt: Date.now(),
    };
    const reparentEvent = {
      eventId: 'event-reparent',
      type: 'NODE_REPARENTED' as const,
      nodeId: 'child',
      filePath: 'examples/map.tsx',
      commandId: 'cmd-reparent',
      baseVersion: 'sha256:create',
      nextVersion: 'sha256:reparent',
      before: { parentId: 'root-a' },
      after: { parentId: 'root-b' },
      committedAt: Date.now(),
    };

    useGraphStore.getState().pushEditCompletionEvent(createEvent);
    useGraphStore.getState().pushEditCompletionEvent(reparentEvent);

    expect(useGraphStore.getState().peekUndoEditEvent()?.eventId).toBe('event-reparent');
    useGraphStore.getState().commitUndoEventSuccess('event-reparent');
    expect(useGraphStore.getState().peekUndoEditEvent()?.eventId).toBe('event-create');
    expect(useGraphStore.getState().peekRedoEditEvent()?.eventId).toBe('event-reparent');
  });
});

describe('action routing optimistic lifecycle state', () => {
  it('apply 이벤트는 pending token을 저장하고 commit/reject는 제거한다', () => {
    useGraphStore.getState().applyActionRoutingLifecycleEvent({
      phase: 'apply',
      surface: 'pane-context-menu',
      intent: 'create-node',
      optimisticToken: 'opt-1',
      rollbackToken: 'rb-1',
    });

    expect(useGraphStore.getState().actionRoutingPendingByToken).toEqual({
      'opt-1': {
        phase: 'apply',
        surface: 'pane-context-menu',
        intent: 'create-node',
        optimisticToken: 'opt-1',
        rollbackToken: 'rb-1',
      },
    });

    useGraphStore.getState().applyActionRoutingLifecycleEvent({
      phase: 'commit',
      surface: 'pane-context-menu',
      intent: 'create-node',
      optimisticToken: 'opt-1',
      rollbackToken: 'rb-1',
    });
    expect(useGraphStore.getState().actionRoutingPendingByToken).toEqual({});

    useGraphStore.getState().applyActionRoutingLifecycleEvent({
      phase: 'apply',
      surface: 'selection-floating-menu',
      intent: 'style-update',
      optimisticToken: 'opt-2',
      rollbackToken: 'rb-2',
    });
    useGraphStore.getState().applyActionRoutingLifecycleEvent({
      phase: 'reject',
      surface: 'selection-floating-menu',
      intent: 'style-update',
      optimisticToken: 'opt-2',
      rollbackToken: 'rb-2',
      reason: 'PATCH_SURFACE_VIOLATION',
    });

    expect(useGraphStore.getState().actionRoutingPendingByToken).toEqual({});
  });
});
