export type JsonSchemaLike = Record<string, unknown>;
export type PluginSchema = JsonSchemaLike;

export type PluginRuntimeKind = 'iframe';
export type PluginOwnerKind = 'workspace' | 'user' | 'system';
export type PluginVersionStatus = 'active' | 'disabled' | 'deprecated';
export type PluginComponentKind = 'widget' | 'panel' | 'inspector';

export type PluginCapabilityValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | PluginCapabilityValue[];

export type PluginCapabilitySet = Record<string, PluginCapabilityValue>;
export type PluginPermissionValue = Record<string, unknown>;

export interface PluginManifest {
  runtime: PluginRuntimeKind;
  entry: string;
  exports: string[];
  capabilities: PluginCapabilitySet;
  apiVersion?: string;
}

export type PluginHostApiMethod =
  | 'queryObjects'
  | 'getObject'
  | 'getSelection'
  | 'updateInstanceProps'
  | 'emitAction'
  | 'requestResize';

export type PluginHostMethod = PluginHostApiMethod;

export interface PluginHostApiRequest {
  requestId: string;
  method: PluginHostApiMethod;
  params?: Record<string, unknown>;
}

export interface PluginHostApiSuccess {
  requestId: string;
  ok: true;
  result: Record<string, unknown> | null;
}

export interface PluginHostApiFailure {
  requestId: string;
  ok: false;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type PluginHostApiResponse = PluginHostApiSuccess | PluginHostApiFailure;

export interface PluginBridgeRequest<TPayload = Record<string, unknown>> {
  kind: 'request';
  requestId: string;
  method: PluginHostApiMethod;
  payload: TPayload;
}

export interface PluginBridgeResponse<TPayload = unknown> {
  kind: 'response';
  requestId: string;
  ok: boolean;
  payload?: TPayload;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PluginBridgeEvent<TPayload = Record<string, unknown>> {
  kind: 'event';
  event: 'ready' | 'resize' | 'action';
  payload: TPayload;
}

export type PluginBridgeEnvelope =
  | PluginBridgeRequest
  | PluginBridgeResponse
  | PluginBridgeEvent;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPluginRuntimeKind(value: unknown): value is PluginRuntimeKind {
  return value === 'iframe';
}

export function isPluginOwnerKind(value: unknown): value is PluginOwnerKind {
  return value === 'workspace' || value === 'user' || value === 'system';
}

export function isPluginVersionStatus(value: unknown): value is PluginVersionStatus {
  return value === 'active' || value === 'disabled' || value === 'deprecated';
}

export function isPluginComponentKind(value: unknown): value is PluginComponentKind {
  return value === 'widget' || value === 'panel' || value === 'inspector';
}

export function isPluginHostMethod(value: unknown): value is PluginHostMethod {
  return value === 'queryObjects'
    || value === 'getObject'
    || value === 'getSelection'
    || value === 'updateInstanceProps'
    || value === 'emitAction'
    || value === 'requestResize';
}

export function isPluginExportName(value: unknown): value is string {
  return typeof value === 'string'
    && /^[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*\.[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*$/.test(value);
}

export function isPluginPackageName(value: unknown): value is string {
  return typeof value === 'string'
    && /^(?:@[A-Za-z0-9_-]+\/)?[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*(?:\.[A-Za-z0-9_-]+(?:[.-][A-Za-z0-9_-]+)*)?$/.test(value);
}

export function isPluginPermissionKey(value: unknown): value is string {
  return typeof value === 'string'
    && /^[A-Za-z0-9_-]+:[A-Za-z0-9_.-]+$/.test(value);
}

export function isPluginCapabilitySet(value: unknown): value is PluginCapabilitySet {
  return isRecord(value);
}

export function isPluginManifest(value: unknown): value is PluginManifest {
  if (!isRecord(value)) {
    return false;
  }

  if (!isPluginRuntimeKind(value['runtime'])) {
    return false;
  }
  if (!isNonEmptyString(value['entry'])) {
    return false;
  }
  if (
    !Array.isArray(value['exports'])
    || value['exports'].length === 0
    || !value['exports'].every(isPluginExportName)
  ) {
    return false;
  }
  if (!isPluginCapabilitySet(value['capabilities'])) {
    return false;
  }
  if (value['apiVersion'] !== undefined && !isNonEmptyString(value['apiVersion'])) {
    return false;
  }

  return true;
}

export function validatePluginManifest(input: unknown): {
  ok: boolean;
  message?: string;
  path?: string;
} {
  if (!isRecord(input)) {
    return { ok: false, message: 'plugin manifest must be an object.', path: 'manifest' };
  }
  if (!isPluginRuntimeKind(input['runtime'])) {
    return { ok: false, message: 'plugin manifest runtime must be iframe.', path: 'manifest.runtime' };
  }
  if (!isNonEmptyString(input['entry'])) {
    return { ok: false, message: 'plugin manifest entry is required.', path: 'manifest.entry' };
  }
  if (!Array.isArray(input['exports']) || input['exports'].some((value) => !isPluginExportName(value))) {
    return { ok: false, message: 'plugin manifest exports must be namespaced export names.', path: 'manifest.exports' };
  }
  if (!isPluginCapabilitySet(input['capabilities'])) {
    return { ok: false, message: 'plugin manifest capabilities must be an object.', path: 'manifest.capabilities' };
  }

  return { ok: true };
}
