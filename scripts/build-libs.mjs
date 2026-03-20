#!/usr/bin/env node

import { spawn } from 'node:child_process';

const libFilters = [
  '@magam/shared',
  '@magam/core',
  '@magam/runtime',
  '@magam/cli',
];

function runBuild(filter) {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', ['run', '--filter', filter, 'build'], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`build failed for ${filter} (code=${code ?? 'null'}, signal=${signal ?? 'null'})`));
    });
  });
}

await Promise.all(libFilters.map((filter) => runBuild(filter)));
