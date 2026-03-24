import type { ContentBlock } from '../../../libs/shared/src/lib/canonical-object-contract';

export interface BodySlashCommandDefinition {
  command: '/' | '/markdown' | '/image';
  label: string;
  description: string;
  createBlock: (blockId: string) => ContentBlock;
}

const DEFAULT_IMAGE_BLOCK_TYPE = 'canvas.image' as const;

export const BODY_SLASH_COMMANDS: readonly BodySlashCommandDefinition[] = [
  {
    command: '/',
    label: 'Markdown block',
    description: 'Insert a new markdown body block.',
    createBlock: (blockId) => ({
      id: blockId,
      blockType: 'markdown',
      source: '',
    }),
  },
  {
    command: '/markdown',
    label: 'Markdown block',
    description: 'Insert a new markdown body block.',
    createBlock: (blockId) => ({
      id: blockId,
      blockType: 'markdown',
      source: '',
    }),
  },
  {
    command: '/image',
    label: 'Image block',
    description: 'Insert a new image body block.',
    createBlock: (blockId) => ({
      id: blockId,
      blockType: DEFAULT_IMAGE_BLOCK_TYPE,
      payload: {
        assetRef: {
          kind: 'external-url',
          value: '',
        },
        alt: '',
        caption: '',
      },
      textualProjection: '',
      metadata: {
        kind: 'image',
      },
    }),
  },
] as const;

export function resolveBodySlashCommand(rawDraft: string): BodySlashCommandDefinition | null {
  const normalizedDraft = rawDraft.trim().toLowerCase();
  return BODY_SLASH_COMMANDS.find((command) => command.command === normalizedDraft) ?? null;
}
