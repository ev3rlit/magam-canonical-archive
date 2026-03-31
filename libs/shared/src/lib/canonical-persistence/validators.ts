import type {
  AssetPayload,
  CanvasHistoryCursorRecord,
  CanvasBindingRecord,
  CanvasNodeRecord,
  CanvasRevisionRecord,
  LibraryCollection,
  LibraryItemRecord,
  LibraryItemVersion,
  ObjectRelationRecord,
  PersistenceResult,
  PluginExportRecord,
  PluginInstanceRecord,
  PluginPackageRecord,
  PluginPermissionRecord,
  PluginVersionRecord,
  ReferencePayload,
  TemplatePayload,
} from './records';
import { errResult, okResult } from './records';
import type {
  CanonicalObjectRecord,
  CapabilityBag,
  ContentBlock,
  ContentCapability,
} from '../canonical-object-contract';
import {
  invalidValidation,
  isEditableNoteAlias,
  isNamespacedCustomBlockType,
  isSemanticRole,
  okValidation,
  readContentBlocks,
  type ValidationResult,
  validateObjectCore,
} from '../canonical-object-contract';
import {
  CANONICAL_BODY_SCHEMA_VERSION,
  createBodyParagraphNode,
  createCanonicalBodyDocument,
  isCanonicalBodyDocument,
  readCanonicalBody,
  readCanonicalBodySchemaVersion,
  type CanonicalBodyDocument,
  type CanonicalBodyNode,
} from '../canonical-body-document';
import {
  deriveCanonicalText,
  derivePrimaryContentKind,
} from './mappers';
import {
  isPluginCapabilitySet,
  isPluginComponentKind,
  isPluginExportName,
  isPluginManifest,
  isPluginOwnerKind,
  isPluginPackageName,
  isPluginPermissionKey,
  isPluginVersionStatus,
} from '../plugin-runtime-contract';

const CANONICAL_PAYLOAD_PROP_KEYS = new Set([
  'semanticRole',
  'semantic_role',
  'primaryContentKind',
  'primary_content_kind',
  'contentBlocks',
  'content_blocks',
  'sourceMeta',
  'source_meta',
  'capabilities',
  'capabilitySources',
  'capability_sources',
  'canonicalText',
  'canonical_text',
]);

const ALLOWED_CAPABILITY_KEYS = new Set<keyof CapabilityBag>([
  'frame',
  'material',
  'texture',
  'attach',
  'ports',
  'bubble',
  'content',
]);

