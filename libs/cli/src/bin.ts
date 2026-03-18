#!/usr/bin/env node

import { createCoreInterceptor } from '@magam/shared';
import { cliError } from '@magam/shared';
import { hasJsonFlag } from './headless/options';
import { writeFailure, writeSuccess } from './headless/json-output';

// Set up module resolution for monorepo/local dev environment
// From dist/libs/cli/src/bin.js -> dist/libs/core
createCoreInterceptor(__dirname, '../../core');

interface Command {
  usage: string;
  description: string;
  run: (args: string[]) => Promise<void>;
}

type ResourceCommandRunner = (args: string[]) => Promise<{
  data: unknown;
  meta?: Record<string, unknown>;
}>;

function requireArg(args: string[], _name: string, usage: string): string {
  const value = args[0];
  if (!value) {
    console.error(`Usage: magam ${usage}`);
    process.exit(1);
  }
  return value;
}

const commands: Record<string, Command> = {
  init: {
    usage: 'init',
    description: 'Initialize a new project',
    run: async () => {
      const { initProject } = await import('./commands/init');
      await initProject(process.cwd());
    },
  },
  dev: {
    usage: 'dev',
    description: 'Start development server',
    run: async () => {
      const { startDevServer } = await import('./commands/dev');
      await startDevServer(process.cwd());
    },
  },
  new: {
    usage: 'new <filename>',
    description: 'Create a new diagram file',
    run: async (args) => {
      const fileName = requireArg(args, 'filename', 'new <filename>');
      const { newCommand } = await import('./commands/new');
      await newCommand(fileName);
    },
  },
  render: {
    usage: 'render <file>',
    description: 'Render TSX file to Graph AST JSON',
    run: async (args) => {
      const filePath = requireArg(args, 'file', 'render <file>');
      const { renderCommand } = await import('./commands/render');
      await renderCommand(filePath);
    },
  },
  validate: {
    usage: 'validate <file>',
    description: 'Validate TSX file syntax and execution',
    run: async (args) => {
      const filePath = requireArg(args, 'file', 'validate <file>');
      const { validateCommand } = await import('./commands/validate');
      await validateCommand(filePath);
    },
  },
  serve: {
    usage: 'serve [dir]',
    description: 'Start HTTP render server only',
    run: async (args) => {
      const targetDir = args[0] || process.cwd();
      const { startHttpServer } = await import('./server/http');
      const server = await startHttpServer({ targetDir });
      console.log(`HTTP render server started on port ${server.port}`);
      process.on('SIGINT', async () => {
        console.log('\nShutting down HTTP server...');
        await server.close();
        process.exit(0);
      });
    },
  },
  mcp: {
    usage: 'mcp [dir]',
    description: 'Start MCP server (stdio transport)',
    run: async (args) => {
      const targetDir = args[0] || process.cwd();
      const { startMcpServer } = await import('./server/mcp');
      await startMcpServer(targetDir);
    },
  },

  image: {
    usage: 'image insert --file <file> --source <path|url> --mode <node|markdown|canvas|shape> [--target <id>]',
    description: 'Insert an image into Magam source by mode',
    run: async (args) => {
      const sub = args[0];
      if (sub !== 'insert') {
        console.error('Usage: magam image insert ...');
        process.exit(1);
      }

      const { insertImageCommand } = await import('./commands/image');
      await insertImageCommand(args.slice(1));
    },
  },
};

const resourceCommands: Record<string, ResourceCommandRunner> = {
  workspace: async (args) => {
    const { runWorkspaceCommand } = await import('./commands/workspace');
    return runWorkspaceCommand(args);
  },
  document: async (args) => {
    const { runDocumentCommand } = await import('./commands/document');
    return runDocumentCommand(args);
  },
  surface: async (args) => {
    const { runSurfaceCommand } = await import('./commands/surface');
    return runSurfaceCommand(args);
  },
  object: async (args) => {
    const { runObjectCommand } = await import('./commands/object');
    return runObjectCommand(args);
  },
  search: async (args) => {
    const { runSearchCommand } = await import('./commands/search');
    return runSearchCommand(args);
  },
  'canvas-node': async (args) => {
    const { runCanvasNodeCommand } = await import('./commands/canvas-node');
    return runCanvasNodeCommand(args);
  },
  mutation: async (args) => {
    const { runMutationCommand } = await import('./commands/mutation');
    return runMutationCommand(args);
  },
};

commands['help'] = {
  usage: 'help',
  description: 'Show this help message',
  run: async () => printHelp(),
};

function printHelp() {
  console.log('Usage: magam <command>\n');
  console.log('Legacy Commands:');
  const maxUsageLen = Math.max(...Object.values(commands).map((c) => c.usage.length));
  for (const cmd of Object.values(commands)) {
    console.log(`  ${cmd.usage.padEnd(maxUsageLen + 2)} ${cmd.description}`);
  }
  console.log('\nHeadless Resource Commands:');
  console.log('  workspace list|get [--workspace <id>] [--json]');
  console.log('  document get --document <id> [--json]');
  console.log('  surface get|query-nodes --document <id> --surface <id> [--bounds x,y,w,h] [--json]');
  console.log('  object get|query [filters] [--json]');
  console.log('  object update-content --workspace <id> --object <id> --kind <kind> --patch <json|@stdin> [--document <id>] [--json]');
  console.log('  object patch-capability --workspace <id> --object <id> --capability <name> --patch <json|@stdin> [--document <id>] [--json]');
  console.log('  search objects|documents --text <query> [--workspace <id>] [--json]');
  console.log('  canvas-node move|reparent --document <id> --node <id> [...] [--json]');
  console.log('  mutation apply [--workspace <id>] [--document <id>] [--dry-run] [--json] < batch.json');
}

async function runResourceCommand(command: string, args: string[]): Promise<number> {
  const runner = resourceCommands[command];
  const json = hasJsonFlag(args);
  try {
    const result = await runner(args);
    writeSuccess(result, json);
    return 0;
  } catch (error) {
    return writeFailure(error, json, {
      command,
    });
  }
}

export async function runCli(args: string[]): Promise<number> {
  const command = args[0];

  if (command && resourceCommands[command]) {
    return runResourceCommand(command, args.slice(1));
  }

  const cmd = command ? commands[command] : undefined;
  if (!cmd) {
    printHelp();
    if (command) {
      console.error(`\nUnknown command: ${command}`);
      return 1;
    }
    return 0;
  }

  await cmd.run(args.slice(1));
  return 0;
}

async function main() {
  const exitCode = await runCli(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

main().catch((err) => {
  const json = hasJsonFlag(process.argv.slice(2));
  const exitCode = writeFailure(err, json, {
    command: process.argv[2] ?? 'magam',
  });
  process.exit(exitCode);
});
