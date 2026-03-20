#!/usr/bin/env bun

import { spawn } from 'bun';
import { build } from 'esbuild';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { resolveDevTargetDir, shouldBuildCore } from './app-dev';

export interface DesktopDevFlags {
  headless: boolean;
  targetDir?: string;
}

export function parseDesktopDevFlags(args: string[]): DesktopDevFlags {
  const flags: DesktopDevFlags = {
    headless: false,
  };

  for (const arg of args) {
    if (arg === '--headless') {
      flags.headless = true;
      continue;
    }
    if (!arg.startsWith('-') && !flags.targetDir) {
      flags.targetDir = arg;
    }
  }

  return flags;
}

export function resolveDesktopOutDir(repoRoot: string): string {
  return resolve(repoRoot, '.magam/desktop-host');
}

function resolveRepoRoot(): string {
  return resolve(fileURLToPath(new URL('../..', import.meta.url)));
}

async function runBuildCore(repoRoot: string): Promise<void> {
  if (!shouldBuildCore(repoRoot)) {
    return;
  }

  const buildCore = spawn({
    cmd: ['bun', 'run', 'build:core'],
    cwd: repoRoot,
    env: process.env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  const exitCode = await buildCore.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

async function runTailwindBuild(repoRoot: string, outDir: string): Promise<void> {
  const outputCss = resolve(outDir, 'tailwind.css');
  const inputCssPath = resolve(repoRoot, 'app/app/globals.css');
  const source = readFileSync(inputCssPath, 'utf8');
  const result = await postcss([
    tailwindcss({
      config: resolve(repoRoot, 'app/tailwind.config.js'),
    }),
    autoprefixer,
  ]).process(source, {
    from: inputCssPath,
    to: outputCss,
  });
  writeFileSync(outputCss, result.css, 'utf8');
}

async function getAvailablePort(startPort: number): Promise<number> {
  const canListen = (port: number): Promise<boolean> =>
    new Promise((resolvePort) => {
      const server = createServer();
      server.listen(port, () => {
        server.close(() => resolvePort(true));
      });
      server.on('error', () => resolvePort(false));
    });

  let candidate = startPort;
  while (!(await canListen(candidate))) {
    candidate += 1;
  }
  return candidate;
}

async function resolveDesktopPorts(): Promise<{ httpPort: number; wsPort: number }> {
  const httpPort = await getAvailablePort(3002);
  let wsPort = await getAvailablePort(3001);
  while (wsPort === httpPort) {
    wsPort = await getAvailablePort(wsPort + 1);
  }
  return { httpPort, wsPort };
}

async function runEsbuild(
  repoRoot: string,
  outDir: string,
  ports: { httpPort: number; wsPort: number },
): Promise<void> {
  const tsconfig = resolve(repoRoot, 'app/tsconfig.json');
  const define = {
    'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL || ''),
    'process.env.NEXT_PUBLIC_LOG_LEVEL': JSON.stringify(process.env.NEXT_PUBLIC_LOG_LEVEL || ''),
    'process.env.NEXT_PUBLIC_MAGAM_HTTP_PORT': JSON.stringify(String(ports.httpPort)),
    'process.env.NEXT_PUBLIC_MAGAM_WS_PORT': JSON.stringify(String(ports.wsPort)),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  };

  await Promise.all([
    build({
      bundle: true,
      define,
      entryPoints: [resolve(repoRoot, 'app/features/host/renderer/desktopRendererEntry.tsx')],
      format: 'esm',
      jsx: 'automatic',
      outfile: resolve(outDir, 'renderer.js'),
      platform: 'browser',
      sourcemap: 'inline',
      tsconfig,
    }),
    build({
      bundle: true,
      define,
      entryPoints: [resolve(repoRoot, 'app/features/desktop-host/main.ts')],
      external: ['electron'],
      format: 'cjs',
      outfile: resolve(outDir, 'main.js'),
      platform: 'node',
      sourcemap: 'inline',
      tsconfig,
    }),
    build({
      bundle: true,
      define,
      entryPoints: [resolve(repoRoot, 'app/features/desktop-host/preload.ts')],
      external: ['electron'],
      format: 'cjs',
      outfile: resolve(outDir, 'preload.js'),
      platform: 'node',
      sourcemap: 'inline',
      tsconfig,
    }),
  ]);
}

function writeDesktopHtml(
  outDir: string,
  ports: { httpPort: number; wsPort: number },
): string {
  const htmlPath = resolve(outDir, 'index.html');
  writeFileSync(
    htmlPath,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' http://127.0.0.1:${ports.httpPort} ws://127.0.0.1:${ports.wsPort}; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;" />
    <title>Magam Desktop</title>
    <link rel="stylesheet" href="./tailwind.css" />
    <link rel="stylesheet" href="./renderer.css" />
    <style>
      html, body, #root {
        height: 100%;
        margin: 0;
        width: 100%;
      }
    </style>
    <script>
      globalThis.process = {
        env: {
          LOG_LEVEL: "",
          NEXT_PUBLIC_LOG_LEVEL: "",
          NEXT_PUBLIC_MAGAM_HTTP_PORT: "${ports.httpPort}",
          NEXT_PUBLIC_MAGAM_WS_PORT: "${ports.wsPort}",
          NODE_ENV: "development"
        }
      };
    </script>
  </head>
  <body class="h-screen overflow-hidden bg-slate-100">
    <div id="root" class="h-full"></div>
    <script type="module" src="./renderer.js"></script>
  </body>
</html>`,
    'utf8',
  );
  return htmlPath;
}

function resolveElectronBinary(repoRoot: string): string {
  const candidate = resolve(repoRoot, 'node_modules/.bin/electron');
  if (!existsSync(candidate)) {
    throw new Error('Electron dependency is missing. Run `bun install` first.');
  }
  return candidate;
}

async function run(): Promise<void> {
  const repoRoot = resolveRepoRoot();
  const flags = parseDesktopDevFlags(process.argv.slice(2));
  const targetDir = resolveDevTargetDir(repoRoot, flags.targetDir ?? process.env.MAGAM_TARGET_DIR);
  const outDir = resolveDesktopOutDir(repoRoot);
  const ports = await resolveDesktopPorts();
  mkdirSync(outDir, { recursive: true });

  await runBuildCore(repoRoot);
  await runTailwindBuild(repoRoot, outDir);
  await runEsbuild(repoRoot, outDir, ports);

  const htmlPath = writeDesktopHtml(outDir, ports);
  const electronBinary = resolveElectronBinary(repoRoot);
  const electronProc = spawn({
    cmd: [electronBinary, resolve(outDir, 'main.js')],
    cwd: repoRoot,
    env: {
      ...process.env,
      MAGAM_BUN_BIN: 'bun',
      MAGAM_DESKTOP_HEADLESS: flags.headless ? '1' : '0',
      MAGAM_DESKTOP_HTML_PATH: htmlPath,
      MAGAM_DESKTOP_PRELOAD_PATH: resolve(outDir, 'preload.js'),
      MAGAM_HTTP_PORT: String(ports.httpPort),
      MAGAM_REPO_ROOT: repoRoot,
      MAGAM_TARGET_DIR: targetDir,
      MAGAM_WS_PORT: String(ports.wsPort),
    },
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  const shutdown = () => {
    electronProc.kill();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const exitCode = await electronProc.exited;
  process.exit(exitCode);
}

if (import.meta.main) {
  await run();
}
