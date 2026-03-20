export interface MagamDesktopDirectorySelection {
  path: string;
}

export interface MagamDesktopBridge {
  pickDirectory?: (input?: { title?: string; defaultPath?: string }) => Promise<MagamDesktopDirectorySelection | null>;
  revealPath?: (input: { path: string }) => Promise<void>;
  openPath?: (input: { path: string }) => Promise<void>;
  copyText?: (input: { text: string }) => Promise<void>;
}

export const MAGAM_DESKTOP_BRIDGE_KEY = 'magamDesktop' as const;

export const MAGAM_DESKTOP_IPC_CHANNELS = {
  pickDirectory: 'magam-desktop:pick-directory',
  revealPath: 'magam-desktop:reveal-path',
  openPath: 'magam-desktop:open-path',
  copyText: 'magam-desktop:copy-text',
} as const;
