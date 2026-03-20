#!/usr/bin/env bun

import { spawn } from 'bun';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { buildDesktopHost, resolveRepoRoot } from './build';

function resolveElectronBinary(repoRoot: string): string {
  const binaryName = process.platform === 'win32' ? 'electron.cmd' : 'electron';
  return path.join(repoRoot, 'node_modules', '.bin', binaryName);
}

function resolvePort(value: string | undefined, fallback: number, fieldName: string): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return parsed;
}

async function getAvailablePort(startPort: number): Promise<number> {
  const isAvailable = (port: number): Promise<boolean> => new Promise((resolve) => {
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

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while ((Date.now() - startedAt) < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await Bun.sleep(1000);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${url}`);
}

async function run(): Promise<void> {
  const repoRoot = resolveRepoRoot();
  const targetDir = process.env.MAGAM_TARGET_DIR?.trim() || './examples';
  const timeoutMs = Number(process.env.MAGAM_DESKTOP_WAIT_TIMEOUT_MS || '120000');
  const preferredDesktopPort = resolvePort(
    process.env.MAGAM_DESKTOP_APP_PORT,
    4173,
    'MAGAM_DESKTOP_APP_PORT',
  );
  const desktopPort = await getAvailablePort(preferredDesktopPort);
  const desktopUrl = `http://127.0.0.1:${desktopPort}`;

  if (desktopPort !== preferredDesktopPort) {
    console.warn(`[DesktopDev] Port ${preferredDesktopPort} is in use. Using ${desktopPort} instead.`);
  }

  const { mainPath, preloadPath } = await buildDesktopHost({
    repoRoot,
    sourcemap: true,
  });

  const electronBinary = resolveElectronBinary(repoRoot);
  if (!existsSync(electronBinary)) {
    throw new Error('Electron binary not found. Run `bun add -d electron` first.');
  }

  const devServer = spawn({
    cmd: ['bun', 'run', 'dev', targetDir, '--port', desktopPort.toString()],
    cwd: repoRoot,
    env: process.env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  try {
    await waitForUrl(desktopUrl, timeoutMs);
  } catch (error) {
    devServer.kill();
    throw error;
  }

  const electron = spawn({
    cmd: [electronBinary, mainPath],
    cwd: repoRoot,
    env: {
      ...process.env,
      MAGAM_DESKTOP_START_URL: desktopUrl,
      MAGAM_DESKTOP_APP_PORT: desktopPort.toString(),
      MAGAM_DESKTOP_PRELOAD_PATH: preloadPath,
    },
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  let shuttingDown = false;
  const shutdown = (exitCode: number) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    electron.kill();
    devServer.kill();
    process.exit(exitCode);
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  const result = await Promise.race([
    devServer.exited.then((exitCode) => ({ source: 'dev' as const, exitCode })),
    electron.exited.then((exitCode) => ({ source: 'electron' as const, exitCode })),
  ]);

  shutdown(result.exitCode);
}

if (import.meta.main) {
  await run();
}