export const LIBRARY_MAX_BINARY_BYTES = 25 * 1024 * 1024;
const SUPPORTED_LIBRARY_ASSET_MIME_PREFIXES = ['image/', 'text/', 'application/pdf', 'audio/', 'video/'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function validateBodyNode(node: CanonicalBodyNode, path: string): ValidationResult {
  if (!node || typeof node !== 'object') {
    return invalidValidation('CONTENT_CONTRACT_VIOLATION', 'body node must be an object.', path);
  }

  if (!isString(node.type)) {
    return invalidValidation('CONTENT_CONTRACT_VIOLATION', 'body node requires type.', `${path}.type`);
  }

  const allowedTypes = new Set([
    'paragraph',
    'text',
    'heading',
    'bulletList',
    'orderedList',
    'listItem',
    'taskList',
    'taskItem',
    'blockquote',
    'codeBlock',
    'horizontalRule',
    'image',
  ]);

  if (!allowedTypes.has(node.type)) {
    return invalidValidation('CONTENT_CONTRACT_VIOLATION', `Unsupported body node type ${node.type}.`, `${path}.type`);
  }

  if ('text' in node && node.text !== undefined && !isString(node.text)) {
    return invalidValidation('CONTENT_CONTRACT_VIOLATION', 'body text nodes require string text.', `${path}.text`);
  }

  if ('marks' in node && node.marks !== undefined && !Array.isArray(node.marks)) {
    return invalidValidation('CONTENT_CONTRACT_VIOLATION', 'body marks must be an array.', `${path}.marks`);
  }

  if (Array.isArray(node.marks)) {
    const allowedMarks = new Set(['bold', 'italic', 'strike', 'code', 'link']);
    for (let index = 0; index < node.marks.length; index += 1) {
      const mark = node.marks[index];
      if (!mark || typeof mark !== 'object' || !isString(mark.type) || !allowedMarks.has(mark.type)) {
        return invalidValidation('CONTENT_CONTRACT_VIOLATION', 'Unsupported body mark.', `${path}.marks.${index}.type`);
      }
      if ('attrs' in mark && mark.attrs !== undefined && !isRecord(mark.attrs)) {
        return invalidValidation('CONTENT_CONTRACT_VIOLATION', 'body mark attrs must be an object.', `${path}.marks.${index}.attrs`);
      }
    }
  }

  if ('attrs' in node && node.attrs !== undefined && !isRecord(node.attrs)) {
    return invalidValidation('CONTENT_CONTRACT_VIOLATION', 'body node attrs must be an object.', `${path}.attrs`);
  }

  if ('content' in node && node.content !== undefined && !Array.isArray(node.content)) {
    return invalidValidation('CONTENT_CONTRACT_VIOLATION', 'body node content must be an array.', `${path}.content`);
  }

  if (Array.isArray(node.content)) {
    for (let index = 0; index < node.content.length; index += 1) {
      const childValidation = validateBodyNode(node.content[index]!, `${path}.content.${index}`);
      if (!childValidation.ok) {
        return childValidation;
      }
    }
  }

  return okValidation();
}

export function validateCanonicalBody(body: CanonicalBodyDocument): ValidationResult {
  if (!isCanonicalBodyDocument(body)) {
    return invalidValidation('CONTENT_CONTRACT_VIOLATION', 'body must be a Tiptap doc node.', 'body');
  }

  for (let index = 0; index < body.content.length; index += 1) {
    const validation = validateBodyNode(body.content[index]!, `body.content.${index}`);
    if (!validation.ok) {
      return validation;
    }
  }

  return okValidation();
}

export function isBodyCapableNativeNodeType(value: unknown): value is 'shape' | 'text' | 'markdown' | 'sticky' {
  return value === 'shape'
    || value === 'text'
    || value === 'markdown'
    || value === 'sticky';
}

function toPersistenceResult<T>(validation: ValidationResult, value: T): PersistenceResult<T> {
  if (validation.ok) {
    return okResult(value);
  }

  return errResult(validation.code ?? 'INVALID_CAPABILITY_PAYLOAD', validation.message ?? 'Validation failed.', {
    ...(validation.path ? { path: validation.path } : {}),
  });
}

function validateContentCapability(content: ContentCapability, path: string): ValidationResult {
  if (content.kind === 'text') {
    if (!isString(content.value)) {
      return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.value must be a string.', `${path}.value`);
    }
    if ('fontSize' in content && content.fontSize !== undefined && !isString(content.fontSize) && !isNumber(content.fontSize)) {
      return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.fontSize must be a string or number.', `${path}.fontSize`);
    }
    return okValidation();
  }

  if (content.kind === 'markdown') {
    if (!isString(content.source)) {
      return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.source must be a string.', `${path}.source`);
    }
    return okValidation();
  }

  if (content.kind === 'media') {
    if (!isString(content.src) || content.src.length === 0) {
      return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.src must be a non-empty string.', `${path}.src`);
    }
    if ('alt' in content && content.alt !== undefined && !isString(content.alt)) {
      return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.alt must be a string.', `${path}.alt`);
    }
    if ('width' in content && content.width !== undefined && !isNumber(content.width)) {
      return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.width must be a number.', `${path}.width`);
    }
    if ('height' in content && content.height !== undefined && !isNumber(content.height)) {
      return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.height must be a number.', `${path}.height`);
    }
    return okValidation();
  }

  if (!Array.isArray(content.participants)) {
    return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.participants must be an array.', `${path}.participants`);
  }

  if (!Array.isArray(content.messages)) {
    return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.messages must be an array.', `${path}.messages`);
  }

  return okValidation();
}

export function validateCapabilityBag(capabilities: CapabilityBag): ValidationResult {
  const keys = Object.keys(capabilities) as Array<keyof CapabilityBag>;
  const unknown = keys.filter((key) => !ALLOWED_CAPABILITY_KEYS.has(key));
  if (unknown.length > 0) {
    return invalidValidation(
      'INVALID_CAPABILITY',
      `Unknown capability keys detected: ${unknown.join(', ')}`,
      'capabilities',
    );
  }

  if (capabilities.frame && !isRecord(capabilities.frame)) {
    return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'frame capability must be an object.', 'capabilities.frame');
  }
  if (capabilities.material && !isRecord(capabilities.material)) {
    return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'material capability must be an object.', 'capabilities.material');
  }
  if (capabilities.texture && !isRecord(capabilities.texture)) {
    return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'texture capability must be an object.', 'capabilities.texture');
  }
  if (capabilities.attach && !isRecord(capabilities.attach)) {
    return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'attach capability must be an object.', 'capabilities.attach');
  }
  if (capabilities.ports && (!isRecord(capabilities.ports) || !Array.isArray(capabilities.ports.ports))) {
    return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'ports.ports must be an array.', 'capabilities.ports.ports');
  }
  if (capabilities.bubble && (!isRecord(capabilities.bubble) || !isBoolean(capabilities.bubble.bubble))) {
    return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'bubble.bubble must be a boolean.', 'capabilities.bubble.bubble');
  }
  if (capabilities.content) {
    return validateContentCapability(capabilities.content, 'capabilities.content');
  }

  return okValidation();
}

