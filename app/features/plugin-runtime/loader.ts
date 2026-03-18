import { createPluginRuntimeDiagnostic } from './fallback';
import type {
  PluginExportDescriptor,
  PluginExportReference,
  PluginRuntimeDiagnostic,
} from './types';
import type { PluginRuntimeRegistry } from './registry';

export type PluginLoadResult = (
  | { ok: true; descriptor: PluginExportDescriptor }
  | { ok: false; diagnostic: PluginRuntimeDiagnostic }
);

export async function loadPluginExportDescriptor(input: {
  registry: PluginRuntimeRegistry;
  reference: PluginExportReference;
}): Promise<PluginLoadResult> {
  if (!input.registry.hasPackage(input.reference.packageName)) {
    return {
      ok: false,
      diagnostic: createPluginRuntimeDiagnostic({
        code: 'PLUGIN_PACKAGE_MISSING',
        stage: 'loader',
        message: `Plugin package ${input.reference.packageName} is not installed.`,
        details: {
          packageName: input.reference.packageName,
        },
      }),
    };
  }

  if (!input.registry.hasVersion(input.reference.packageName, input.reference.version)) {
    return {
      ok: false,
      diagnostic: createPluginRuntimeDiagnostic({
        code: 'PLUGIN_VERSION_MISSING',
        stage: 'loader',
        message: `Plugin version ${input.reference.packageName}@${input.reference.version} is not installed.`,
        details: {
          packageName: input.reference.packageName,
          version: input.reference.version,
        },
      }),
    };
  }

  const descriptor = input.registry.resolveExport(input.reference);
  if (!descriptor) {
    return {
      ok: false,
      diagnostic: createPluginRuntimeDiagnostic({
        code: 'PLUGIN_EXPORT_MISSING',
        stage: 'loader',
        message: `Plugin export ${input.reference.packageName}@${input.reference.version}#${input.reference.exportName} is not installed.`,
        details: {
          packageName: input.reference.packageName,
          version: input.reference.version,
          exportName: input.reference.exportName,
        },
      }),
    };
  }

  return {
    ok: true,
    descriptor,
  };
}
