import {
  PLUGIN_RUNTIME_BRIDGE_CHANNEL,
  type PluginBridgeInboundMessage,
  type PluginHostApi,
  type PluginBridgeRequest,
  type PluginBridgeResponse,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPluginBridgeInboundMessage(value: unknown): value is PluginBridgeInboundMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value.channel !== PLUGIN_RUNTIME_BRIDGE_CHANNEL) {
    return false;
  }

  const kind = value.kind;
  return (
    kind === 'plugin.request'
    || kind === 'plugin.ready'
    || kind === 'plugin.crash'
  );
}

export function isPluginBridgeRequest(value: unknown): value is PluginBridgeRequest {
  if (!isPluginBridgeInboundMessage(value)) {
    return false;
  }
  const allowedApis: Set<PluginHostApi> = new Set([
    'queryObjects',
    'getObject',
    'getSelection',
    'updateInstanceProps',
    'emitAction',
    'requestResize',
  ]);
  return value.kind === 'plugin.request'
    && typeof value.requestId === 'string'
    && typeof value.api === 'string'
    && allowedApis.has(value.api as PluginHostApi);
}

export function createPluginBridgeResponse(input: {
  requestId: string;
  ok: boolean;
  payload?: unknown;
  error?: PluginBridgeResponse['error'];
}): PluginBridgeResponse {
  return {
    channel: PLUGIN_RUNTIME_BRIDGE_CHANNEL,
    kind: 'host.response',
    requestId: input.requestId,
    ok: input.ok,
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
    ...(input.error ? { error: input.error } : {}),
  };
}