export function isEditableNoteLikeRecord(
  record: Pick<CanonicalObjectRecord, 'semanticRole' | 'contentBlocks' | 'content_blocks' | 'body' | 'body_json'>
    & Partial<Pick<CanonicalObjectRecord, 'publicAlias'>>,
): boolean {
  const aliasEditable = record.publicAlias ? isEditableNoteAlias(record.publicAlias) : false;
  const body = readCanonicalBody(record);
  if (aliasEditable && body) {
    return true;
  }
  const contentBlocks = readContentBlocks(record);
  return aliasEditable || (Boolean(contentBlocks?.length) && (record.semanticRole === 'topic' || record.semanticRole === 'sticky-note'));
}

export function createEmptyTextBlock(blockId = 'body-1'): Extract<ContentBlock, { blockType: 'text' }> {
  return {
    id: blockId,
    blockType: 'text',
    text: '',
  };
}

export function createDefaultMarkdownContentBlock(
  blockId = 'body-1',
  source = '',
): Extract<ContentBlock, { blockType: 'markdown' }> {
  return {
    id: blockId,
    blockType: 'markdown',
    source,
  };
}

export function seedEditableNoteContentBlocks(record: CanonicalObjectRecord): CanonicalObjectRecord {
  if (!isEditableNoteLikeRecord(record)) {
    return record;
  }

  const body = readCanonicalBody(record);
  if (body) {
    return {
      ...record,
      body,
      bodySchemaVersion: readCanonicalBodySchemaVersion(record) ?? CANONICAL_BODY_SCHEMA_VERSION,
    };
  }

  const contentBlocks = readContentBlocks(record);
  if (contentBlocks && contentBlocks.length > 0) {
    return {
      ...record,
      contentBlocks,
    };
  }

  if (record.capabilities.content) {
    return record;
  }

  return {
    ...record,
    body: createCanonicalBodyDocument([createBodyParagraphNode()]),
    bodySchemaVersion: CANONICAL_BODY_SCHEMA_VERSION,
  };
}

export function validateContentBlocks(record: Pick<CanonicalObjectRecord, 'contentBlocks' | 'content_blocks'>): ValidationResult {
  const contentBlocks = readContentBlocks(record);
  if (!contentBlocks) {
    return okValidation();
  }

  const ids = new Set<string>();
  for (let index = 0; index < contentBlocks.length; index += 1) {
    const block = contentBlocks[index];
    const path = `contentBlocks.${index}`;

    if (!isString(block.id) || block.id.length === 0) {
      return invalidValidation('INVALID_CONTENT_BLOCK', 'content block id must be a non-empty string.', `${path}.id`);
    }
    if (ids.has(block.id)) {
      return invalidValidation('INVALID_CONTENT_BLOCK', `Duplicate content block id: ${block.id}`, `${path}.id`);
    }
    ids.add(block.id);

    if (block.blockType === 'text') {
      if (!isString(block.text)) {
        return invalidValidation('INVALID_CONTENT_BLOCK', 'text block requires text.', `${path}.text`);
      }
      continue;
    }

    if (block.blockType === 'markdown') {
      if (!isString(block.source)) {
        return invalidValidation('INVALID_CONTENT_BLOCK', 'markdown block requires source.', `${path}.source`);
      }
      continue;
    }

    if (!isNamespacedCustomBlockType(block.blockType)) {
      return invalidValidation('INVALID_CUSTOM_BLOCK_TYPE', 'custom block types must be namespaced.', `${path}.blockType`);
    }
    if (!isRecord(block.payload)) {
      return invalidValidation('INVALID_CONTENT_BLOCK', 'custom block payload must be an object.', `${path}.payload`);
    }
    if ('textualProjection' in block && block.textualProjection !== undefined && !isString(block.textualProjection)) {
      return invalidValidation('INVALID_CONTENT_BLOCK', 'custom block textualProjection must be a string.', `${path}.textualProjection`);
    }
    if ('metadata' in block && block.metadata !== undefined && !isRecord(block.metadata)) {
      return invalidValidation('INVALID_CONTENT_BLOCK', 'custom block metadata must be an object.', `${path}.metadata`);
    }
  }

  return okValidation();
}

