import type {
  DesktopRuntimeConfig,
  HostCapabilitySurface,
} from './hostCapabilities';

function assertFunction(value: unknown, fieldName: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${fieldName} must be a function.`);
  }
}

export function assertAbsolutePath(path: string, fieldName = 'path'): string {
  if (!path || !path.startsWith('/')) {
    throw new Error(`${fieldName} must be an absolute path.`);
  }
  return path;
}

export function assertAllowedExternalUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
    throw new Error('Only https and mailto URLs are allowed.');
  }
  return parsed;
}

export function assertDesktopRuntimeConfig(config: DesktopRuntimeConfig): DesktopRuntimeConfig {
  if (config.mode !== 'desktop-primary') {
    throw new Error('Desktop runtime must use desktop-primary mode.');
  }

  const httpUrl = new URL(config.httpBaseUrl);
  const wsUrl = new URL(config.wsUrl);
  if (httpUrl.protocol !== 'http:' && httpUrl.protocol !== 'https:') {
    throw new Error('Desktop runtime httpBaseUrl must use http or https.');
  }
  if (wsUrl.protocol !== 'ws:' && wsUrl.protocol !== 'wss:') {
    throw new Error('Desktop runtime wsUrl must use ws or wss.');
  }

  if (config.workspacePath) {
    assertAbsolutePath(config.workspacePath, 'workspacePath');
  }
  if (config.appStateDbPath) {
    assertAbsolutePath(config.appStateDbPath, 'appStateDbPath');
  }

  return config;
}

export function assertHostCapabilitySurface(surface: HostCapabilitySurface): HostCapabilitySurface {
  if (!surface || typeof surface !== 'object') {
    throw new Error('Host capability surface must be an object.');
  }

  assertFunction(surface.workspace?.selectWorkspace, 'workspace.selectWorkspace');
  assertFunction(surface.workspace?.revealInOs, 'workspace.revealInOs');
  assertFunction(surface.shell?.openExternal, 'shell.openExternal');
  assertFunction(surface.lifecycle?.onAppEvent, 'lifecycle.onAppEvent');
  return surface;
}
