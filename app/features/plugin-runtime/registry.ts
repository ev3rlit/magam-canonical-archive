import type {
  PluginExportDescriptor,
  PluginExportReference,
  PluginVersionRegistration,
} from './types';

function createVersionKey(packageName: string, version: string): string {
  return `${packageName}@${version}`;
}

function createExportKey(reference: PluginExportReference): string {
  return `${reference.packageName}@${reference.version}#${reference.exportName}`;
}

export class PluginRuntimeRegistry {
  private readonly versions = new Map<string, PluginVersionRegistration>();
  private readonly exports = new Map<string, PluginExportDescriptor>();

  registerVersion(registration: PluginVersionRegistration): void {
    const versionKey = createVersionKey(registration.packageName, registration.version);
    this.versions.set(versionKey, registration);

    registration.exports.forEach((descriptor) => {
      this.registerExport(descriptor);
    });
  }

  registerExport(descriptor: PluginExportDescriptor): void {
    const key = createExportKey({
      packageName: descriptor.packageName,
      version: descriptor.version,
      exportName: descriptor.exportName,
    });
    this.exports.set(key, descriptor);
  }

  hasVersion(packageName: string, version: string): boolean {
    return this.versions.has(createVersionKey(packageName, version));
  }

  hasPackage(packageName: string): boolean {
    return Array.from(this.versions.values()).some((registration) => registration.packageName === packageName);
  }

  resolveExport(reference: PluginExportReference): PluginExportDescriptor | null {
    return this.exports.get(createExportKey(reference)) ?? null;
  }

  listExports(packageName: string, version: string): PluginExportDescriptor[] {
    return Array.from(this.exports.values()).filter((descriptor) => (
      descriptor.packageName === packageName && descriptor.version === version
    ));
  }
}