export function validateCanonicalObjectRecord(record: CanonicalObjectRecord): PersistenceResult<CanonicalObjectRecord> {
  if (!isString(record.workspaceId) || record.workspaceId.length === 0) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'workspaceId is required.', { path: 'workspaceId' });
  }

  if (!isSemanticRole(record.semanticRole)) {
    return errResult('INVALID_CANONICAL_ROLE', 'semanticRole must be a supported canonical role.', {
      path: 'semanticRole',
    });
  }

  const coreValidation = validateObjectCore({
    id: record.id,
    sourceMeta: record.sourceMeta,
  });
  const objectCoreResult = toPersistenceResult(coreValidation, record);
  if (!objectCoreResult.ok) {
    return objectCoreResult;
  }

  const capabilityValidation = validateCapabilityBag(record.capabilities);
  const capabilityResult = toPersistenceResult(capabilityValidation, record);
  if (!capabilityResult.ok) {
    return capabilityResult;
  }

  const body = readCanonicalBody(record);
  if (body) {
    const bodyValidation = validateCanonicalBody(body);
    const bodyResult = toPersistenceResult(bodyValidation, record);
    if (!bodyResult.ok) {
      return bodyResult;
    }
    const bodySchemaVersion = readCanonicalBodySchemaVersion(record);
    if (bodySchemaVersion !== undefined && bodySchemaVersion !== CANONICAL_BODY_SCHEMA_VERSION) {
      return errResult('CONTENT_CONTRACT_VIOLATION', `Unsupported body schema version ${bodySchemaVersion}.`, {
        path: 'bodySchemaVersion',
      });
    }
  }

  const blockValidation = validateContentBlocks(record);
  const blockResult = toPersistenceResult(blockValidation, record);
  if (!blockResult.ok) {
    return blockResult;
  }

  const contentBlocks = readContentBlocks(record);
  if (!body && contentBlocks && contentBlocks.length > 0 && record.capabilities.content) {
    return errResult('CONTENT_BODY_CONFLICT', 'contentBlocks and capabilities.content cannot both define note body truth.', {
      path: 'contentBlocks',
    });
  }

  const seeded = seedEditableNoteContentBlocks(record);
  const projectedKind = derivePrimaryContentKind(seeded);
  if ((seeded.primaryContentKind ?? null) !== projectedKind) {
    return errResult(
      'CONTENT_CONTRACT_VIOLATION',
      `primaryContentKind must match the projected canonical body kind (${projectedKind ?? 'NULL'}).`,
      { path: 'primaryContentKind' },
    );
  }

  const projectedText = deriveCanonicalText(seeded);
  if (seeded.canonicalText !== projectedText) {
    return errResult('CONTENT_CONTRACT_VIOLATION', 'canonicalText must match the projected canonical text.', {
      path: 'canonicalText',
    });
  }

  return okResult(seeded);
}

export function validateObjectRelationRecord(record: ObjectRelationRecord): PersistenceResult<ObjectRelationRecord> {
  if (!isString(record.workspaceId) || record.workspaceId.length === 0) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'workspaceId is required.', { path: 'workspaceId' });
  }
  if (!isString(record.fromObjectId) || record.fromObjectId.length === 0) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'fromObjectId is required.', { path: 'fromObjectId' });
  }
  if (!isString(record.toObjectId) || record.toObjectId.length === 0) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'toObjectId is required.', { path: 'toObjectId' });
  }
  if (!isString(record.relationType) || record.relationType.length === 0) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'relationType is required.', { path: 'relationType' });
  }

  return okResult(record);
}

export function validateCanvasNodeRecord(record: CanvasNodeRecord): PersistenceResult<CanvasNodeRecord> {
  if (record.nodeKind === 'native' && (!record.canonicalObjectId || record.canonicalObjectId.length === 0)) {
    return errResult('CANONICAL_REFERENCE_REQUIRED', 'native nodes must reference a canonical object.', {
      path: 'canonicalObjectId',
    });
  }

  if (record.props) {
    const leakedKeys = Object.keys(record.props).filter((key) => CANONICAL_PAYLOAD_PROP_KEYS.has(key));
    if (leakedKeys.length > 0) {
      return errResult(
        'CANONICAL_CANVAS_BOUNDARY_VIOLATION',
        `canvas node props cannot own canonical payload keys: ${leakedKeys.join(', ')}`,
        { path: 'props' },
      );
    }
  }

  return okResult(record);
}

export function validateCanvasBindingRecord(record: CanvasBindingRecord): PersistenceResult<CanvasBindingRecord> {
  if (!isString(record.canvasId) || record.canvasId.length === 0) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'canvasId is required.', { path: 'canvasId' });
  }
  if (!isString(record.nodeId) || record.nodeId.length === 0) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'nodeId is required.', { path: 'nodeId' });
  }
  if (!isRecord(record.sourceRef)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'sourceRef must be an object.', { path: 'sourceRef' });
  }
  if (!isRecord(record.mapping)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'mapping must be an object.', { path: 'mapping' });
  }

  return okResult(record);
}

export function validateCanvasRevisionRecord(record: CanvasRevisionRecord): PersistenceResult<CanvasRevisionRecord> {
  if (!isString(record.canvasId) || record.canvasId.length === 0) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'canvasId is required.', { path: 'canvasId' });
  }
  if (!isNumber(record.revisionNo)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'revisionNo must be a number.', { path: 'revisionNo' });
  }
  if (!isRecord(record.mutationBatch)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'mutationBatch must be an object.', { path: 'mutationBatch' });
  }
  if (record.sessionId !== undefined && record.sessionId !== null && !isString(record.sessionId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'sessionId must be a string when provided.', { path: 'sessionId' });
  }
  if (record.runtimeHistory !== undefined && record.runtimeHistory !== null && !isRecord(record.runtimeHistory)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'runtimeHistory must be an object when provided.', { path: 'runtimeHistory' });
  }

  return okResult(record);
}

