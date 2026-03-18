import type {
  PluginCapabilityKey,
  PluginHostApi,
  PluginRuntimeDiagnostic,
} from './types';
import { createPluginRuntimeDiagnostic } from './fallback';

const HOST_API_CAPABILITY_MAP: Record<PluginHostApi, PluginCapabilityKey> = {
  queryObjects: 'query:objects',
  getObject: 'object:get',
  getSelection: 'selection:read',
  updateInstanceProps: 'instance:update-props',
  emitAction: 'action:emit',
  requestResize: 'resize:request',
};

export function getRequiredCapabilityForHostApi(api: PluginHostApi): PluginCapabilityKey {
  return HOST_API_CAPABILITY_MAP[api];
}

export function isHostApiAllowed(input: {
  api: PluginHostApi;
  declaredCapabilities: PluginCapabilityKey[];
}): boolean {
  const required = getRequiredCapabilityForHostApi(input.api);
  return input.declaredCapabilities.includes(required);
}

export function ensureHostApiAllowed(input: {
  api: PluginHostApi;
  declaredCapabilities: PluginCapabilityKey[];
}): PluginRuntimeDiagnostic | null {
  if (isHostApiAllowed(input)) {
    return null;
  }

  return createPluginRuntimeDiagnostic({
    code: 'PLUGIN_CAPABILITY_DENIED',
    stage: 'bridge',
    message: `Plugin is not allowed to call host API "${input.api}".`,
    details: {
      requiredCapability: getRequiredCapabilityForHostApi(input.api),
      declaredCapabilities: input.declaredCapabilities,
    },
  });
}

