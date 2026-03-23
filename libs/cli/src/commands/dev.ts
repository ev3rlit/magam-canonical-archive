import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import glob = require('fast-glob');
import { transpile } from '../core/transpiler';
import { execute } from '../core/executor';
import { MagamError } from '@magam/core';
import { startServer, broadcast } from '../server/websocket';
import { CLI_MESSAGES } from '../messages';

const COMPATIBILITY_ENTRY_CANDIDATES = ['overview.tsx', 'main.tsx'] as const;
const COMPATIBILITY_TSX_GLOB = '**/*.tsx';

export async function startDevServer(cwd: string, entryFile?: string) {
  let entryPoint = entryFile;
  if (!entryPoint) {
    entryPoint = COMPATIBILITY_ENTRY_CANDIDATES.find((candidate) => fs.existsSync(path.join(cwd, candidate)));
    if (!entryPoint) {
      console.error(
        `\x1b[31m${CLI_MESSAGES.dev.missingEntryFile}\x1b[0m`,
      );
      return;
    }
  }

  let fullEntryPoint = path.resolve(cwd, entryPoint);
  if (!fs.existsSync(fullEntryPoint)) {
    console.error(`\x1b[31m${CLI_MESSAGES.dev.entryFileNotFound(fullEntryPoint)}\x1b[0m`);
    return;
  }

  console.log(CLI_MESSAGES.dev.startingDevServer(entryPoint));

  let lastSuccessState: any = null;
  let errors: any[] = [];

  const run = async () => {
    try {
      console.log(CLI_MESSAGES.dev.compiling);
      const code = await transpile(fullEntryPoint);

      console.log(CLI_MESSAGES.dev.executing);
      const result = await execute(code);

      lastSuccessState = result;
      errors = [];
      console.log(`\x1b[32m${CLI_MESSAGES.dev.updatedSuccessfully}\x1b[0m`);

      broadcast({ type: 'graph-update', payload: result });
    } catch (error: any) {
      if (error instanceof MagamError) {
        console.error(
          `\x1b[31m${CLI_MESSAGES.dev.errorPrefix(error.type, error.message)}\x1b[0m`,
        );
        if (error.suggestion) {
          console.error(`\x1b[33m${CLI_MESSAGES.dev.tipPrefix(error.suggestion)}\x1b[0m`);
        }
      } else if (error instanceof Error) {
        console.error(`\x1b[31m${CLI_MESSAGES.dev.genericError(error.message)}\x1b[0m`);
      } else {
        console.error(`\x1b[31m${CLI_MESSAGES.dev.unknownError}\x1b[0m`, error);
      }
      errors.push(error);

      broadcast({
        type: 'error',
        payload: {
          message: error.message || 'Unknown error',
          type: error instanceof MagamError ? error.type : 'general',
        },
      });
    }
  };

  const { port } = await startServer(undefined, async (message, ws) => {
    if (message.type === 'get-files') {
      const files = await glob(COMPATIBILITY_TSX_GLOB, {
        cwd,
        ignore: ['**/node_modules/**', '**/.git/**'],
      });
      ws.send(JSON.stringify({ type: 'file-list', payload: files }));
    } else if (message.type === 'switch-file') {
      const filename = message.payload;
      console.log(CLI_MESSAGES.dev.switchingFile(filename));
      entryPoint = filename;
      fullEntryPoint = path.resolve(cwd, filename);
      await run();
    }
  });
  console.log(CLI_MESSAGES.dev.websocketStarted(port));

  await run();

  const watcher = chokidar.watch(COMPATIBILITY_TSX_GLOB, {
    cwd,
    ignored: ['**/node_modules/**', '**/.git/**'],
    ignoreInitial: true,
  });

  let timer: NodeJS.Timeout;
  watcher.on('all', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 100);
  });
}