export function validateCanvasHistoryCursorRecord(record: CanvasHistoryCursorRecord): PersistenceResult<CanvasHistoryCursorRecord> {
  if (!isNonEmptyString(record.canvasId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'canvasId is required.', { path: 'canvasId' });
  }
  if (!isNonEmptyString(record.actorId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'actorId is required.', { path: 'actorId' });
  }
  if (!isNonEmptyString(record.sessionId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'sessionId is required.', { path: 'sessionId' });
  }
  if (record.undoRevisionNo !== undefined && record.undoRevisionNo !== null && !isNumber(record.undoRevisionNo)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'undoRevisionNo must be a number when provided.', {
      path: 'undoRevisionNo',
    });
  }
  if (record.redoRevisionNo !== undefined && record.redoRevisionNo !== null && !isNumber(record.redoRevisionNo)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'redoRevisionNo must be a number when provided.', {
      path: 'redoRevisionNo',
    });
  }

  return okResult(record);
}

export function validatePluginPackageRecord(record: PluginPackageRecord): PersistenceResult<PluginPackageRecord> {
  if (!isNonEmptyString(record.id)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'id is required.', { path: 'id' });
  }
  if (record.workspaceId !== undefined && record.workspaceId !== null && !isNonEmptyString(record.workspaceId)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'workspaceId must be a non-empty string when provided.', {
      path: 'workspaceId',
    });
  }
  if (!isPluginPackageName(record.packageName)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'packageName must be a namespaced plugin package key.', {
      path: 'packageName',
    });
  }
  if (!isNonEmptyString(record.displayName)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'displayName is required.', { path: 'displayName' });
  }
  if (!isPluginOwnerKind(record.ownerKind)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'ownerKind must be workspace, user, or system.', {
      path: 'ownerKind',
    });
  }
  if (!isNonEmptyString(record.ownerId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'ownerId is required.', { path: 'ownerId' });
  }

  return okResult(record);
}

export function validatePluginVersionRecord(record: PluginVersionRecord): PersistenceResult<PluginVersionRecord> {
  if (!isNonEmptyString(record.id)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'id is required.', { path: 'id' });
  }
  if (!isNonEmptyString(record.pluginPackageId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'pluginPackageId is required.', { path: 'pluginPackageId' });
  }
  if (!isNonEmptyString(record.version)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'version is required.', { path: 'version' });
  }
  if (!isPluginManifest(record.manifest)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'manifest must satisfy PluginManifest contract.', {
      path: 'manifest',
    });
  }
  if (!isNonEmptyString(record.bundleRef)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'bundleRef is required.', { path: 'bundleRef' });
  }
  if (!isNonEmptyString(record.integrityHash)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'integrityHash is required.', { path: 'integrityHash' });
  }
  if (!isPluginVersionStatus(record.status)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'status must be active, disabled, or deprecated.', {
      path: 'status',
    });
  }

  return okResult(record);
}

export function validatePluginExportRecord(record: PluginExportRecord): PersistenceResult<PluginExportRecord> {
  if (!isNonEmptyString(record.id)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'id is required.', { path: 'id' });
  }
  if (!isNonEmptyString(record.pluginVersionId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'pluginVersionId is required.', { path: 'pluginVersionId' });
  }
  if (!isPluginExportName(record.exportName)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'exportName must be a namespaced key like chart.bar.', {
      path: 'exportName',
    });
  }
  if (!isPluginComponentKind(record.componentKind)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'componentKind must be widget, panel, or inspector.', {
      path: 'componentKind',
    });
  }
  if (!isRecord(record.propSchema)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'propSchema must be an object.', { path: 'propSchema' });
  }
  if (!isRecord(record.bindingSchema)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'bindingSchema must be an object.', { path: 'bindingSchema' });
  }
  if (!isPluginCapabilitySet(record.capabilities)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'capabilities must satisfy PluginCapabilitySet.', {
      path: 'capabilities',
    });
  }

  return okResult(record);
}

export function validatePluginPermissionRecord(record: PluginPermissionRecord): PersistenceResult<PluginPermissionRecord> {
  if (!isNonEmptyString(record.id)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'id is required.', { path: 'id' });
  }
  if (!isNonEmptyString(record.pluginVersionId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'pluginVersionId is required.', { path: 'pluginVersionId' });
  }
  if (!isPluginPermissionKey(record.permissionKey)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'permissionKey must be a capability key like query:objects.', {
      path: 'permissionKey',
    });
  }
  if (!isRecord(record.permissionValue)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'permissionValue must be an object.', {
      path: 'permissionValue',
    });
  }

  return okResult(record);
}

