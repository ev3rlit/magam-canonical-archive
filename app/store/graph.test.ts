import { beforeEach, describe, expect, it } from 'bun:test';
import type { SearchResult } from '../utils/search';
import { useGraphStore } from './graph';
import { GLOBAL_FONT_STORAGE_KEY } from '../utils/fontHierarchy';

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
