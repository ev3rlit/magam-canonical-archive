import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { watch } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  assertAbsolutePath,
  assertAllowedExternalUrl,
} from '@/features/host/contracts';
import { createDesktopHostLogger } from './diagnostics';
import { createDesktopHostOrchestrator } from './orchestrator';
import { DESKTOP_HOST_CHANNELS } from './rendererBootstrap';

const logger = createDesktopHostLogger('DesktopHost');

function resolveRepoRoot(): string {
  return process.env.MAGAM_REPO_ROOT || resolve(__dirname, '../../..');
}

function resolveWorkspacePath(repoRoot: string): string {
  return process.env.MAGAM_TARGET_DIR || resolve(repoRoot, 'examples');
}

function resolveHtmlPath(): string {
  const htmlPath = process.env.MAGAM_DESKTOP_HTML_PATH;
  if (!htmlPath) {
    throw new Error('MAGAM_DESKTOP_HTML_PATH is required.');
  }
  return htmlPath;
}

function resolvePreloadPath(): string {
  return process.env.MAGAM_DESKTOP_PRELOAD_PATH || resolve(__dirname, 'preload.js');
}

function resolveReloadTokenPath(): string | null {
  const tokenPath = process.env.MAGAM_DESKTOP_RELOAD_TOKEN_PATH;
  return tokenPath && tokenPath.trim().length > 0 ? tokenPath : null;
}

function shouldEnableDevTools(): boolean {
  return process.env.MAGAM_DESKTOP_DEVTOOLS === '1';
}

function resolveAppStateDbPath(): string {
  const explicit = process.env.MAGAM_APP_STATE_DB_PATH?.trim();
  if (explicit) {
    return explicit;
  }

  return join(app.getPath('userData'), 'app-state-pgdata');
}