export function validatePluginInstanceRecord(record: PluginInstanceRecord): PersistenceResult<PluginInstanceRecord> {
  if (!isNonEmptyString(record.id)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'id is required.', { path: 'id' });
  }
  if (!isNonEmptyString(record.canvasId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'canvasId is required.', { path: 'canvasId' });
  }
  if (!isNonEmptyString(record.surfaceId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'surfaceId is required.', { path: 'surfaceId' });
  }
  if (!isNonEmptyString(record.pluginExportId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'pluginExportId is required.', { path: 'pluginExportId' });
  }
  if (!isNonEmptyString(record.pluginVersionId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'pluginVersionId is required.', { path: 'pluginVersionId' });
  }
  if (!isNonEmptyString(record.displayName)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'displayName is required.', { path: 'displayName' });
  }
  if (record.props !== undefined && record.props !== null && !isRecord(record.props)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'props must be an object when provided.', { path: 'props' });
  }
  if (record.bindingConfig !== undefined && record.bindingConfig !== null && !isRecord(record.bindingConfig)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'bindingConfig must be an object when provided.', {
      path: 'bindingConfig',
    });
  }
  if (record.persistedState !== undefined && record.persistedState !== null && !isRecord(record.persistedState)) {
    return errResult('PLUGIN_CONTRACT_VIOLATION', 'persistedState must be an object when provided.', {
      path: 'persistedState',
    });
  }

  return okResult(record);
}

function validateLibraryActor(actor: unknown, path: string): PersistenceResult<{ kind: 'user' | 'system'; id: string }> {
  if (!isRecord(actor)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'createdBy must be an object.', { path });
  }
  if (actor['kind'] !== 'user' && actor['kind'] !== 'system') {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'createdBy.kind must be user or system.', {
      path: `${path}.kind`,
    });
  }
  if (!isNonEmptyString(actor['id'])) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'createdBy.id is required.', {
      path: `${path}.id`,
    });
  }
  return okResult({
    kind: actor['kind'],
    id: actor['id'],
  });
}

function validateTemplatePayload(payload: unknown): PersistenceResult<TemplatePayload> {
  if (!isRecord(payload)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'template payload must be an object.', {
      path: 'payload',
    });
  }
  if (!isNonEmptyString(payload['sourceCanvasId'])) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'template payload requires sourceCanvasId.', {
      path: 'payload.sourceCanvasId',
    });
  }
  if (payload['sourceSelection'] !== null && payload['sourceSelection'] !== undefined) {
    if (!isRecord(payload['sourceSelection'])) {
      return errResult('LIBRARY_INVALID_PAYLOAD', 'sourceSelection must be an object when provided.', {
        path: 'payload.sourceSelection',
      });
    }
    if (!isStringArray(payload['sourceSelection']['nodeIds'])) {
      return errResult('LIBRARY_INVALID_PAYLOAD', 'sourceSelection.nodeIds must be a string array.', {
        path: 'payload.sourceSelection.nodeIds',
      });
    }
    if (!isStringArray(payload['sourceSelection']['bindingIds'])) {
      return errResult('LIBRARY_INVALID_PAYLOAD', 'sourceSelection.bindingIds must be a string array.', {
        path: 'payload.sourceSelection.bindingIds',
      });
    }
  }
  if (payload['previewText'] !== null && payload['previewText'] !== undefined && !isString(payload['previewText'])) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'previewText must be a string when provided.', {
      path: 'payload.previewText',
    });
  }
  if (
    payload['previewImageAssetId'] !== null
    && payload['previewImageAssetId'] !== undefined
    && !isString(payload['previewImageAssetId'])
  ) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'previewImageAssetId must be a string when provided.', {
      path: 'payload.previewImageAssetId',
    });
  }
  if (!isRecord(payload['snapshot'])) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'template snapshot must be an object.', {
      path: 'payload.snapshot',
    });
  }

  return okResult({
    sourceCanvasId: payload['sourceCanvasId'],
    sourceSelection: payload['sourceSelection'] === null || payload['sourceSelection'] === undefined
      ? null
      : {
          nodeIds: [...(payload['sourceSelection']['nodeIds'] as string[])],
          bindingIds: [...(payload['sourceSelection']['bindingIds'] as string[])],
        },
    previewText: (payload['previewText'] as string | null | undefined) ?? null,
    previewImageAssetId: (payload['previewImageAssetId'] as string | null | undefined) ?? null,
    snapshot: payload['snapshot'],
  });
}

