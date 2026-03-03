# MCP Server

## 개요

Magam MCP 서버는 [CLI Commands](../cli-commands/README.md)를 셸 접근이 없는 AI 환경(Claude Desktop 등)에 노출하는 얇은 래퍼다. npm 패키지 배포 시 어떤 AI 도구든 MCP 연결만으로 Magam 기능을 자동 발견할 수 있다.

```bash
# 사용자가 AI 도구 설정에 추가
npx magam mcp ./my-notes
```

### 선행 조건

- [CLI Commands](../cli-commands/README.md) (`render`, `validate`) 구현 완료
- `@modelcontextprotocol/sdk` (이미 의존성 설치됨)

### 언제 필요한가?

| 환경 | 셸 접근 | Skill 로드 | MCP 필요? |
|------|--------|-----------|----------|
| **Claude Code** | O | O | 선택적 (CLI로 충분) |
| **Cursor** | O | O | 선택적 (CLI로 충분) |
| **Claude Desktop** | X | X | **필요** |
| **커스텀 AI 에이전트** | △ | X | **필요** |

### CLI 대비 추가 가치

| CLI만 | CLI + MCP |
|-------|-----------|
| AI가 `magam render`를 **알아야** 함 | AI가 도구를 **자동 발견** |
| 셸 접근 필요 | 셸 없는 환경에서도 동작 |
| 에러를 AI가 파싱해야 함 | **구조화된 응답** (isError 플래그) |
| Skill 파일 설치 필요 | `magam://skill`로 문서 자동 제공 |

## MCP Tools — 3개

CLI 명령어와 1:1 대응.

### `render`

`magam render`의 MCP 래핑.

```typescript
{
  name: "render",
  description: "다이어그램 TSX 파일을 렌더링하여 Graph AST(노드, 엣지, 레이아웃 그룹)를 반환합니다.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "렌더링할 파일 경로" }
    },
    required: ["filePath"]
  }
}
```

### `validate`

`magam validate`의 MCP 래핑. 파일 경로 또는 코드 문자열을 받는다.

```typescript
{
  name: "validate",
  description: "TSX 코드의 문법과 실행 가능성을 검증합니다.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "검증할 파일 경로 (code와 택1)" },
      code: { type: "string", description: "검증할 TSX 코드 문자열 (filePath와 택1)" }
    }
  }
}
```

### `write_and_render`

파일 저장 + 렌더링을 하나로 묶은 도구. 셸 접근이 없는 환경(Claude Desktop)에서 파일 쓰기와 검증을 한 번에 처리한다.

```typescript
{
  name: "write_and_render",
  description: "TSX 코드를 파일로 저장하고 렌더링 결과를 반환합니다. 파일 시스템 접근이 없는 환경용.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "저장할 파일 경로" },
      code: { type: "string", description: "Magam TSX 코드" }
    },
    required: ["filePath", "code"]
  }
}
```

## MCP Resource — 1개

### `magam://skill`

Agent Skill 파일(`SKILL.md`)을 그대로 반환. Skill이 설치되지 않은 환경에서 AI에게 컴포넌트 문서를 제공한다.

```typescript
{
  uri: "magam://skill",
  mimeType: "text/markdown",
  text: fs.readFileSync(".agent/skills/magam/SKILL.md", "utf-8")
}
```

**Skill 파일이 Single Source of Truth**. MCP 리소스는 그 배포 수단일 뿐이다.

## 구현

### 파일 구조

```
libs/cli/src/
├── commands/
│   ├── render.ts           # CLI (선행 구현 완료)
│   └── validate.ts         # CLI (선행 구현 완료)
├── mcp/
│   ├── index.ts            # MCP Server 인스턴스 생성
│   ├── resources.ts        # magam://skill 리소스
│   ├── tools.ts            # render, validate, write_and_render
│   └── utils.ts            # 경로 검증, 에러 변환
├── server/
│   └── mcp.ts              # CLI 엔트리포인트 (magam mcp <dir>)
└── core/
    ├── transpiler.ts       # 기존 (변경 없음)
    └── executor.ts         # 기존 (변경 없음)
```

### 서버 진입점

```typescript
// libs/cli/src/mcp/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

export function createMcpServer(targetDir: string) {
  const server = new McpServer({
    name: "magam",
    version: "0.1.0",
  });

  registerResources(server, targetDir);
  registerTools(server, targetDir);

  return server;
}
```

### Tool 핸들러

CLI의 core 함수를 직접 호출한다.

