export const DESKTOP_HOST_CHANNELS = {
  appEvent: 'magam:desktop-host/app-event',
  getSession: 'magam:desktop-host/get-session',
  markRendererFailed: 'magam:desktop-host/renderer-failed',
  markRendererLoading: 'magam:desktop-host/renderer-loading',
  markRendererReady: 'magam:desktop-host/renderer-ready',
  openExternal: 'magam:desktop-host/open-external',
  revealInOs: 'magam:desktop-host/reveal-in-os',
  selectWorkspace: 'magam:desktop-host/select-workspace',
} as const;

export interface RendererReadyPayload {
  currentFile?: string | null;
}
