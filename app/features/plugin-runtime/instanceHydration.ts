import { createPluginRuntimeDiagnostic } from './fallback';
import { loadPluginExportDescriptor } from './loader';
import type {
  PluginCapabilityKey,
  PluginHydrationResult,
  PluginNodeInstanceInput,
  PluginInstanceConfig,
} from './types';
import type { PluginRuntimeRegistry } from './registry';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeCapabilities(value: unknown): PluginCapabilityKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set<PluginCapabilityKey>([
    'query:objects',
    'object:get',
    'selection:read',
    'instance:update-props',
    'action:emit',
    'resize:request',
  ]);

  return value.filter((item): item is PluginCapabilityKey => (
    typeof item === 'string' && allowed.has(item as PluginCapabilityKey)
  ));
}

function validatePluginInstanceInput(input: PluginNodeInstanceInput): (
  | { ok: true; value: PluginInstanceConfig }
  | { ok: false; reason: string; details?: Record<string, unknown> }
) {
  const instanceId = readString(input.instanceId);
  const packageName = readString(input.packageName);
  const version = readString(input.version);
  const exportName = readString(input.exportName);

  if (!instanceId || !packageName || !version || !exportName) {
    return {
      ok: false,
      reason: 'Plugin node requires instanceId, packageName, version, and exportName.',
      details: {
        instanceId: input.instanceId,
        packageName: input.packageName,
        version: input.version,
        exportName: input.exportName,
      },
    };
  }

  return {
    ok: true,
    value: {
      instanceId,
      packageName,
      version,
      exportName,
      ...(readString(input.displayName) ? { displayName: readString(input.displayName) as string } : {}),
      props: readRecord(input.props),
      bindingConfig: readRecord(input.bindingConfig),
      persistedState: readRecord(input.persistedState),
      capabilities: normalizeCapabilities(input.capabilities),
    },
  };
}

export async function hydratePluginInstance(input: {
  nodeId: string;
  plugin: PluginNodeInstanceInput | undefined;
  registry: PluginRuntimeRegistry;
}): Promise<PluginHydrationResult> {
  if (!input.plugin) {
    return {
      ok: false,
      diagnostic: createPluginRuntimeDiagnostic({
        code: 'PLUGIN_INSTANCE_INVALID',
        stage: 'hydration',
        message: `Node ${input.nodeId} is missing plugin instance metadata.`,
      }),
    };
  }

  const validated = validatePluginInstanceInput(input.plugin);
  if (!validated.ok) {
    return {
      ok: false,
      diagnostic: createPluginRuntimeDiagnostic({
        code: 'PLUGIN_INSTANCE_INVALID',
        stage: 'hydration',
        message: validated.reason,
        ...(validated.details ? { details: validated.details } : {}),
      }),
    };
  }

  const loadResult = await loadPluginExportDescriptor({
    registry: input.registry,
    reference: {
      packageName: validated.value.packageName,
      version: validated.value.version,
      exportName: validated.value.exportName,
    },
  });

  if (!loadResult.ok) {
    return {
      ok: false,
      diagnostic: loadResult.diagnostic,
    };
  }

  const mergedCapabilities = Array.from(new Set<PluginCapabilityKey>([
    ...loadResult.descriptor.capabilities,
    ...validated.value.capabilities,
  ]));

  return {
    ok: true,
    instance: {
      ...validated.value,
      capabilities: mergedCapabilities,
    },
    descriptor: loadResult.descriptor,
  };
}