```typescript
// libs/cli/src/mcp/tools.ts
import { transpile } from "../core/transpiler.js";
import { execute } from "../core/executor.js";
import { z } from "zod";
import * as fs from "fs/promises";
import { resolvePath } from "./utils.js";

export function registerTools(server: McpServer, targetDir: string) {

  server.tool("render", { filePath: z.string() }, async ({ filePath }) => {
    const fullPath = resolvePath(targetDir, filePath);

    const result = await transpile(fullPath)
      .andThen((code) => execute(code, fullPath));

    if (result.isErr()) {
      return { content: [{ type: "text", text: result.error.message }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(result.value) }] };
  });

  server.tool("validate",
    { filePath: z.string().optional(), code: z.string().optional() },
    async ({ filePath, code }) => {
      let targetPath: string;

      if (filePath) {
        targetPath = resolvePath(targetDir, filePath);
      } else if (code) {
        targetPath = resolvePath(targetDir, `.tmp_validate_${Date.now()}.tsx`);
        await fs.writeFile(targetPath, code, "utf-8");
      } else {
        return { content: [{ type: "text", text: "filePath 또는 code 필요" }], isError: true };
      }

      try {
        const result = await transpile(targetPath)
          .andThen((c) => execute(c, targetPath));

        if (result.isErr()) {
          return { content: [{ type: "text", text: result.error.message }], isError: true };
        }
        return { content: [{ type: "text", text: "검증 성공" }] };
      } finally {
        if (code) await fs.unlink(targetPath).catch(() => {});
      }
    }
  );

  server.tool("write_and_render",
    { filePath: z.string(), code: z.string() },
    async ({ filePath, code }) => {
      const fullPath = resolvePath(targetDir, filePath);
      await fs.writeFile(fullPath, code, "utf-8");

      const result = await transpile(fullPath)
        .andThen((c) => execute(c, fullPath));

      if (result.isErr()) {
        return {
          content: [{ type: "text", text: `저장됨. 렌더링 에러: ${result.error.message}` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(result.value) }] };
    }
  );
}
```

### 유틸리티

```typescript
// libs/cli/src/mcp/utils.ts
import * as path from "path";

export function resolvePath(targetDir: string, filePath: string): string {
  const fullPath = path.resolve(targetDir, filePath);
  if (!fullPath.startsWith(path.resolve(targetDir))) {
    throw new Error("targetDir 외부 접근 불가");
  }
  return fullPath;
}
```

### 구현량

- **코드**: ~200줄, 4파일
- **의존성**: 0개 추가 (`@modelcontextprotocol/sdk`는 이미 설치됨)

## AI 클라이언트 설정

**Claude Code:**
```json
{
  "mcpServers": {
    "magam": {
      "command": "npx",
      "args": ["magam", "mcp", "./my-notes"]
    }
  }
}
```

**Cursor:**
```json
{
  "mcpServers": {
    "magam": {
      "command": "npx",
      "args": ["magam", "mcp", "./my-notes"]
    }
  }
}
```

## dev 통합 (Phase 3)

`magam dev`에 `--mcp` 플래그를 추가하여 MCP 서버를 함께 실행. AI가 `write_and_render` 실행 시 WebSocket을 통해 프론트엔드가 실시간 갱신된다.

```bash
npx magam dev ./notes --mcp
```

## 보안

| 위협 | 대응 |
|------|------|
| 경로 탈출 | `resolvePath()`에서 `startsWith(targetDir)` 검증 |
| 코드 인젝션 | executor 격리. `libs/runtime/` 워커 사용 고려 |
| 대용량 파일 | 파일 크기 제한 (1MB) |

## 테스트

```bash
# MCP Inspector로 전체 테스트
npx @modelcontextprotocol/inspector npx magam mcp ./notes
```

| 테스트 | 설명 |
|--------|------|
| render 성공 | 정상 파일 → Graph AST JSON |
| render 실패 | 문법 오류 파일 → isError: true |
| validate (파일) | 파일 경로로 검증 |
| validate (코드) | 코드 문자열로 검증 → 임시 파일 자동 삭제 |
| write_and_render | 파일 저장 + 렌더링 |
| skill 리소스 | SKILL.md 내용 반환 |
| 경로 탈출 | `../../../etc/passwd` → 에러 |

## 설계 결정 기록

### ADR-001: AST 패칭 기각

AI가 코드를 직접 수정하는 방식 채택. Babel AST 패칭 (9개 도구, 4개 패키지, ~500줄)은 AI의 코드 수정 능력을 열등하게 재구현하는 것이므로 기각.

### ADR-002: Skill을 Single Source of Truth로

컴포넌트 문서는 `.agent/skills/magam/SKILL.md` 한 곳에서 관리. MCP의 `magam://skill`은 이 파일을 그대로 반환. 별도 JSON 스키마, Prompt 템플릿 불필요.

### ADR-003: MCP에서 파일 I/O 최소화

`write_and_render`만 파일 쓰기 포함 (셸 없는 환경 전용). 셸 접근 가능한 환경에서는 AI가 네이티브 I/O를 사용하고 MCP는 `render`/`validate`만 호출.
