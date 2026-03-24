#!/usr/bin/env bun

import { spawn, type Subprocess } from 'bun';
import chokidar from 'chokidar';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import {
  buildDesktopHost,
  collectDesktopWatchTargets,
  resolveDesktopOutDir,
  resolveRepoRoot,
  type DesktopBuildResult,
  type DesktopRuntimePorts,
} from './build';
import { resolveDevTargetDir } from '../dev/app-dev';

export interface DesktopDevFlags {
  devtools: boolean;
  headless: boolean;
  targetDir?: string;
}

export function parseDesktopDevFlags(args: string[]): DesktopDevFlags {
  const flags: DesktopDevFlags = {
    devtools: false,
    headless: false,
  };

  for (const arg of args) {
    if (arg === '--headless') {
      flags.headless = true;
      continue;
    }
    if (arg === '--devtools') {
      flags.devtools = true;
      continue;
    }
    if (!arg.startsWith('-') && !flags.targetDir) {
      flags.targetDir = arg;
    }
  }

  return flags;
}

function resolveElectronBinary(repoRoot: string): string {
  const binaryName = process.platform === 'win32' ? 'electron.cmd' : 'electron';
  const candidate = path.join(repoRoot, 'node_modules', '.bin', binaryName);
  if (!existsSync(candidate)) {
    throw new Error('Electron dependency is missing. Run `bun install` first.');
  }
  return candidate;
}

async function getAvailablePort(startPort: number): Promise<number> {
  const isAvailable = (port: number): Promise<boolean> =>
    new Promise((resolve) => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
    });

  let currentPort = startPort;
  while (!(await isAvailable(currentPort))) {
    currentPort += 1;
  }

  return currentPort;
}

async function resolveDesktopPorts(): Promise<DesktopRuntimePorts> {
  const httpPort = await getAvailablePort(3002);
  let wsPort = await getAvailablePort(3001);
  while (wsPort === httpPort) {
    wsPort = await getAvailablePort(wsPort + 1);
  }

  return { httpPort, wsPort };
}

function hashFile(filePath: string): string {
  if (!existsSync(filePath)) {
    return '';
  }

  return createHash('sha1').update(readFileSync(filePath)).digest('hex');
}

type OutputHashes = {
  html: string;
  main: string;
  preload: string;
  renderer: string;
  tailwind: string;
};

function captureOutputHashes(buildResult: DesktopBuildResult): OutputHashes {
  return {
    html: hashFile(buildResult.htmlPath),
    main: hashFile(buildResult.mainPath),
    preload: hashFile(buildResult.preloadPath),
    renderer: hashFile(buildResult.rendererPath),
    tailwind: hashFile(buildResult.tailwindPath),
  };
}

function touchReloadToken(reloadTokenPath: string): void {
  writeFileSync(reloadTokenPath, JSON.stringify({ reloadedAt: Date.now() }), 'utf8');
}

async function run(): Promise<void> {
  const repoRoot = resolveRepoRoot();
  const flags = parseDesktopDevFlags(process.argv.slice(2));
  const targetDir = resolveDevTargetDir(repoRoot, flags.targetDir ?? process.env.MAGAM_TARGET_DIR);
  const ports = await resolveDesktopPorts();
  const outDir = resolveDesktopOutDir(repoRoot);
  const reloadTokenPath = path.join(outDir, 'renderer.reload');
  const electronBinary = resolveElectronBinary(repoRoot);

  let shuttingDown = false;
  let rebuildTimer: Timer | null = null;
  let rebuildQueued = false;
  let electronProcess: Subprocess<'ignore', 'inherit', 'inherit'> | null = null;

  const buildResult = await buildDesktopHost({
    clean: true,
    ports,
    repoRoot,
    sourcemap: true,
  });
  let outputHashes = captureOutputHashes(buildResult);
  touchReloadToken(reloadTokenPath);

  const spawnElectron = () => {
    electronProcess = spawn({
      cmd: [electronBinary, buildResult.mainPath],
      cwd: repoRoot,
      env: {
        ...process.env,
        MAGAM_BUN_BIN: 'bun',
        MAGAM_DESKTOP_DEVTOOLS: flags.devtools ? '1' : '0',
        MAGAM_DESKTOP_HEADLESS: flags.headless ? '1' : '0',
        MAGAM_DESKTOP_HTML_PATH: buildResult.htmlPath,
        MAGAM_DESKTOP_PRELOAD_PATH: buildResult.preloadPath,
        MAGAM_DESKTOP_RELOAD_TOKEN_PATH: reloadTokenPath,
        MAGAM_HTTP_PORT: String(ports.httpPort),
        MAGAM_REPO_ROOT: repoRoot,
        MAGAM_TARGET_DIR: targetDir,
        MAGAM_WS_PORT: String(ports.wsPort),
      },
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
    });

    void electronProcess.exited.then((exitCode) => {
      if (!shuttingDown && exitCode !== 0) {
        console.warn(`[DesktopDev] Electron exited with code ${exitCode}.`);
      }
    });
  };

  const stopElectron = async () => {
    if (!electronProcess) {
      return;
    }

    const activeProcess = electronProcess;
    electronProcess = null;
    activeProcess.kill();
    await activeProcess.exited;
  };

  const restartElectron = async () => {
    await stopElectron();
    if (!shuttingDown) {
      spawnElectron();
    }
  };

  const rebuild = async () => {
    if (rebuildQueued) {
      return;
    }

    rebuildQueued = true;
    try {
      const nextBuildResult = await buildDesktopHost({
        clean: false,
        ports,
        repoRoot,
        sourcemap: true,
      });
      const nextHashes = captureOutputHashes(nextBuildResult);
      const shouldRestartElectron = (
        nextHashes.main !== outputHashes.main
        || nextHashes.preload !== outputHashes.preload
      );
      const shouldReloadRenderer = (
        nextHashes.html !== outputHashes.html
        || nextHashes.renderer !== outputHashes.renderer
        || nextHashes.tailwind !== outputHashes.tailwind
      );

      outputHashes = nextHashes;

      if (shouldRestartElectron) {
        console.log('[DesktopDev] Restarting Electron after main/preload rebuild.');
        await restartElectron();
        return;
      }

      if (shouldReloadRenderer) {
        console.log('[DesktopDev] Reloading renderer after asset rebuild.');
        touchReloadToken(reloadTokenPath);
      }
    } catch (error) {
      console.error('[DesktopDev] Rebuild failed', error);
    } finally {
      rebuildQueued = false;
    }
  };

  const scheduleRebuild = () => {
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
    }

    rebuildTimer = setTimeout(() => {
      rebuildTimer = null;
      void rebuild();
    }, 120);
  };

  const watcher = chokidar.watch(collectDesktopWatchTargets(repoRoot), {
    awaitWriteFinish: {
      pollInterval: 50,
      stabilityThreshold: 120,
    },
    ignored: [
      /(^|[/\\])\../,
      /node_modules/,
      new RegExp(path.join(repoRoot, '.magam').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    ],
    ignoreInitial: true,
  });

  watcher.on('add', scheduleRebuild);
  watcher.on('change', scheduleRebuild);
  watcher.on('unlink', scheduleRebuild);

  spawnElectron();

  const shutdown = async (exitCode: number) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
      rebuildTimer = null;
    }
    await watcher.close();
    await stopElectron();
    rmSync(reloadTokenPath, { force: true });
    process.exit(exitCode);
  };

  process.on('SIGINT', () => {
    void shutdown(0);
  });
  process.on('SIGTERM', () => {
    void shutdown(0);
  });
}

if (import.meta.main) {
  await run();
}
