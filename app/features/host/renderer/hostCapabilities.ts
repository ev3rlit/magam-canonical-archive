import type {
  DesktopHostBridge,
  DesktopRuntimeConfig,
  HostCapabilitySurface,
} from '@/features/host/contracts';

declare global {
  interface Window {
    __MAGAM_DESKTOP_HOST__?: DesktopHostBridge;
  }
}

export function getDesktopHostBridge(): DesktopHostBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.__MAGAM_DESKTOP_HOST__ ?? null;
}

export function getDesktopRuntimeConfig(): DesktopRuntimeConfig | null {
  return getDesktopHostBridge()?.runtime ?? null;
}

export function createWebHostCapabilities(): HostCapabilitySurface {
  return {
    workspace: {
      async selectWorkspace() {
        return null;
      },
      async revealInOs() {
        return;
      },
    },
    shell: {
      async openExternal(url: string) {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      },
    },
    lifecycle: {
      onAppEvent() {
        return () => undefined;
      },
    },
  };
}
