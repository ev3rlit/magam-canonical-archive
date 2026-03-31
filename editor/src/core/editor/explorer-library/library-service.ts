'use client';

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import {
  CanonicalPersistenceRepository,
  type CanonicalDb,
  errResult,
  libraryCollections,
  libraryItemCollections,
  libraryItems,
  libraryItemVersions,
  okResult,
  toAssetItem,
  toReferenceItem,
  toTemplateItem,
  type LibraryCollection,
  type LibraryItemRecord,
  type PersistenceResult,
  type ReferenceTarget,
} from '@magam/explorer-library';
import { cloneBody } from '@/core/editor/model/editor-content-blocks';
import { getDescendantIds, getSelectionRootIds } from '@/core/editor/model/editor-geometry';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorCanvasObject, EditorReferenceTarget } from '@/core/editor/model/editor-types';

const WORKSPACE_ID = 'editor-local';
const CANVAS_ID = 'editor-canvas';
const LIBRARY_DB_URI = 'idb://magam-editor-explorer-library';

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneEditorObject(object: EditorCanvasObject): EditorCanvasObject {
  return {
    ...object,
    body: cloneBody(object.body),
    referenceTarget: object.referenceTarget ? { ...object.referenceTarget } : null,
  };
}

function isImageMimeType(mimeType: string) {
  return mimeType.startsWith('image/');
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
  const source = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest('SHA-256', source);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function readImageMetadata(file: Blob): Promise<{ width: number; height: number } | null> {
  if (!isImageMimeType(file.type)) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await Promise.race([
      new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('Failed to read image metadata.'));
        image.src = objectUrl;
      }),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), 120);
      }),
    ]);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function ensureLibraryTables(client: PGlite): Promise<void> {
  await client.query(`
    create table if not exists library_items (
      id text not null,
      workspace_id text not null,
      item_type text not null,
      title text not null,
      summary text,
      tags jsonb not null,
      is_favorite boolean default false not null,
      visibility text not null,
      payload jsonb not null,
      binary_blob text,
      search_text text not null,
      created_by jsonb not null,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null,
      constraint library_items_workspace_id_id_pk primary key (workspace_id, id)
    );
  `);
  await client.query(`
    create table if not exists library_collections (
      id text not null,
      workspace_id text not null,
      name text not null,
      description text,
      sort_order integer not null,
      created_at timestamp with time zone default now() not null,
      updated_at timestamp with time zone default now() not null,
      constraint library_collections_workspace_id_id_pk primary key (workspace_id, id)
    );
  `);
  await client.query(`
    create unique index if not exists idx_library_collections_workspace_name
    on library_collections (workspace_id, name);
  `);
  await client.query(`
    create table if not exists library_item_collections (
      workspace_id text not null,
      item_id text not null,
      collection_id text not null,
      created_at timestamp with time zone default now() not null,
      constraint library_item_collections_workspace_item_collection_pk primary key (workspace_id, item_id, collection_id)
    );
  `);
  await client.query(`
    create table if not exists library_item_versions (
      id text not null,
      workspace_id text not null,
      item_id text not null,
      version_no integer not null,
      snapshot jsonb not null,
      binary_blob text,
      change_summary text,
      created_at timestamp with time zone default now() not null,
      created_by jsonb not null,
      constraint library_item_versions_workspace_id_id_pk primary key (workspace_id, id)
    );
  `);
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }

  return new Uint8Array(await new Response(blob).arrayBuffer());
}

export class EditorExplorerLibraryService {
  private readonly repository: CanonicalPersistenceRepository;
  private readonly objectUrls = new Map<string, string>();

  constructor(private readonly client: PGlite) {
    const db = drizzle(client, {
      schema: {
        libraryItems,
        libraryCollections,
        libraryItemCollections,
        libraryItemVersions,
      },
    }) as CanonicalDb;
    this.repository = new CanonicalPersistenceRepository(db);
  }

  async close() {
    await this.client.close();
  }

  static async create(): Promise<EditorExplorerLibraryService> {
    const client = typeof indexedDB === 'undefined'
      ? new PGlite()
      : new PGlite(LIBRARY_DB_URI);
    await ensureLibraryTables(client);
    return new EditorExplorerLibraryService(client);
  }

  async listCollections() {
    return this.repository.listLibraryCollections(WORKSPACE_ID);
  }

  async createCollection(input: { name: string; description?: string | null }) {
    return this.repository.createLibraryCollection({
      id: createId('collection'),
      workspaceId: WORKSPACE_ID,
      name: input.name,
      description: input.description ?? null,
      sortOrder: Date.now(),
    });
  }

  async listItems(input?: {
    search?: string;
    type?: LibraryItemRecord['type'];
    visibility?: LibraryItemRecord['visibility'];
    isFavorite?: boolean;
    collectionId?: string;
    limit?: number;
  }) {
    if (input?.search && input.search.trim().length > 0) {
      return this.repository.searchLibraryItems(WORKSPACE_ID, input.search, input);
    }
    return this.repository.listLibraryItems(WORKSPACE_ID, input);
  }

  async getItem(itemId: string) {
    return this.repository.getLibraryItem(WORKSPACE_ID, itemId);
  }

