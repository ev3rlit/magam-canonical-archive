// Feature-local draft only.
// Do not promote this file into shared runtime contracts until node-create semantics stabilize.
export type CanvasNodeBodyEditorMode = 'markdown-wysiwyg';

export type CoreCanvasNodeBodyBlockType = 'markdown' | 'image';
export type NamespacedCanvasNodeBodyBlockType = `${string}.${string}`;
export type CanvasNodeBodyBlockType =
  | CoreCanvasNodeBodyBlockType
  | NamespacedCanvasNodeBodyBlockType;

export type CoreCanvasNodeSlashCommandBlockType = 'markdown' | 'image';
export type CanvasNodeSlashCommandBlockType =
  | CoreCanvasNodeSlashCommandBlockType
  | NamespacedCanvasNodeBodyBlockType;

export interface MarkdownCanvasNodeBodyBlock {
  id: string;
  blockType: 'markdown';
  source: string;
  editorMode?: CanvasNodeBodyEditorMode;
}

export interface ImageCanvasNodeBodyBlock {
  id: string;
  blockType: 'image';
  assetRef: {
    kind: 'workspace-asset' | 'external-url';
    value: string;
  };
  alt?: string;
  caption?: string;
}

export interface CustomCanvasNodeBodyBlock {
  id: string;
  blockType: NamespacedCanvasNodeBodyBlockType;
  payload: Record<string, unknown>;
  textualProjection?: string;
  metadata?: Record<string, unknown>;
}

export type CanvasNodeBodyBlock =
  | MarkdownCanvasNodeBodyBlock
  | ImageCanvasNodeBodyBlock
  | CustomCanvasNodeBodyBlock;

export interface CanvasNodeBodyContract {
  mode: CanvasNodeBodyEditorMode;
  blocks: CanvasNodeBodyBlock[];
}

export interface CanvasNodeSlashCommandDefinition {
  command: string;
  blockType: CanvasNodeSlashCommandBlockType;
  label: string;
  description?: string;
}

export interface BodyCapableNodeProfile {
  defaultBodyMode: CanvasNodeBodyEditorMode;
  defaultInitialBlockType: 'markdown';
  slashCommandsEnabled: boolean;
}

export const DEFAULT_CANVAS_NODE_BODY_EDITOR_MODE = 'markdown-wysiwyg' as const;
export const DEFAULT_CANVAS_NODE_BODY_BLOCK_ID = 'body-1' as const;
export const DEFAULT_CANVAS_NODE_BODY_BLOCK_TYPE = 'markdown' as const;

export const DEFAULT_BODY_CAPABLE_NODE_PROFILE: BodyCapableNodeProfile = {
  defaultBodyMode: DEFAULT_CANVAS_NODE_BODY_EDITOR_MODE,
  defaultInitialBlockType: DEFAULT_CANVAS_NODE_BODY_BLOCK_TYPE,
  slashCommandsEnabled: true,
};

export function isNamespacedCanvasNodeBodyBlockType(
  value: unknown,
): value is NamespacedCanvasNodeBodyBlockType {
  return typeof value === 'string'
    && /^[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*\.[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*$/.test(value);
}

export function createDefaultCanvasNodeMarkdownBlock(
  blockId = DEFAULT_CANVAS_NODE_BODY_BLOCK_ID,
): MarkdownCanvasNodeBodyBlock {
  return {
    id: blockId,
    blockType: DEFAULT_CANVAS_NODE_BODY_BLOCK_TYPE,
    source: '',
    editorMode: DEFAULT_CANVAS_NODE_BODY_EDITOR_MODE,
  };
}
