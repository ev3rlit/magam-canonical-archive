'use client';

import { create } from 'zustand';
import type { LibraryCollection, LibraryItemRecord } from '@magam/explorer-library';
import { getExplorerLibraryService } from './library-service';

export type ExplorerLibraryView = 'recent' | 'imported' | 'favorites' | 'curated' | 'all';

interface ExplorerLibraryState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: LibraryItemRecord[];
  collections: LibraryCollection[];
  selectedItemId: string | null;
  searchQuery: string;
  view: ExplorerLibraryView;
  activeCollectionId: string | null;
  errorMessage: string | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  setSearchQuery: (query: string) => Promise<void>;
  setView: (view: ExplorerLibraryView) => Promise<void>;
  setActiveCollectionId: (collectionId: string | null) => Promise<void>;
  selectItem: (itemId: string | null) => void;
  saveSelectionTemplate: () => Promise<void>;
  saveCanvasTemplate: () => Promise<void>;
  importAssetFile: (file: File) => Promise<void>;
  createReference: (input: {
    title: string;
    targetKind: 'url' | 'canvas' | 'object';
    target: string;
    displayHint?: string | null;
  }) => Promise<void>;
  createCollection: (name: string) => Promise<void>;
  updateMetadata: (input: {
    itemId: string;
    title?: string;
    summary?: string | null;
    tags?: string[];
    collectionIds?: string[];
    isFavorite?: boolean;
  }) => Promise<void>;
  applyItem: (itemId: string) => Promise<void>;
  openReference: (itemId: string) => Promise<void>;
}

function resultToMessage(result: { ok: boolean; message?: string }) {
  return result.ok ? null : result.message ?? 'Operation failed.';
}

export const useExplorerLibraryStore = create<ExplorerLibraryState>((set, get) => ({
  status: 'idle',
  items: [],
  collections: [],
  selectedItemId: null,
  searchQuery: '',
  view: 'recent',
  activeCollectionId: null,
  errorMessage: null,
  initialize: async () => {
    if (get().status === 'loading' || get().status === 'ready') {
      return;
    }

    set({
      status: 'loading',
      errorMessage: null,
    });
    await get().refresh();
  },
  refresh: async () => {
    const service = await getExplorerLibraryService();
    const state = get();
    const [itemsResult, collections] = await Promise.all([
      service.listItems({
        search: state.searchQuery,
        visibility: state.view === 'imported' ? 'imported' : state.view === 'curated' ? 'curated' : undefined,
        isFavorite: state.view === 'favorites' ? true : undefined,
        collectionId: state.activeCollectionId ?? undefined,
        limit: state.view === 'recent' ? 12 : undefined,
      }),
      service.listCollections(),
    ]);

    if (!itemsResult.ok) {
      set({
        status: 'error',
        errorMessage: itemsResult.message,
      });
      return;
    }

    const selectedItemId = itemsResult.value.some((item) => item.id === state.selectedItemId)
      ? state.selectedItemId
      : itemsResult.value[0]?.id ?? null;

    set({
      status: 'ready',
      items: itemsResult.value,
      collections,
      selectedItemId,
      errorMessage: null,
    });
  },
  setSearchQuery: async (query) => {
    set({
      searchQuery: query,
    });
    await get().refresh();
  },
  setView: async (view) => {
    set({
      view,
    });
    await get().refresh();
  },
  setActiveCollectionId: async (collectionId) => {
    set({
      activeCollectionId: collectionId,
    });
    await get().refresh();
  },
  selectItem: (itemId) => {
    set({
      selectedItemId: itemId,
    });
  },
  saveSelectionTemplate: async () => {
    const service = await getExplorerLibraryService();
    const result = await service.createTemplateFromSelection();
    set({
      errorMessage: resultToMessage(result),
    });
    if (result.ok) {
      await get().refresh();
      set({
        selectedItemId: result.value.id,
      });
    }
  },
  saveCanvasTemplate: async () => {
    const service = await getExplorerLibraryService();
    const result = await service.createTemplateFromCanvas();
    set({
      errorMessage: resultToMessage(result),
    });
    if (result.ok) {
      await get().refresh();
      set({
        selectedItemId: result.value.id,
      });
    }
  },
  importAssetFile: async (file) => {
    const service = await getExplorerLibraryService();
    const result = await service.createAssetFromFile(file);
    set({
      errorMessage: resultToMessage(result),
    });
    if (result.ok) {
      await get().refresh();
      set({
        selectedItemId: result.value.id,
      });
    }
  },
  createReference: async (input) => {
    const service = await getExplorerLibraryService();
    const result = await service.createReferenceItem(input);
    set({
      errorMessage: resultToMessage(result),
    });
    if (result.ok) {
      await get().refresh();
      set({
        selectedItemId: result.value.id,
      });
    }
  },
  createCollection: async (name) => {
    const service = await getExplorerLibraryService();
    const result = await service.createCollection({ name });
    set({
      errorMessage: resultToMessage(result),
    });
    if (result.ok) {
      await get().refresh();
      set({
        activeCollectionId: result.value.id,
      });
    }
  },
  updateMetadata: async (input) => {
    const service = await getExplorerLibraryService();
    const result = await service.updateItemMetadata(input);
    set({
      errorMessage: resultToMessage(result),
    });
    if (result.ok) {
      await get().refresh();
      set({
        selectedItemId: result.value.id,
      });
    }
  },
  applyItem: async (itemId) => {
    const service = await getExplorerLibraryService();
    const result = await service.applyItemToCanvas(itemId);
    set({
      errorMessage: resultToMessage(result),
    });
  },
  openReference: async (itemId) => {
    const service = await getExplorerLibraryService();
    const result = await service.openReference(itemId);
    set({
      errorMessage: resultToMessage(result),
    });
  },
}));

export function resetExplorerLibraryStoreForTests() {
  useExplorerLibraryStore.setState({
    status: 'idle',
    items: [],
    collections: [],
    selectedItemId: null,
    searchQuery: '',
    view: 'recent',
    activeCollectionId: null,
    errorMessage: null,
  });
}
