import * as path from "path";
import * as fs from "fs";
import { transpile } from "../core/transpiler";
import { execute } from "../core/executor";
import { CLI_MESSAGES } from "../messages";

export async function renderCommand(filePath: string) {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(JSON.stringify({ error: CLI_MESSAGES.render.fileNotFound(filePath) }));
    process.exit(1);
  }

  try {
    const transpiled = await transpile(fullPath);
    const result = await execute(transpiled);

    if (result.isOk()) {
      console.log(JSON.stringify(result.value, null, 2));
    } else {
      console.error(
        JSON.stringify({
          error: result.error.message,
          type: result.error.type || CLI_MESSAGES.render.executionErrorType,
        })
      );
      process.exit(1);
    }
  } catch (error: any) {
    console.error(JSON.stringify({ error: error.message || CLI_MESSAGES.render.unknownError }));
    process.exit(1);
  }
}
