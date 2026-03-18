import type { PluginCapabilityKey } from '../types';

export interface ExamplePluginManifest {
  packageName: string;
  version: string;
  exportName: string;
  displayName: string;
  runtime: 'iframe';
  entry: string;
  capabilities: PluginCapabilityKey[];
  propSchema: Record<string, unknown>;
  bindingSchema: Record<string, unknown>;
}

export interface ExamplePluginModule<TProps extends Record<string, unknown>> {
  manifest: ExamplePluginManifest;
  defaults: TProps;
}

export interface PluginSmokeResult {
  step: string;
  ok: boolean;
  details?: Record<string, unknown>;
}