function validateAssetPayload(payload: unknown): PersistenceResult<AssetPayload> {
  if (!isRecord(payload)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'asset payload must be an object.', {
      path: 'payload',
    });
  }
  if (!isNonEmptyString(payload['mimeType'])) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'asset payload requires mimeType.', {
      path: 'payload.mimeType',
    });
  }
  const mimeType = payload['mimeType'];
  const supportedMime = SUPPORTED_LIBRARY_ASSET_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
  if (!supportedMime) {
    return errResult('LIBRARY_UNSUPPORTED_MIME', `Unsupported asset MIME type ${mimeType}.`, {
      path: 'payload.mimeType',
    });
  }
  if (!isUint8Array(payload['binaryData'])) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'asset payload requires binaryData as Uint8Array.', {
      path: 'payload.binaryData',
    });
  }
  if (!isNumber(payload['byteSize'])) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'asset payload requires byteSize.', {
      path: 'payload.byteSize',
    });
  }
  if (payload['byteSize'] !== payload['binaryData'].byteLength) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'asset byteSize must match binaryData length.', {
      path: 'payload.byteSize',
    });
  }
  if (payload['byteSize'] > LIBRARY_MAX_BINARY_BYTES) {
    return errResult('LIBRARY_BINARY_TOO_LARGE', `Asset exceeds ${LIBRARY_MAX_BINARY_BYTES} byte limit.`, {
      path: 'payload.byteSize',
      details: {
        byteSize: payload['byteSize'],
        maxByteSize: LIBRARY_MAX_BINARY_BYTES,
      },
    });
  }
  if (
    payload['originalFilename'] !== null
    && payload['originalFilename'] !== undefined
    && !isString(payload['originalFilename'])
  ) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'originalFilename must be a string when provided.', {
      path: 'payload.originalFilename',
    });
  }
  if (!isNonEmptyString(payload['sha256'])) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'asset payload requires sha256.', {
      path: 'payload.sha256',
    });
  }
  if (
    payload['importSource'] !== 'clipboard'
    && payload['importSource'] !== 'file'
    && payload['importSource'] !== 'url'
    && payload['importSource'] !== 'canvas-export'
  ) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'asset importSource is invalid.', {
      path: 'payload.importSource',
    });
  }
  if (payload['previewText'] !== null && payload['previewText'] !== undefined && !isString(payload['previewText'])) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'previewText must be a string when provided.', {
      path: 'payload.previewText',
    });
  }
  if (payload['imageMetadata'] !== null && payload['imageMetadata'] !== undefined) {
    if (!isRecord(payload['imageMetadata'])) {
      return errResult('LIBRARY_INVALID_PAYLOAD', 'imageMetadata must be an object when provided.', {
        path: 'payload.imageMetadata',
      });
    }
    if (!isNumber(payload['imageMetadata']['width']) || !isNumber(payload['imageMetadata']['height'])) {
      return errResult('LIBRARY_INVALID_PAYLOAD', 'imageMetadata.width and imageMetadata.height must be numbers.', {
        path: 'payload.imageMetadata',
      });
    }
  }

  return okResult({
    mimeType,
    byteSize: payload['byteSize'],
    binaryData: payload['binaryData'],
    originalFilename: (payload['originalFilename'] as string | null | undefined) ?? null,
    sha256: payload['sha256'],
    importSource: payload['importSource'],
    previewText: (payload['previewText'] as string | null | undefined) ?? null,
    imageMetadata: payload['imageMetadata'] === null || payload['imageMetadata'] === undefined
      ? null
      : {
          width: Number(payload['imageMetadata']['width']),
          height: Number(payload['imageMetadata']['height']),
        },
  });
}

function validateReferencePayload(payload: unknown): PersistenceResult<ReferencePayload> {
  if (!isRecord(payload)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'reference payload must be an object.', {
      path: 'payload',
    });
  }
  if (payload['targetKind'] !== 'url' && payload['targetKind'] !== 'canvas' && payload['targetKind'] !== 'object') {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'reference targetKind must be url, canvas, or object.', {
      path: 'payload.targetKind',
    });
  }
  if (!isNonEmptyString(payload['target'])) {
    return errResult('LIBRARY_REFERENCE_TARGET_MISSING', 'reference target is required.', {
      path: 'payload.target',
    });
  }
  if (payload['displayHint'] !== null && payload['displayHint'] !== undefined && !isString(payload['displayHint'])) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'displayHint must be a string when provided.', {
      path: 'payload.displayHint',
    });
  }
  if (payload['metadata'] !== null && payload['metadata'] !== undefined && !isRecord(payload['metadata'])) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'metadata must be an object when provided.', {
      path: 'payload.metadata',
    });
  }

  return okResult({
    targetKind: payload['targetKind'],
    target: payload['target'],
    displayHint: (payload['displayHint'] as string | null | undefined) ?? null,
    metadata: (payload['metadata'] as Record<string, unknown> | null | undefined) ?? null,
  });
}

