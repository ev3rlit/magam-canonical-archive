import * as path from "path";
import * as fs from "fs";
import { transpile } from "../core/transpiler";
import { execute } from "../core/executor";
import { CLI_MESSAGES } from "../messages";

export async function validateCommand(filePath: string) {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(CLI_MESSAGES.validate.fileNotFound(filePath));
    process.exit(1);
  }

  try {
    const transpiled = await transpile(fullPath);
    const result = await execute(transpiled);

    if (result.isOk()) {
      console.log(CLI_MESSAGES.validate.validationPassed);
    } else {
      console.error(CLI_MESSAGES.validate.executionError(result.error.message));
      process.exit(1);
    }
  } catch (error: any) {
    console.error(CLI_MESSAGES.validate.transpileError(error.message));
    process.exit(1);
  }
}
