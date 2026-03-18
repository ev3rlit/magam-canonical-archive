import { getSemanticRoleStyleEditableKeys } from '@/features/editing/editability';
import type {
  EditCommandType,
  EditContentCarrier,
  EditRelativeCarrier,
} from '@/features/editing/editability';
import type {
  CanonicalCapabilityKey,
  CanonicalObject,
  ContentCapability,
} from '@/features/render/canonicalObject';

export interface CapabilityProfile {
  allowedCommands: EditCommandType[];
  allowedUpdateKeys: string[];
  readOnlyReason?: string;
  contentCarrier?: EditContentCarrier;
  relativeCarrier?: EditRelativeCarrier;
}

const CAPABILITY_UPDATE_KEYS: Readonly<Record<CanonicalCapabilityKey, readonly string[]>> = {
  frame: ['shape', 'fill', 'stroke', 'strokeWidth'],
  material: ['preset', 'pattern'],
  texture: ['noiseOpacity', 'glossOpacity', 'texture'],
  attach: ['target', 'position', 'offset'],
  ports: ['ports'],
  bubble: ['bubble'],
  content: [],
};

const CONTENT_KIND_UPDATE_KEYS: Readonly<Record<ContentCapability['kind'], readonly string[]>> = {
  text: ['value', 'fontSize'],
  markdown: ['source', 'size'],
  media: ['src', 'alt', 'fit', 'width', 'height'],
  sequence: ['participants', 'messages'],
};

const SOURCE_ID_READ_ONLY_REASON = '원본 sourceId를 확인할 수 없습니다.';
const SOURCE_META_READ_ONLY_REASON = '원본 sourceMeta를 찾을 수 없습니다.';

export function deriveReadOnlyReason(input: CanonicalObject): string | undefined {
  const sourceMeta = input?.core?.sourceMeta;
  if (!sourceMeta || typeof sourceMeta !== 'object') {
    return SOURCE_META_READ_ONLY_REASON;
  }

  const sourceId = (sourceMeta as { sourceId?: unknown }).sourceId;
  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    return SOURCE_ID_READ_ONLY_REASON;
  }

  return undefined;
}

export function deriveContentCarrier(input: CanonicalObject): EditContentCarrier | undefined {
  const content = input.capabilities?.content;
  if (!content) {
    return undefined;
  }

  if (content.kind === 'text') {
    return 'text-child';
  }

  if (content.kind === 'markdown') {
    return 'markdown-child';
  }

  return undefined;
}

export function deriveRelativeCarrier(input: CanonicalObject): EditRelativeCarrier | undefined {
  const attach = input.capabilities?.attach;
  if (!attach) {
    return undefined;
  }

  if (typeof attach.offset === 'number') {
    return 'at.offset';
  }

  if (typeof attach.target === 'string' || typeof attach.position === 'string') {
    return 'gap';
  }

  return undefined;
}

function isMindmapMember(input: CanonicalObject): boolean {
  return input.core.sourceMeta.kind === 'mindmap';
}

function addUnique(target: string[], source: readonly string[]): void {
  for (const entry of source) {
    if (!target.includes(entry)) {
      target.push(entry);
    }
  }
}

export function deriveAllowedUpdateKeys(input: CanonicalObject): string[] {
  const allowedUpdateKeys: string[] = [
    ...getSemanticRoleStyleEditableKeys(input.semanticRole),
  ];

  const capabilities = input.capabilities;
  Object.entries(capabilities || {}).forEach(([capabilityKey, payload]) => {
    const keys = CAPABILITY_UPDATE_KEYS[capabilityKey as CanonicalCapabilityKey];
    if (!keys) {
      return;
    }

    if (capabilityKey === 'content' && payload && typeof payload === 'object') {
      const casted = payload as { kind?: ContentCapability['kind'] };
      if (casted.kind && casted.kind in CONTENT_KIND_UPDATE_KEYS) {
        addUnique(allowedUpdateKeys, CONTENT_KIND_UPDATE_KEYS[casted.kind as ContentCapability['kind']]);
      }
      return;
    }

    addUnique(allowedUpdateKeys, keys);
  });

  return allowedUpdateKeys;
}

export function deriveAllowedCommands(context: {
  readOnlyReason?: string;
  contentCarrier?: EditContentCarrier;
  relativeCarrier?: EditRelativeCarrier;
  isMindmapMember: boolean;
  allowedUpdateKeys: string[];
}): EditCommandType[] {
  if (context.readOnlyReason) {
    return [];
  }

  const commands: EditCommandType[] = ['node.rename'];

  if (context.isMindmapMember) {
    commands.push('node.reparent', 'mindmap.child.create', 'mindmap.sibling.create');
  } else {
    commands.push('node.create');
    if (!context.relativeCarrier) {
      commands.push('node.move.absolute');
    }
  }

  if (context.relativeCarrier) {
    commands.push('node.move.relative');
  }

  if (context.contentCarrier) {
    commands.push('node.content.update');
  }

  if (context.allowedUpdateKeys.length > 0) {
    commands.push('node.style.update');
  }

  return commands;
}

export function deriveCapabilityProfile(input: CanonicalObject): CapabilityProfile {
  const profileContext = {
    readOnlyReason: deriveReadOnlyReason(input),
    contentCarrier: deriveContentCarrier(input),
    relativeCarrier: deriveRelativeCarrier(input),
    isMindmapMember: isMindmapMember(input),
    allowedUpdateKeys: deriveAllowedUpdateKeys(input),
  };

  return {
    allowedCommands: Array.from(new Set(deriveAllowedCommands(profileContext))),
    allowedUpdateKeys: profileContext.allowedUpdateKeys,
    readOnlyReason: profileContext.readOnlyReason,
    contentCarrier: profileContext.contentCarrier,
    relativeCarrier: profileContext.relativeCarrier,
  };
}

export function isCanonicalCommandAllowed(
  profile: CapabilityProfile,
  commandType: EditCommandType,
): boolean {
  return profile.allowedCommands.includes(commandType);
}
