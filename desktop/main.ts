import path from 'node:path';
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
} from 'electron';
import { MAGAM_DESKTOP_IPC_CHANNELS } from '../app/lib/desktop/bridge-contract';

type DirectoryDialogInput = {
  title?: unknown;
  defaultPath?: unknown;
};

type PathInput = {
  path?: unknown;
};

type CopyTextInput = {
  text?: unknown;
};

function ensureRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function ensureOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function ensureRequiredString(value: unknown, fieldName: string): string {
  const resolved = ensureOptionalString(value, fieldName);
  if (!resolved) {
    throw new Error(`${fieldName} is required`);
  }
  return resolved;
}

function resolveDesktopStartUrl(): string {
  const explicit = ensureOptionalString(process.env.MAGAM_DESKTOP_START_URL, 'MAGAM_DESKTOP_START_URL');
  if (explicit) {
    return explicit;
  }

  const port = ensureOptionalString(process.env.MAGAM_DESKTOP_APP_PORT, 'MAGAM_DESKTOP_APP_PORT') ?? '3000';
  return `http://localhost:${port}`;
}

function resolvePreloadPath(): string {
  const explicit = ensureOptionalString(process.env.MAGAM_DESKTOP_PRELOAD_PATH, 'MAGAM_DESKTOP_PRELOAD_PATH');
  if (explicit) {
    return explicit;
  }

  // Default to a compiled preload output; dev tooling can override via MAGAM_DESKTOP_PRELOAD_PATH.
  return path.join(process.cwd(), 'desktop', 'preload.js');
}

function registerDesktopBridgeHandlers(): void {
  ipcMain.handle(MAGAM_DESKTOP_IPC_CHANNELS.pickDirectory, async (_event, rawInput?: DirectoryDialogInput) => {
    const input = ensureRecord(rawInput);
    const result = await dialog.showOpenDialog({
      title: ensureOptionalString(input.title, 'title'),
      defaultPath: ensureOptionalString(input.defaultPath, 'defaultPath'),
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return { path: result.filePaths[0] };
  });

  ipcMain.handle(MAGAM_DESKTOP_IPC_CHANNELS.revealPath, async (_event, rawInput?: PathInput) => {
    const input = ensureRecord(rawInput);
    const targetPath = ensureRequiredString(input.path, 'path');
    shell.showItemInFolder(targetPath);
  });

  ipcMain.handle(MAGAM_DESKTOP_IPC_CHANNELS.openPath, async (_event, rawInput?: PathInput) => {
    const input = ensureRecord(rawInput);
    const targetPath = ensureRequiredString(input.path, 'path');
    const errorMessage = await shell.openPath(targetPath);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
  });

  ipcMain.handle(MAGAM_DESKTOP_IPC_CHANNELS.copyText, async (_event, rawInput?: CopyTextInput) => {
    const input = ensureRecord(rawInput);
    clipboard.writeText(ensureRequiredString(input.text, 'text'));
  });
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void window.loadURL(resolveDesktopStartUrl());

  if (process.env.NODE_ENV !== 'production') {
    window.webContents.openDevTools({ mode: 'detach' });
  }

  return window;
}

app.whenReady().then(() => {
  registerDesktopBridgeHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
