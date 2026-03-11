import { writeFile, access } from "fs/promises";
import * as path from "path";
import { initProject } from "./init";

export async function newCommand(fileName: string) {
  if (!fileName.endsWith(".tsx")) {
    fileName = fileName + ".tsx";
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

  const baseName = path.basename(fileName, ".tsx");
  const funcName = baseName
    .replace(/[_-]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());

  const template = `import { Canvas, MindMap, Node } from "@magam/core";

export default function ${funcName}() {
  return (
    <Canvas>
      <MindMap>
        <Node id="root" label="${baseName}" />
      </MindMap>
    </Canvas>
  );
}
`;

  await writeFile(fullPath, template);
  console.log(`✓ Created ${fileName}`);
}