  async createTemplateFromSelection() {
    const state = useEditorStore.getState();
    if (state.selection.ids.length === 0) {
      return errResult('LIBRARY_INVALID_PAYLOAD', 'Cannot save a template without a selection.', {
        path: 'selection.ids',
      });
    }

    const rootIds = getSelectionRootIds(state.selection.ids, state.scene.objects);
    const snapshotIds = new Set<string>();
    rootIds.forEach((rootId) => {
      snapshotIds.add(rootId);
      getDescendantIds(rootId, state.scene.objects).forEach((descendantId) => snapshotIds.add(descendantId));
    });

    const snapshotObjects = state.scene.objects
      .filter((object) => snapshotIds.has(object.id))
      .map(cloneEditorObject);
    const primary = state.scene.objects.find((object) => object.id === state.selection.primaryId) ?? snapshotObjects[0] ?? null;

    return this.repository.createLibraryItem({
      id: createId('template'),
      workspaceId: WORKSPACE_ID,
      type: 'template',
      title: primary ? `${primary.name} template` : 'Selection template',
      summary: 'Saved from current selection',
      tags: [],
      collectionIds: [],
      isFavorite: false,
      createdBy: {
        kind: 'user',
        id: 'editor',
      },
      visibility: 'curated',
      payload: {
        sourceCanvasId: CANVAS_ID,
        sourceSelection: {
          nodeIds: [...state.selection.ids],
          bindingIds: [],
        },
        previewText: primary?.name ?? null,
        previewImageAssetId: null,
        snapshot: {
          objects: snapshotObjects,
        },
      },
    }, {
      changeSummary: 'Saved selection as template',
    });
  }

  async createTemplateFromCanvas() {
    const state = useEditorStore.getState();
    return this.repository.createLibraryItem({
      id: createId('template'),
      workspaceId: WORKSPACE_ID,
      type: 'template',
      title: 'Canvas template',
      summary: 'Saved from current canvas',
      tags: [],
      collectionIds: [],
      isFavorite: false,
      createdBy: {
        kind: 'user',
        id: 'editor',
      },
      visibility: 'curated',
      payload: {
        sourceCanvasId: CANVAS_ID,
        sourceSelection: null,
        previewText: state.scene.objects[0]?.name ?? null,
        previewImageAssetId: null,
        snapshot: {
          objects: state.scene.objects.map(cloneEditorObject),
        },
      },
    }, {
      changeSummary: 'Saved canvas as template',
    });
  }

  async createAssetFromBlob(input: {
    blob: Blob;
    title: string;
    visibility: 'imported' | 'curated';
    importSource: 'clipboard' | 'file' | 'url' | 'canvas-export';
    originalFilename?: string | null;
  }): Promise<PersistenceResult<LibraryItemRecord>> {
    const bytes = await readBlobBytes(input.blob);
    const sha256 = await hashBytes(bytes);
    const imageMetadata = await readImageMetadata(input.blob);

    return this.repository.createLibraryItem({
      id: createId('asset'),
      workspaceId: WORKSPACE_ID,
      type: 'asset',
      title: input.title,
      summary: imageMetadata ? `${imageMetadata.width} x ${imageMetadata.height}` : 'Imported asset',
      tags: [],
      collectionIds: [],
      isFavorite: false,
      createdBy: {
        kind: input.visibility === 'imported' ? 'system' : 'user',
        id: input.visibility === 'imported' ? 'importer' : 'editor',
      },
      visibility: input.visibility,
      payload: {
        mimeType: input.blob.type || 'application/octet-stream',
        byteSize: bytes.byteLength,
        binaryData: bytes,
        originalFilename: input.originalFilename ?? null,
        sha256,
        importSource: input.importSource,
        previewText: input.title,
        imageMetadata,
      },
    }, {
      changeSummary: input.visibility === 'imported' ? 'Imported external asset' : 'Saved asset to library',
    });
  }

  async createAssetFromFile(file: File) {
    return this.createAssetFromBlob({
      blob: file,
      title: file.name,
      visibility: 'curated',
      importSource: 'file',
      originalFilename: file.name,
    });
  }

  async createReferenceItem(input: {
    title: string;
    targetKind: 'url' | 'canvas' | 'object';
    target: string;
    displayHint?: string | null;
  }) {
    return this.repository.createLibraryItem({
      id: createId('reference'),
      workspaceId: WORKSPACE_ID,
      type: 'reference',
      title: input.title,
      summary: input.displayHint ?? null,
      tags: [],
      collectionIds: [],
      isFavorite: false,
      createdBy: {
        kind: 'user',
        id: 'editor',
      },
      visibility: 'curated',
      payload: {
        targetKind: input.targetKind,
        target: input.target,
        displayHint: input.displayHint ?? null,
        metadata: null,
      },
    }, {
      changeSummary: 'Saved reference item',
    });
  }

  async updateItemMetadata(input: {
    itemId: string;
    title?: string;
    summary?: string | null;
    tags?: string[];
    collectionIds?: string[];
    isFavorite?: boolean;
    visibility?: LibraryItemRecord['visibility'];
  }) {
    return this.repository.updateLibraryItemMetadata({
      workspaceId: WORKSPACE_ID,
      ...input,
    });
  }

