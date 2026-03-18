import type {
  CanvasBindingRecord,
  CanvasNodeRecord,
  DocumentRevisionRecord,
  ObjectRelationRecord,
  PersistenceResult,
  PluginExportRecord,
  PluginInstanceRecord,
  PluginPackageRecord,
  PluginPermissionRecord,
  PluginVersionRecord,
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
  record: Pick<CanonicalObjectRecord, 'semanticRole' | 'contentBlocks' | 'content_blocks'>
    & Partial<Pick<CanonicalObjectRecord, 'publicAlias'>>,
): boolean {
  const aliasEditable = record.publicAlias ? isEditableNoteAlias(record.publicAlias) : false;
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

export function seedEditableNoteContentBlocks(record: CanonicalObjectRecord): CanonicalObjectRecord {
  if (!isEditableNoteLikeRecord(record)) {
    return record;
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
    contentBlocks: [createEmptyTextBlock()],
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

  const blockValidation = validateContentBlocks(record);
  const blockResult = toPersistenceResult(blockValidation, record);
  if (!blockResult.ok) {
    return blockResult;
  }

  const contentBlocks = readContentBlocks(record);
  if (contentBlocks && contentBlocks.length > 0 && record.capabilities.content) {
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
  if (!isString(record.documentId) || record.documentId.length === 0) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'documentId is required.', { path: 'documentId' });
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

export function validateDocumentRevisionRecord(record: DocumentRevisionRecord): PersistenceResult<DocumentRevisionRecord> {
  if (!isString(record.documentId) || record.documentId.length === 0) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'documentId is required.', { path: 'documentId' });
  }
  if (!isNumber(record.revisionNo)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'revisionNo must be a number.', { path: 'revisionNo' });
  }
  if (!isRecord(record.mutationBatch)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'mutationBatch must be an object.', { path: 'mutationBatch' });
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
  if (!isNonEmptyString(record.documentId)) {
    return errResult('PERSISTENCE_REQUIRED_FIELD_MISSING', 'documentId is required.', { path: 'documentId' });
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
