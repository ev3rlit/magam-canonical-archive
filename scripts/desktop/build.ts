#!/usr/bin/env bun

import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveRepoRoot(): string {
  return path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
}

export function resolveDesktopBuildDir(repoRoot: string): string {
  return path.join(repoRoot, '.desktop-build');
}

export async function buildDesktopHost(input?: {
  repoRoot?: string;
  sourcemap?: boolean;
}) {
  const repoRoot = input?.repoRoot ?? resolveRepoRoot();
  const outdir = resolveDesktopBuildDir(repoRoot);
  const sourcemap = input?.sourcemap ?? false;

  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });

  await build({
    entryPoints: {
      main: path.join(repoRoot, 'desktop', 'main.ts'),
      preload: path.join(repoRoot, 'desktop', 'preload.ts'),
    },
    outdir,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    external: ['electron'],
    sourcemap: sourcemap ? 'inline' : false,
    logLevel: 'info',
  });

  return {
    repoRoot,
    outdir,
    mainPath: path.join(outdir, 'main.js'),
    preloadPath: path.join(outdir, 'preload.js'),
  };
}

if (import.meta.main) {
  await buildDesktopHost({ sourcemap: true });
}
