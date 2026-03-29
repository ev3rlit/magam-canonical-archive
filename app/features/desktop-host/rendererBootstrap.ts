export const DESKTOP_HOST_CHANNELS = {
  appEvent: 'magam:desktop-host/app-event',
  chooseSaveLocation: 'magam:desktop-host/choose-save-location',
  getSession: 'magam:desktop-host/get-session',
  healthCheck: 'magam:desktop-host/health-check',
  invokeRpc: 'magam:desktop-host/invoke-rpc',
  markRendererFailed: 'magam:desktop-host/renderer-failed',
  markRendererLoading: 'magam:desktop-host/renderer-loading',
  markRendererReady: 'magam:desktop-host/renderer-ready',
  openExternal: 'magam:desktop-host/open-external',
  revealInOs: 'magam:desktop-host/reveal-in-os',
  selectWorkspace: 'magam:desktop-host/select-workspace',
} as const;

export interface RendererReadyPayload {}
