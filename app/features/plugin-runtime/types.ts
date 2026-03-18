export const PLUGIN_RUNTIME_BRIDGE_CHANNEL = 'magam.plugin-runtime.v1';

export type PluginCapabilityKey =
  | 'query:objects'
  | 'object:get'
  | 'selection:read'
  | 'instance:update-props'
  | 'action:emit'
  | 'resize:request';

export type PluginHostApi =
  | 'queryObjects'
  | 'getObject'
  | 'getSelection'
  | 'updateInstanceProps'
  | 'emitAction'
  | 'requestResize';

export type PluginRuntimeFailureCode =
  | 'PLUGIN_INSTANCE_INVALID'
  | 'PLUGIN_PACKAGE_MISSING'
  | 'PLUGIN_VERSION_MISSING'
  | 'PLUGIN_EXPORT_MISSING'
  | 'PLUGIN_BUNDLE_LOAD_FAILED'
  | 'PLUGIN_RUNTIME_CRASH'
  | 'PLUGIN_CAPABILITY_DENIED'
  | 'PLUGIN_BRIDGE_PROTOCOL_ERROR';

export type PluginRuntimeStatus = 'loading' | 'ready' | 'missing' | 'crashed' | 'invalid';

export interface PluginRuntimeDiagnostic {
  code: PluginRuntimeFailureCode;
  stage: 'hydration' | 'loader' | 'bridge' | 'runtime';
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface PluginInstanceConfig {
  instanceId: string;
  packageName: string;
  version: string;
  exportName: string;
  displayName?: string;
  props: Record<string, unknown>;
  bindingConfig: Record<string, unknown>;
  persistedState: Record<string, unknown>;
  capabilities: PluginCapabilityKey[];
}

export interface PluginSandboxRenderPayload {
  html: string;
  css?: string;
  script?: string;
  initialHeight?: number;
}

export interface PluginRenderContext {
  instance: PluginInstanceConfig;
}

export interface PluginExportDescriptor {
  packageName: string;
  version: string;
  exportName: string;
  displayName: string;
  capabilities: PluginCapabilityKey[];
  render: (context: PluginRenderContext) => PluginSandboxRenderPayload;
}

export interface PluginVersionRegistration {
  packageName: string;
  version: string;
  exports: PluginExportDescriptor[];
}

export interface PluginExportReference {
  packageName: string;
  version: string;
  exportName: string;
}

export interface PluginHydrationSuccess {
  ok: true;
  instance: PluginInstanceConfig;
  descriptor: PluginExportDescriptor;
}

export interface PluginHydrationFailure {
  ok: false;
  diagnostic: PluginRuntimeDiagnostic;
}

export type PluginHydrationResult = PluginHydrationSuccess | PluginHydrationFailure;

export interface PluginNodeRuntimeState {
  status: PluginRuntimeStatus;
  diagnostic?: PluginRuntimeDiagnostic;
  updatedAt: number;
}

export interface PluginNodeInstanceInput {
  instanceId?: unknown;
  packageName?: unknown;
  version?: unknown;
  exportName?: unknown;
  displayName?: unknown;
  props?: unknown;
  bindingConfig?: unknown;
  persistedState?: unknown;
  capabilities?: unknown;
}

export interface PluginBridgeRequest {
  channel: string;
  kind: 'plugin.request';
  requestId: string;
  api: PluginHostApi;
  payload?: unknown;
}

export interface PluginBridgeReadyEvent {
  channel: string;
  kind: 'plugin.ready';
}

export interface PluginBridgeCrashEvent {
  channel: string;
  kind: 'plugin.crash';
  message?: string;
}

export interface PluginBridgeResponse {
  channel: string;
  kind: 'host.response';
  requestId: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: PluginRuntimeFailureCode | 'PLUGIN_REQUEST_INVALID';
    message: string;
    details?: Record<string, unknown>;
  };
}

export type PluginBridgeInboundMessage = (
  | PluginBridgeRequest
  | PluginBridgeReadyEvent
  | PluginBridgeCrashEvent
);

