import { mkdir, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { CLI_MESSAGES } from '../messages';

export async function initProject(cwd: string) {
  const magamDir = join(cwd, '.magam', 'node_modules', 'magam');

  // 1. Create .magam/node_modules/magam/ folder
  await mkdir(magamDir, { recursive: true });

  // 2. Copy types (mock for now)
  const dtsContent = `
// Mock types for magam
export declare const Canvas: any;
export declare const Sticky: any;
export declare const Shape: any;
export declare const Text: any;
export declare const Group: any;
export declare const MindMap: any;
export declare const Node: any;
`;
  await writeFile(join(magamDir, 'index.d.ts'), dtsContent);

  // 3. Write tsconfig.json
  const tsconfigPath = join(cwd, 'tsconfig.json');
  try {
    await access(tsconfigPath);
    console.warn(
      CLI_MESSAGES.init.existingTsconfig,
    );
  } catch {
    const tsconfigContent = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          magam: ['.magam/node_modules/magam'],
        },
      },
    };
    await writeFile(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));
    console.log(CLI_MESSAGES.init.createdTsconfig);
  }

  console.log(CLI_MESSAGES.init.initializedProject);
}