  async getAssetObjectUrl(itemId: string): Promise<PersistenceResult<string>> {
    const existing = this.objectUrls.get(itemId);
    if (existing) {
      return okResult(existing);
    }

    const item = await this.getItem(itemId);
    if (!item.ok) {
      return item as PersistenceResult<string>;
    }

    const asset = toAssetItem(item.value);
    if (!asset.ok) {
      return asset as PersistenceResult<string>;
    }

    const objectUrl = URL.createObjectURL(new Blob([Uint8Array.from(asset.value.payload.binaryData)], {
      type: asset.value.payload.mimeType,
    }));
    this.objectUrls.set(itemId, objectUrl);
    return okResult(objectUrl);
  }

  async applyItemToCanvas(itemId: string): Promise<PersistenceResult<void>> {
    const item = await this.getItem(itemId);
    if (!item.ok) {
      return item as PersistenceResult<void>;
    }

    const template = toTemplateItem(item.value);
    if (template.ok) {
      const snapshot = template.value.payload.snapshot;
      const objects = Array.isArray(snapshot['objects'])
        ? snapshot['objects'].map((object: unknown) => cloneEditorObject(object as EditorCanvasObject))
        : [];
      useEditorStore.getState().instantiateTemplateSnapshot(objects, template.value.id);
      return okResult(undefined);
    }

    const asset = toAssetItem(item.value);
    if (asset.ok) {
      const objectUrl = await this.getAssetObjectUrl(asset.value.id);
      if (!objectUrl.ok) {
        return objectUrl as PersistenceResult<void>;
      }
      useEditorStore.getState().placeLibraryAsset({
        itemId: asset.value.id,
        src: objectUrl.value,
        alt: asset.value.title,
        width: asset.value.payload.imageMetadata?.width,
        height: asset.value.payload.imageMetadata?.height,
      });
      return okResult(undefined);
    }

    const reference = toReferenceItem(item.value);
    if (!reference.ok) {
      return reference as PersistenceResult<void>;
    }
    useEditorStore.getState().placeReferenceItem({
      itemId: reference.value.id,
      title: reference.value.title,
      summary: reference.value.summary,
      target: {
        kind: reference.value.payload.targetKind,
        value: reference.value.payload.target,
      },
    });
    return okResult(undefined);
  }

  async openReference(itemId: string): Promise<PersistenceResult<void>> {
    const item = await this.getItem(itemId);
    if (!item.ok) {
      return item as PersistenceResult<void>;
    }

    const reference = toReferenceItem(item.value);
    if (!reference.ok) {
      return reference as PersistenceResult<void>;
    }

    if (reference.value.payload.targetKind === 'url') {
      window.open(reference.value.payload.target, '_blank', 'noopener,noreferrer');
      return okResult(undefined);
    }

    if (reference.value.payload.targetKind === 'canvas') {
      if (reference.value.payload.target !== CANVAS_ID) {
        return errResult('LIBRARY_REFERENCE_TARGET_MISSING', `Canvas ${reference.value.payload.target} was not found.`, {
          path: 'payload.target',
        });
      }
      return okResult(undefined);
    }

    const targetObject = useEditorStore.getState().scene.objects.find((object) => object.id === reference.value.payload.target);
    if (!targetObject) {
      return errResult('LIBRARY_REFERENCE_TARGET_MISSING', `Object ${reference.value.payload.target} was not found.`, {
        path: 'payload.target',
      });
    }
    useEditorStore.getState().selectOnly(targetObject.id);
    return okResult(undefined);
  }

  async importClipboardImageAndPlace(file: File): Promise<PersistenceResult<void>> {
    const created = await this.createAssetFromBlob({
      blob: file,
      title: file.name || 'Clipboard image',
      visibility: 'imported',
      importSource: 'clipboard',
      originalFilename: file.name || null,
    });
    if (!created.ok) {
      return created as PersistenceResult<void>;
    }

    const objectUrl = await this.getAssetObjectUrl(created.value.id);
    if (!objectUrl.ok) {
      return objectUrl as PersistenceResult<void>;
    }

    useEditorStore.getState().placeLibraryAsset({
      itemId: created.value.id,
      src: objectUrl.value,
      alt: created.value.title,
    });
    return okResult(undefined);
  }

  toEditorReferenceTarget(target: ReferenceTarget): EditorReferenceTarget {
    return {
      kind: target.kind,
      value: target.value,
    };
  }
}

let servicePromise: Promise<EditorExplorerLibraryService> | null = null;

export function getExplorerLibraryService() {
  if (!servicePromise) {
    servicePromise = EditorExplorerLibraryService.create();
  }

  return servicePromise;
}

export function getExplorerWorkspaceId() {
  return WORKSPACE_ID;
}

export function getExplorerCanvasId() {
  return CANVAS_ID;
}

export async function resetExplorerLibraryServiceForTests() {
  if (!servicePromise) {
    return;
  }

  const service = await servicePromise;
  await service.close();
  servicePromise = null;
}
