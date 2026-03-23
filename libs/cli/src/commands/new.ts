import { writeFile, access } from "fs/promises";
import * as path from "path";
import { initProject } from "./init";

const COMPATIBILITY_TSX_EXTENSION = ".tsx";

function createCompatibilityCanvasTemplate(componentName: string, baseName: string): string {
  return `import { Canvas, MindMap, Node } from "@magam/core";

export default function ${componentName}() {
  return (
    <Canvas>
      <MindMap>
        <Node id="root" label="${baseName}" />
      </MindMap>
    </Canvas>
  );
}
`;
}

export async function newCommand(fileName: string) {
  if (!fileName.endsWith(COMPATIBILITY_TSX_EXTENSION)) {
    fileName = fileName + COMPATIBILITY_TSX_EXTENSION;
  }

  const fullPath = path.resolve(fileName);

  // Auto-init if .magam doesn't exist
  const projectDir = path.dirname(fullPath);
  try {
    await access(path.join(projectDir, ".magam"));
  } catch {
    await initProject(projectDir);
  }

  try {
    await access(fullPath);
    console.error(`✗ File already exists: ${fileName}`);
    process.exit(1);
  } catch {
    // File doesn't exist — proceed
  }

  const baseName = path.basename(fileName, COMPATIBILITY_TSX_EXTENSION);
  const funcName = baseName
    .replace(/[_-]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());

  await writeFile(fullPath, createCompatibilityCanvasTemplate(funcName, baseName));
  console.log(`✓ Created ${fileName}`);
}