async function main(): Promise<void> {
  await app.whenReady();

  const repoRoot = resolveRepoRoot();
  const headless = process.env.MAGAM_DESKTOP_HEADLESS === '1';
  const appStateDbPath = resolveAppStateDbPath();
  process.env.MAGAM_APP_STATE_DB_PATH = appStateDbPath;
  const orchestrator = createDesktopHostOrchestrator({
    appStateDbPath,
    bunBin: process.env.MAGAM_BUN_BIN || 'bun',
    httpPort: parseInt(process.env.MAGAM_HTTP_PORT || '3002', 10),
    repoRoot,
    workspacePath: resolveWorkspacePath(repoRoot),
    wsPort: parseInt(process.env.MAGAM_WS_PORT || '3001', 10),
  });

  let mainWindow: BrowserWindow | null = null;
  let isQuitting = false;
  let headlessTimeout: ReturnType<typeof setTimeout> | null = null;
  let reloadWatcher: ReturnType<typeof watch> | null = null;

  const pushCurrentSessionEvents = () => {
    const session = orchestrator.getSession();
    if (!mainWindow) {
      return;
    }
    if (session.workspacePath) {
      mainWindow.webContents.send(DESKTOP_HOST_CHANNELS.appEvent, {
        type: 'workspace-selected',
        path: session.workspacePath,
      });
    }
    if (session.backendState === 'ready') {
      mainWindow.webContents.send(DESKTOP_HOST_CHANNELS.appEvent, {
        type: 'backend-ready',
      });
    }
    if (session.backendState === 'failed' && session.lastError) {
      mainWindow.webContents.send(DESKTOP_HOST_CHANNELS.appEvent, {
        type: 'backend-failed',
        code: session.lastError.code,
        message: session.lastError.message,
      });
    }
  };

  const createWindow = async () => {
    mainWindow = new BrowserWindow({
      height: 960,
      show: false,
      width: 1440,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: resolvePreloadPath(),
        sandbox: false,
      },
    });

    const unsubscribe = orchestrator.subscribe((event) => {
      mainWindow?.webContents.send(DESKTOP_HOST_CHANNELS.appEvent, event);
    });

    mainWindow.on('closed', () => {
      unsubscribe();
      mainWindow = null;
    });

    mainWindow.once('ready-to-show', () => {
      if (!headless) {
        mainWindow?.show();
      }
      if (shouldEnableDevTools()) {
        mainWindow?.webContents.openDevTools({ mode: 'detach' });
      }
    });
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const isDevToolsShortcut = (
        input.type === 'keyDown'
        && (
          input.key === 'F12'
          || (
            input.key.toLowerCase() === 'i'
            && ((input.control && input.shift) || (input.meta && input.alt))
          )
        )
      );
      const isReloadShortcut = (
        input.type === 'keyDown'
        && (
          input.key === 'F5'
          || (
            input.key.toLowerCase() === 'r'
            && ((input.control && input.shift) || (input.meta && input.shift))
          )
        )
      );

      if (isDevToolsShortcut) {
        event.preventDefault();
        if (mainWindow?.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow?.webContents.openDevTools({ mode: 'detach' });
        }
      }

      if (isReloadShortcut) {
        event.preventDefault();
        mainWindow?.webContents.reloadIgnoringCache();
      }
    });
    mainWindow.webContents.on('console-message', (event) => {
      logger.info('Renderer console', {
        level: event.level,
        line: event.lineNumber,
        message: event.message,
        sourceId: event.sourceId,
      });
    });
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      logger.error('Renderer failed to load', {
        errorCode,
        errorDescription,
        validatedURL,
      });
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      logger.error('Renderer process exited unexpectedly', details);
    });
    mainWindow.webContents.on('did-finish-load', () => {
      logger.info('Renderer window finished loading');
    });

    await mainWindow.loadFile(resolveHtmlPath());
    pushCurrentSessionEvents();

    const reloadTokenPath = resolveReloadTokenPath();
    if (reloadTokenPath) {
      reloadWatcher = watch(reloadTokenPath, { persistent: false }, () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          return;
        }
        logger.info('Reloading renderer after desktop asset rebuild');
        mainWindow.webContents.reloadIgnoringCache();
      });
    }
  };

  const shutdown = async (exitCode = 0) => {
    if (isQuitting) {
      return;
    }

    isQuitting = true;
    logger.info('Shutting down desktop host');
    if (headlessTimeout) {
      clearTimeout(headlessTimeout);
      headlessTimeout = null;
    }
    if (reloadWatcher) {
      reloadWatcher.close();
      reloadWatcher = null;
    }
    await orchestrator.stop();
    app.exit(exitCode);
  };

  ipcMain.handle(DESKTOP_HOST_CHANNELS.selectWorkspace, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = assertAbsolutePath(result.filePaths[0]);
    await orchestrator.selectWorkspace(selectedPath);
    return { path: selectedPath };
  });
  ipcMain.handle(DESKTOP_HOST_CHANNELS.revealInOs, async (_event, rawPath: string) => {
    shell.showItemInFolder(assertAbsolutePath(rawPath));
  });
  ipcMain.handle(DESKTOP_HOST_CHANNELS.openExternal, async (_event, rawUrl: string) => {
    const url = assertAllowedExternalUrl(rawUrl);
    await shell.openExternal(url.toString());
  });
  ipcMain.handle(DESKTOP_HOST_CHANNELS.getSession, async () => orchestrator.getSession());
  ipcMain.handle(DESKTOP_HOST_CHANNELS.markRendererLoading, async () => orchestrator.markRendererLoading());
  ipcMain.handle(DESKTOP_HOST_CHANNELS.markRendererReady, async () => {
    const session = orchestrator.markRendererReady();
    if (headless) {
      if (headlessTimeout) {
        clearTimeout(headlessTimeout);
        headlessTimeout = null;
      }
      logger.info('Renderer reported ready in headless mode');
      setTimeout(() => {
        void shutdown(0);
      }, 200);
    }
    return session;
  });
  ipcMain.handle(DESKTOP_HOST_CHANNELS.markRendererFailed, async (_event, payload) => {
    const session = orchestrator.markRendererFailed(payload);
    logger.error('Renderer bootstrap failed', payload);
    if (headless) {
      if (headlessTimeout) {
        clearTimeout(headlessTimeout);
        headlessTimeout = null;
      }
      setTimeout(() => {
        void shutdown(1);
      }, 200);
    }
    return session;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      void shutdown(0);
    }
  });
  app.on('before-quit', (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    void shutdown(0);
  });

  await orchestrator.start();
  await createWindow();
  if (headless) {
    headlessTimeout = setTimeout(() => {
      logger.error('Renderer readiness timed out in headless mode');
      void shutdown(1);
    }, 15_000);
  }
}

void main().catch((error) => {
  logger.error('Desktop host failed to start', error);
  app.exit(1);
});
