import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs/promises";
import { transpile } from "../core/transpiler";
import { execute } from "../core/executor";
import { CLI_MESSAGES } from "../messages";
import { resolvePath, validateFileSize, toMcpError, toMcpSuccess } from "./utils";

export function registerTools(server: McpServer, targetDir: string) {
  // --- render ---
  server.registerTool("render", {
    description: CLI_MESSAGES.mcp.renderDescription,
    inputSchema: { filePath: z.string().describe(CLI_MESSAGES.mcp.renderFilePath) },
  }, async ({ filePath }) => {
    try {
      const fullPath = resolvePath(targetDir, filePath);
      await validateFileSize(fullPath);

      const transpiled = await transpile(fullPath);
      const result = await execute(transpiled);

      if (result.isOk()) return toMcpSuccess(result.value);
      return toMcpError(result.error);
    } catch (error: any) {
      return toMcpError(error);
    }
  });

  // --- validate ---
  server.registerTool("validate", {
    description: CLI_MESSAGES.mcp.validateDescription,
    inputSchema: {
      filePath: z
        .string()
        .optional()
        .describe(CLI_MESSAGES.mcp.validateFilePath),
      code: z
        .string()
        .optional()
        .describe(CLI_MESSAGES.mcp.validateCode),
    },
  }, async ({ filePath, code }) => {
    if (!filePath && !code) {
      return toMcpError(new Error(CLI_MESSAGES.mcp.validateFileOrCodeRequired));
    }

    let targetPath: string;
    const isTempFile = !filePath && !!code;

    try {
      if (filePath) {
        targetPath = resolvePath(targetDir, filePath);
      } else {
        targetPath = resolvePath(
          targetDir,
          `.tmp_validate_${Date.now()}.tsx`
        );
        await fs.writeFile(targetPath, code!, "utf-8");
      }

      await validateFileSize(targetPath);
      const transpiled = await transpile(targetPath);
      const result = await execute(transpiled);

      if (result.isOk()) return toMcpSuccess(CLI_MESSAGES.mcp.validateSuccess);
      return toMcpError(result.error);
    } catch (error: any) {
      return toMcpError(error);
    } finally {
      if (isTempFile) await fs.unlink(targetPath!).catch(() => {});
    }
  });

  // --- write_and_render ---
  server.registerTool("write_and_render", {
    description: CLI_MESSAGES.mcp.writeAndRenderDescription,
    inputSchema: {
      filePath: z.string().describe(CLI_MESSAGES.mcp.writeAndRenderFilePath),
      code: z.string().describe(CLI_MESSAGES.mcp.writeAndRenderCode),
    },
  }, async ({ filePath, code }) => {
    try {
      const fullPath = resolvePath(targetDir, filePath);
      await fs.writeFile(fullPath, code, "utf-8");

      const transpiled = await transpile(fullPath);
      const result = await execute(transpiled);

      if (result.isOk()) return toMcpSuccess(result.value);
      return {
        content: [
          {
            type: "text" as const,
            text: CLI_MESSAGES.mcp.savedButRenderFailed(result.error.message),
          },
        ],
        isError: true as const,
      };
    } catch (error: any) {
      return toMcpError(error);
    }
  });
}
