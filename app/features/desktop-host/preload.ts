import { contextBridge } from 'electron';
import {
  assertDesktopRuntimeConfig,
  assertHostCapabilitySurface,
} from '@/features/host/contracts';
import { createPreloadCapabilities } from './preloadCapabilities';

function resolveRuntimeConfig() {
  return assertDesktopRuntimeConfig({
    mode: 'desktop-primary',
    appStateDbPath: process.env.MAGAM_APP_STATE_DB_PATH || null,
    workspacePath: process.env.MAGAM_TARGET_DIR || null,
    workspaceMode: process.env.MAGAM_TARGET_DIR ? 'persisted' : 'transient',
    storageBackend: process.env.MAGAM_TARGET_DIR ? 'file' : 'memory',
    transientCanvasId: process.env.MAGAM_TARGET_DIR ? null : 'transient-canvas',
  });
}

const bridge = createPreloadCapabilities(resolveRuntimeConfig());
assertHostCapabilitySurface(bridge.capabilities);

contextBridge.exposeInMainWorld('__MAGAM_DESKTOP_HOST__', bridge);
