import {
  assertDesktopRuntimeConfig,
  assertHostCapabilitySurface,
  type DesktopRuntimeConfig,
  type HostCapabilitySurface,
  type HostMode,
  type DesktopBootstrapFailure,
  type DesktopBootstrapSession,
} from '@/features/host/contracts';
import { createDesktopRpcAdapter } from '@/features/host/rpc/desktopAdapter';
import { validateAdapterParity } from '@/features/host/rpc/validateParity';
import { createWebRpcAdapter } from '@/features/host/rpc/webAdapter';
import type { RendererRpcClient } from './rpcClient';
import {
  createWebHostCapabilities,
  getDesktopHostBridge,
  getDesktopRuntimeConfig,
} from './hostCapabilities';

export interface RendererBootstrapController {
  getSession: () => Promise<DesktopBootstrapSession | null>;
  markLoading: () => Promise<DesktopBootstrapSession | null>;
  markReady: () => Promise<DesktopBootstrapSession | null>;
  markFailed: (payload: DesktopBootstrapFailure) => Promise<DesktopBootstrapSession | null>;
}

export interface RendererHostRuntime {
  bootstrap: RendererBootstrapController;
  capabilities: HostCapabilitySurface;
  mode: HostMode;
  rpc: RendererRpcClient;
  runtimeConfig: DesktopRuntimeConfig | null;
}

let cachedRuntime: RendererHostRuntime | null = null;

function createNoopBootstrap(): RendererBootstrapController {
  return {
    async getSession() {
      return null;
    },
    async markLoading() {
      return null;
    },
    async markReady() {
      return null;
    },
    async markFailed() {
      return null;
    },
  };
}

function createDesktopBootstrap(): RendererBootstrapController {
  const bridge = getDesktopHostBridge();
  if (!bridge) {
    return createNoopBootstrap();
  }

  return {
    getSession: bridge.bootstrap.getSession,
    markLoading: bridge.bootstrap.markRendererLoading,
    markReady: bridge.bootstrap.markRendererReady,
    markFailed: bridge.bootstrap.markRendererFailed,
  };
}

function resolveRuntimeMode(): HostMode {
  return getDesktopHostBridge() ? 'desktop-primary' : 'web-secondary';
}

function buildRuntime(): RendererHostRuntime {
  const mode = resolveRuntimeMode();
  const runtimeConfig = getDesktopRuntimeConfig();
  const webRpc = createWebRpcAdapter();

  if (mode === 'desktop-primary') {
    if (!runtimeConfig) {
      throw new Error('Desktop runtime config is missing.');
    }

    const bridge = getDesktopHostBridge();
    if (!bridge) {
      throw new Error('Desktop host bridge is missing.');
    }

    assertDesktopRuntimeConfig(runtimeConfig);
    const capabilities = assertHostCapabilitySurface(bridge.capabilities);
    const desktopRpc = createDesktopRpcAdapter({ bridge });
    validateAdapterParity({
      desktop: desktopRpc.descriptor,
      web: webRpc.descriptor,
    });
    return {
      bootstrap: createDesktopBootstrap(),
      capabilities,
      mode,
      rpc: desktopRpc,
      runtimeConfig,
    };
  }

  const capabilities = assertHostCapabilitySurface(createWebHostCapabilities());
  return {
    bootstrap: createNoopBootstrap(),
    capabilities,
    mode,
    rpc: webRpc,
    runtimeConfig: null,
  };
}

export function getHostRuntime(): RendererHostRuntime {
  if (!cachedRuntime) {
    cachedRuntime = buildRuntime();
  }
  return cachedRuntime;
}

export function resetHostRuntimeForTests(): void {
  cachedRuntime = null;
}