export function validateLibraryCollection(record: LibraryCollection): PersistenceResult<LibraryCollection> {
  if (!isNonEmptyString(record.id)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'collection id is required.', { path: 'id' });
  }
  if (!isNonEmptyString(record.workspaceId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'workspaceId is required.', { path: 'workspaceId' });
  }
  if (!isNonEmptyString(record.name)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'collection name is required.', { path: 'name' });
  }
  if (record.description !== null && record.description !== undefined && !isString(record.description)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'collection description must be a string when provided.', {
      path: 'description',
    });
  }
  if (!isNumber(record.sortOrder)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'sortOrder must be a number.', { path: 'sortOrder' });
  }
  if (record.createdAt !== undefined && !isDate(record.createdAt)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'createdAt must be a valid Date when provided.', {
      path: 'createdAt',
    });
  }
  if (record.updatedAt !== undefined && !isDate(record.updatedAt)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'updatedAt must be a valid Date when provided.', {
      path: 'updatedAt',
    });
  }

  return okResult(record);
}

export function validateLibraryItemRecord(record: LibraryItemRecord): PersistenceResult<LibraryItemRecord> {
  if (!isNonEmptyString(record.id)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'library item id is required.', { path: 'id' });
  }
  if (!isNonEmptyString(record.workspaceId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'workspaceId is required.', { path: 'workspaceId' });
  }
  if (record.type !== 'template' && record.type !== 'asset' && record.type !== 'reference') {
    return errResult('LIBRARY_INVALID_ITEM_TYPE', 'library item type must be template, asset, or reference.', {
      path: 'type',
    });
  }
  if (!isNonEmptyString(record.title)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'title is required.', { path: 'title' });
  }
  if (record.summary !== null && record.summary !== undefined && !isString(record.summary)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'summary must be a string when provided.', {
      path: 'summary',
    });
  }
  if (!isStringArray(record.tags)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'tags must be a string array.', { path: 'tags' });
  }
  if (!isStringArray(record.collectionIds)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'collectionIds must be a string array.', {
      path: 'collectionIds',
    });
  }
  if (!isBoolean(record.isFavorite)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'isFavorite must be a boolean.', { path: 'isFavorite' });
  }
  if (record.visibility !== 'imported' && record.visibility !== 'curated') {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'visibility must be imported or curated.', {
      path: 'visibility',
    });
  }
  const actorValidation = validateLibraryActor(record.createdBy, 'createdBy');
  if (!actorValidation.ok) {
    return actorValidation as PersistenceResult<LibraryItemRecord>;
  }
  if (record.createdAt !== undefined && !isDate(record.createdAt)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'createdAt must be a valid Date when provided.', {
      path: 'createdAt',
    });
  }
  if (record.updatedAt !== undefined && !isDate(record.updatedAt)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'updatedAt must be a valid Date when provided.', {
      path: 'updatedAt',
    });
  }

  if (record.type === 'template') {
    const payloadValidation = validateTemplatePayload(record.payload);
    if (!payloadValidation.ok) {
      return payloadValidation as PersistenceResult<LibraryItemRecord>;
    }
  }
  if (record.type === 'asset') {
    const payloadValidation = validateAssetPayload(record.payload);
    if (!payloadValidation.ok) {
      return payloadValidation as PersistenceResult<LibraryItemRecord>;
    }
  }
  if (record.type === 'reference') {
    const payloadValidation = validateReferencePayload(record.payload);
    if (!payloadValidation.ok) {
      return payloadValidation as PersistenceResult<LibraryItemRecord>;
    }
  }

  return okResult(record);
}

export function validateLibraryItemVersion(record: LibraryItemVersion): PersistenceResult<LibraryItemVersion> {
  if (!isNonEmptyString(record.id)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'version id is required.', { path: 'id' });
  }
  if (!isNonEmptyString(record.workspaceId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'workspaceId is required.', { path: 'workspaceId' });
  }
  if (!isNonEmptyString(record.itemId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'itemId is required.', { path: 'itemId' });
  }
  if (!isNumber(record.versionNo)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'versionNo must be a number.', { path: 'versionNo' });
  }
  const snapshotValidation = validateLibraryItemRecord(record.snapshot);
  if (!snapshotValidation.ok) {
    return errResult(snapshotValidation.code, snapshotValidation.message, {
      path: snapshotValidation.path ? `snapshot.${snapshotValidation.path}` : 'snapshot',
      details: snapshotValidation.details,
    });
  }
  if (record.changeSummary !== null && record.changeSummary !== undefined && !isString(record.changeSummary)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'changeSummary must be a string when provided.', {
      path: 'changeSummary',
    });
  }
  const actorValidation = validateLibraryActor(record.createdBy, 'createdBy');
  if (!actorValidation.ok) {
    return actorValidation as PersistenceResult<LibraryItemVersion>;
  }
  if (record.createdAt !== undefined && !isDate(record.createdAt)) {
    return errResult('LIBRARY_INVALID_PAYLOAD', 'createdAt must be a valid Date when provided.', {
      path: 'createdAt',
    });
  }

  return okResult(record);
}
