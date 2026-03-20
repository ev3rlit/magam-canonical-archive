import { contextBridge } from 'electron';
import {
  assertDesktopRuntimeConfig,
  assertHostCapabilitySurface,
} from '@/features/host/contracts';
import { createPreloadCapabilities } from './preloadCapabilities';

function resolveRuntimeConfig() {
  return assertDesktopRuntimeConfig({
    mode: 'desktop-primary',
    httpBaseUrl:
      process.env.MAGAM_DESKTOP_HTTP_BASE_URL
      || `http://127.0.0.1:${process.env.MAGAM_HTTP_PORT || '3002'}`,
    wsUrl:
      process.env.MAGAM_DESKTOP_WS_URL
      || `ws://127.0.0.1:${process.env.MAGAM_WS_PORT || '3001'}`,
    workspacePath: process.env.MAGAM_TARGET_DIR || null,
  });
}

const bridge = createPreloadCapabilities(resolveRuntimeConfig());
assertHostCapabilitySurface(bridge.capabilities);

contextBridge.exposeInMainWorld('__MAGAM_DESKTOP_HOST__', bridge);
