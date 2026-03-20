import type { DesktopHostBridge, DesktopRuntimeConfig } from '@/features/host/contracts';
import { ipcRenderer } from 'electron';
import { DESKTOP_HOST_CHANNELS, type RendererReadyPayload } from './rendererBootstrap';

export function createPreloadCapabilities(
  runtime: DesktopRuntimeConfig,
): DesktopHostBridge {
  return {
    runtime,
    capabilities: {
      workspace: {
        selectWorkspace: () => ipcRenderer.invoke(DESKTOP_HOST_CHANNELS.selectWorkspace),
        revealInOs: (path: string) => ipcRenderer.invoke(DESKTOP_HOST_CHANNELS.revealInOs, path),
      },
      shell: {
        openExternal: (url: string) => ipcRenderer.invoke(DESKTOP_HOST_CHANNELS.openExternal, url),
      },
      lifecycle: {
        onAppEvent(listener) {
          const wrapped = (_event: unknown, payload: unknown) => {
            listener(payload as Parameters<typeof listener>[0]);
          };
          ipcRenderer.on(DESKTOP_HOST_CHANNELS.appEvent, wrapped);
          return () => {
            ipcRenderer.off(DESKTOP_HOST_CHANNELS.appEvent, wrapped);
          };
        },
      },
    },
    bootstrap: {
      getSession: () => ipcRenderer.invoke(DESKTOP_HOST_CHANNELS.getSession),
      markRendererLoading: () => ipcRenderer.invoke(DESKTOP_HOST_CHANNELS.markRendererLoading),
      markRendererReady: (payload?: RendererReadyPayload) =>
        ipcRenderer.invoke(DESKTOP_HOST_CHANNELS.markRendererReady, payload),
      markRendererFailed: (payload) =>
        ipcRenderer.invoke(DESKTOP_HOST_CHANNELS.markRendererFailed, payload),
    },
  };
}
