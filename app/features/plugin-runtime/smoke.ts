import { examplePluginCatalog, getExamplePluginByExportName } from './examples';
import type { PluginSmokeResult } from './examples/types';

export interface PluginInstanceSmokeRecord {
  instanceId: string;
  exportName: string;
  version: string;
  props: Record<string, unknown>;
  bindingConfig: Record<string, unknown>;
  missingPlugin: boolean;
}

interface SmokeScenarioInput {
  exportName: string;
  instanceId: string;
  updatePatch: Record<string, unknown>;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export class PluginRuntimeSmokeHarness {
  private readonly installedByExport = new Map<string, { version: string; defaults: Record<string, unknown> }>();
  private readonly instances = new Map<string, PluginInstanceSmokeRecord>();

  installExamples(): PluginSmokeResult[] {
    const results: PluginSmokeResult[] = [];
    for (const entry of examplePluginCatalog) {
      this.installedByExport.set(entry.manifest.exportName, {
        version: entry.manifest.version,
        defaults: cloneRecord(entry.defaults),
      });
      results.push({
        step: `install:${entry.manifest.exportName}`,
        ok: true,
        details: {
          packageName: entry.manifest.packageName,
          version: entry.manifest.version,
        },
      });
    }
    return results;
  }

  createInstance(input: {
    instanceId: string;
    exportName: string;
    bindingConfig?: Record<string, unknown>;
  }): PluginSmokeResult {
    const installed = this.installedByExport.get(input.exportName);
    if (!installed) {
      return {
        step: `create:${input.instanceId}`,
        ok: false,
        details: { reason: 'PLUGIN_NOT_INSTALLED', exportName: input.exportName },
      };
    }
    if (this.instances.has(input.instanceId)) {
      return {
        step: `create:${input.instanceId}`,
        ok: false,
        details: { reason: 'INSTANCE_ID_CONFLICT', instanceId: input.instanceId },
      };
    }

    this.instances.set(input.instanceId, {
      instanceId: input.instanceId,
      exportName: input.exportName,
      version: installed.version,
      props: cloneRecord(installed.defaults),
      bindingConfig: cloneRecord(input.bindingConfig ?? {}),
      missingPlugin: false,
    });

    return {
      step: `create:${input.instanceId}`,
      ok: true,
      details: { exportName: input.exportName, version: installed.version },
    };
  }

  updateInstanceProps(instanceId: string, patch: Record<string, unknown>): PluginSmokeResult {
    const existing = this.instances.get(instanceId);
    if (!existing) {
      return {
        step: `update-props:${instanceId}`,
        ok: false,
        details: { reason: 'INSTANCE_NOT_FOUND', instanceId },
      };
    }

    existing.props = {
      ...existing.props,
      ...cloneRecord(patch),
    };
    return {
      step: `update-props:${instanceId}`,
      ok: true,
      details: { patchKeys: Object.keys(patch) },
    };
  }

  markMissingPlugin(instanceId: string): PluginSmokeResult {
    const existing = this.instances.get(instanceId);
    if (!existing) {
      return {
        step: `missing-plugin:${instanceId}`,
        ok: false,
        details: { reason: 'INSTANCE_NOT_FOUND', instanceId },
      };
    }
    existing.missingPlugin = true;
    return {
      step: `missing-plugin:${instanceId}`,
      ok: true,
      details: { fallback: 'placeholder', exportName: existing.exportName },
    };
  }

  getSnapshot(instanceId: string): PluginInstanceSmokeRecord | null {
    const existing = this.instances.get(instanceId);
    if (!existing) {
      return null;
    }
    return {
      ...existing,
      props: cloneRecord(existing.props),
      bindingConfig: cloneRecord(existing.bindingConfig),
    };
  }
}

export function runPluginRuntimeSmokeScenario(input: SmokeScenarioInput): PluginSmokeResult[] {
  const harness = new PluginRuntimeSmokeHarness();
  const results: PluginSmokeResult[] = [];
  results.push(...harness.installExamples());

  const example = getExamplePluginByExportName(input.exportName);
  if (!example) {
    results.push({
      step: 'resolve-export',
      ok: false,
      details: { reason: 'EXPORT_NOT_FOUND', exportName: input.exportName },
    });
    return results;
  }

  results.push({
    step: 'resolve-export',
    ok: true,
    details: { exportName: example.manifest.exportName, packageName: example.manifest.packageName },
  });
  results.push(
    harness.createInstance({
      instanceId: input.instanceId,
      exportName: input.exportName,
    }),
  );
  results.push(harness.updateInstanceProps(input.instanceId, input.updatePatch));
  results.push(harness.markMissingPlugin(input.instanceId));

  const snapshot = harness.getSnapshot(input.instanceId);
  results.push({
    step: 'snapshot',
    ok: snapshot !== null,
    details: snapshot ? { instanceId: snapshot.instanceId, missingPlugin: snapshot.missingPlugin } : { reason: 'INSTANCE_NOT_FOUND' },
  });

  return results;
}
