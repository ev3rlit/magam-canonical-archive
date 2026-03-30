# CLI Commands: render, validate

## 개요

Magam CLI에 `render`와 `validate` 서브커맨드를 추가한다. AI 에이전트가 다이어그램 TSX 코드를 작성한 후 결과를 검증하는 데 사용한다.

```bash
magam dev ./notes              # 기존: dev 서버 시작
magam render ./notes/arch.tsx  # NEW: Graph AST JSON 출력
magam validate ./notes/arch.tsx # NEW: 문법/실행 검증
```

### 배경

Magam의 AI 통합은 세 계층으로 구성된다:

```
Agent Skill (SKILL.md)     → "무엇을 어떻게 쓰는지" (컴포넌트 문서, 패턴)
CLI Commands (이 문서)      → "쓴 결과가 맞는지" (렌더링 검증, 문법 검증)
MCP Server (별도 문서)      → CLI를 셸 없는 환경에 노출 (선택적)
```

Skill 파일이 AI에게 컴포넌트 사용법을 가르치고, CLI 명령어가 작성된 코드의 정합성을 검증한다. **이 두 가지만으로 Claude Code / Cursor에서 완전한 AI 워크플로우가 동작한다.**

## `magam render`

TSX 파일을 렌더링하여 Graph AST를 stdout에 JSON으로 출력한다.

### 사용법

```bash
$ npx magam render <file>
```

### 출력 형식

**성공 시** (exit code 0):

```json
{
  "nodes": [
    { "id": "server", "type": "shape", "data": { "label": "API Server" } },
    { "id": "db", "type": "shape", "data": { "label": "PostgreSQL" } }
  ],
  "edges": [
    { "source": "server", "target": "db", "data": { "label": "query" } }
  ],
  "mindMapGroups": [
    { "id": "map", "rootId": "root", "direction": "right" }
  ]
}
```

**실패 시** (exit code 1):

```json
{ "error": "트랜스파일 실패: Unexpected token at line 5" }
```

### 동작 흐름

```
magam render ./notes/arch.tsx
  → path.resolve(filePath)
  → transpile(fullPath)       ← 기존 esbuild 트랜스파일러
  → execute(code, fullPath)   ← 기존 Node.js executor
  → JSON.stringify(result)    → stdout
```

기존 `libs/cli/src/core/` 의 transpiler/executor를 직접 호출한다. 새로운 렌더링 로직 없음.

## `magam validate`

TSX 파일의 문법과 실행 가능성을 검증한다. render와 동일한 파이프라인을 실행하되, Graph AST 대신 성공/실패만 출력한다.

### 사용법

```bash
$ npx magam validate <file>
```

### 출력 형식

**성공 시** (exit code 0):

```
✓ 검증 성공
```

**실패 시** (exit code 1):

```
✗ 트랜스파일 에러: Cannot find module '@magam/core'
```

```
✗ 실행 에러: default export is not a function
```

## 구현

### 파일 구조

```
libs/cli/src/
├── commands/
│   ├── render.ts       # NEW
│   └── validate.ts     # NEW
├── cli.ts              # 기존 (서브커맨드 라우팅 추가)
└── core/
    ├── transpiler.ts   # 기존 (변경 없음)
    └── executor.ts     # 기존 (변경 없음)
```

### render.ts

```typescript
// libs/cli/src/commands/render.ts
import * as path from "path";
import { transpile } from "../core/transpiler.js";
import { execute } from "../core/executor.js";

export async function renderCommand(filePath: string) {
  const fullPath = path.resolve(filePath);

  const transpileResult = await transpile(fullPath);
  if (transpileResult.isErr()) {
    console.error(JSON.stringify({ error: transpileResult.error.message }));
    process.exit(1);
  }

  const executeResult = await execute(transpileResult.value, fullPath);
  if (executeResult.isErr()) {
    console.error(JSON.stringify({ error: executeResult.error.message }));
    process.exit(1);
  }

  console.log(JSON.stringify(executeResult.value, null, 2));
}
```

### validate.ts

```typescript
// libs/cli/src/commands/validate.ts
import * as path from "path";
import { transpile } from "../core/transpiler.js";
import { execute } from "../core/executor.js";

export async function validateCommand(filePath: string) {
  const fullPath = path.resolve(filePath);

  const transpileResult = await transpile(fullPath);
  if (transpileResult.isErr()) {
    console.error(`✗ 트랜스파일 에러: ${transpileResult.error.message}`);
    process.exit(1);
  }

  const executeResult = await execute(transpileResult.value, fullPath);
  if (executeResult.isErr()) {
    console.error(`✗ 실행 에러: ${executeResult.error.message}`);
    process.exit(1);
  }

  console.log("✓ 검증 성공");
}
```

### cli.ts 수정

```typescript
// libs/cli/src/cli.ts (기존 파일에 추가)
import { renderCommand } from "./commands/render.js";
import { validateCommand } from "./commands/validate.js";

const command = process.argv[2];
const target = process.argv[3];

switch (command) {
  case "dev":
    // 기존 dev 서버 로직
    break;
  case "render":
    if (!target) {
      console.error("사용법: magam render <file>");
      process.exit(1);
    }
    await renderCommand(target);
    break;
  case "validate":
    if (!target) {
      console.error("사용법: magam validate <file>");
      process.exit(1);
    }
    await validateCommand(target);
    break;
  default:
    console.error(`알 수 없는 명령어: ${command}`);
    console.error("사용법: magam <dev|render|validate> [options]");
    process.exit(1);
}
```

### 구현량

- **코드**: ~50줄 (2개 파일 + cli.ts 수정)
- **의존성**: 0개 (기존 transpiler/executor 재사용)
- **테스트**: 기존 examples/ 파일로 즉시 검증 가능

## AI 워크플로우

### Claude Code / Cursor (Skill + CLI만으로 동작)

```
사용자: "인증 흐름 다이어그램 만들어줘"

AI 동작:
1. [Skill 참조] 컴포넌트 문서로 올바른 TSX 구조 파악
2. [Write] ./notes/auth.tsx ← TSX 코드 작성
3. [Bash] npx magam render ./notes/auth.tsx ← 렌더링 검증
4. (에러 시) [Read + Edit] 코드 수정 → 3번 재실행
5. (성공) 브라우저에서 확인 가능
```

### 수정 시나리오

```
사용자: "DB 노드 라벨을 PostgreSQL로 바꿔줘"

AI 동작:
1. [Read] ./notes/arch.tsx ← 현재 코드 읽기
2. [Edit] <Shape id="db" label="MySQL"> → <Shape id="db" label="PostgreSQL">
3. [Bash] npx magam render ./notes/arch.tsx ← 변경 검증
```

### Edge 연결 변경 시나리오

```
사용자: "server→db 연결을 server→cache→db로 바꿔줘"

AI 동작:
1. [Read] ./notes/arch.tsx
2. [Edit] Edge 삭제/추가 (AI가 코드를 이해하고 직접 수정)
3. [Bash] npx magam render ./notes/arch.tsx ← 검증
```

## 테스트

```bash
# 기존 예제 파일로 테스트
npx magam render ./examples/mindmap.tsx | jq .
npx magam render ./examples/tinyurl_architecture.tsx | jq .nodes
npx magam validate ./examples/overview.tsx

# 에러 케이스
echo 'invalid code' > /tmp/broken.tsx
npx magam validate /tmp/broken.tsx  # exit code 1 확인
```

## 후속 작업

- `magam mcp` 서브커맨드 → [MCP Server PRD](../mcp/README.md)
- `magam dev --mcp` 통합 → MCP PRD Phase 3
