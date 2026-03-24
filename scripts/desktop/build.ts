#!/usr/bin/env bun

import { build } from 'esbuild';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { shouldBuildCore } from '../dev/app-dev';

export interface DesktopRuntimePorts {
  httpPort: number;
  wsPort: number;
}

export interface DesktopBuildResult {
  htmlPath: string;
  mainPath: string;
  outDir: string;
  preloadPath: string;
  rendererPath: string;
  tailwindPath: string;
}

export function resolveRepoRoot(): string {
  return path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
}

export function resolveDesktopOutDir(repoRoot: string): string {
  return path.join(repoRoot, '.magam', 'desktop-host');
}

function listFilesRecursively(rootDir: string): string[] {
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      files.push(fullPath);
    }
  };

  if (existsSync(rootDir)) {
    walk(rootDir);
  }

  return files;
}

async function runBuildCore(repoRoot: string): Promise<void> {
  if (!shouldBuildCore(repoRoot)) {
    return;
  }

  const childProcess = Bun.spawn({
    cmd: ['bun', 'run', 'build:core'],
    cwd: repoRoot,
    env: process.env,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  });

  const exitCode = await childProcess.exited;
  if (exitCode !== 0) {
    throw new Error(`build:core failed with exit code ${exitCode}`);
  }
}

async function runTailwindBuild(repoRoot: string, outDir: string): Promise<string> {
  const outputCss = path.join(outDir, 'tailwind.css');
  const inputCssPath = path.join(repoRoot, 'app', 'app', 'globals.css');
  const source = readFileSync(inputCssPath, 'utf8');
  const result = await postcss([
    tailwindcss({
      config: path.join(repoRoot, 'app', 'tailwind.config.js'),
    }),
    autoprefixer,
  ]).process(source, {
    from: inputCssPath,
    to: outputCss,
  });

  writeFileSync(outputCss, result.css, 'utf8');
  return outputCss;
}

async function runEsbuild(
  repoRoot: string,
  outDir: string,
  ports: DesktopRuntimePorts,
  sourcemap: boolean,
): Promise<{ mainPath: string; preloadPath: string; rendererPath: string }> {
  const tsconfig = path.join(repoRoot, 'app', 'tsconfig.json');
  const mainPath = path.join(outDir, 'main.js');
  const preloadPath = path.join(outDir, 'preload.js');
  const rendererPath = path.join(outDir, 'renderer.js');
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
      entryPoints: [path.join(repoRoot, 'app', 'features', 'host', 'renderer', 'desktopRendererEntry.tsx')],
      format: 'esm',
      jsx: 'automatic',
      outfile: rendererPath,
      platform: 'browser',
      sourcemap: sourcemap ? 'inline' : false,
      tsconfig,
    }),
    build({
      bundle: true,
      define,
      entryPoints: [path.join(repoRoot, 'app', 'features', 'desktop-host', 'main.ts')],
      external: ['electron'],
      format: 'cjs',
      outfile: mainPath,
      platform: 'node',
      sourcemap: sourcemap ? 'inline' : false,
      tsconfig,
    }),
    build({
      bundle: true,
      define,
      entryPoints: [path.join(repoRoot, 'app', 'features', 'desktop-host', 'preload.ts')],
      external: ['electron'],
      format: 'cjs',
      outfile: preloadPath,
      platform: 'node',
      sourcemap: sourcemap ? 'inline' : false,
      tsconfig,
    }),
  ]);

  return { mainPath, preloadPath, rendererPath };
}

function writeDesktopHtml(
  outDir: string,
  ports: DesktopRuntimePorts,
): string {
  const htmlPath = path.join(outDir, 'index.html');
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
  <body class="h-screen overflow-hidden">
    <div id="root" class="h-full"></div>
    <script type="module" src="./renderer.js"></script>
  </body>
</html>`,
    'utf8',
  );
  return htmlPath;
}

function writeRendererCss(outDir: string): void {
  const cssPath = path.join(outDir, 'renderer.css');
  if (!existsSync(cssPath)) {
    writeFileSync(cssPath, '', 'utf8');
  }
}

export async function buildDesktopHost(input?: {
  clean?: boolean;
  ports?: DesktopRuntimePorts;
  repoRoot?: string;
  sourcemap?: boolean;
}): Promise<DesktopBuildResult> {
  const repoRoot = input?.repoRoot ?? resolveRepoRoot();
  const outDir = resolveDesktopOutDir(repoRoot);
  const ports = input?.ports ?? {
    httpPort: parseInt(process.env.MAGAM_HTTP_PORT || '3002', 10),
    wsPort: parseInt(process.env.MAGAM_WS_PORT || '3001', 10),
  };
  const sourcemap = input?.sourcemap ?? false;

  if (input?.clean ?? true) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  await runBuildCore(repoRoot);
  const tailwindPath = await runTailwindBuild(repoRoot, outDir);
  const { mainPath, preloadPath, rendererPath } = await runEsbuild(
    repoRoot,
    outDir,
    ports,
    sourcemap,
  );
  writeRendererCss(outDir);
  const htmlPath = writeDesktopHtml(outDir, ports);

  return {
    htmlPath,
    mainPath,
    outDir,
    preloadPath,
    rendererPath,
    tailwindPath,
  };
}

export function collectDesktopWatchTargets(repoRoot: string): string[] {
  return [
    path.join(repoRoot, 'app'),
    path.join(repoRoot, 'libs'),
    path.join(repoRoot, 'scripts', 'desktop'),
    path.join(repoRoot, 'package.json'),
    path.join(repoRoot, 'app', 'package.json'),
  ].filter((filePath) => existsSync(filePath));
}

export function listDesktopOutputFiles(outDir: string): string[] {
  return [
    path.join(outDir, 'index.html'),
    path.join(outDir, 'main.js'),
    path.join(outDir, 'preload.js'),
    path.join(outDir, 'renderer.js'),
    path.join(outDir, 'renderer.css'),
    path.join(outDir, 'tailwind.css'),
  ].filter((filePath) => existsSync(filePath));
}

export function getNewestMtime(filePaths: string[]): number {
  const existingPaths = filePaths.filter((filePath) => existsSync(filePath));
  if (existingPaths.length === 0) {
    return 0;
  }

  return Math.max(...existingPaths.map((filePath) => statSync(filePath).mtimeMs));
}

export function listDesktopSourceFiles(repoRoot: string): string[] {
  return [
    ...listFilesRecursively(path.join(repoRoot, 'app')),
    ...listFilesRecursively(path.join(repoRoot, 'libs')),
    ...listFilesRecursively(path.join(repoRoot, 'scripts', 'desktop')),
    path.join(repoRoot, 'package.json'),
    path.join(repoRoot, 'app', 'package.json'),
  ].filter((filePath) => existsSync(filePath));
}

if (import.meta.main) {
  await buildDesktopHost({
    clean: true,
    sourcemap: true,
  });
}
