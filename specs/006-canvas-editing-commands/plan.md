# Implementation Plan: TSX-Backed Canvas Editing Commands

**Branch**: `006-canvas-editing-commands` | **Date**: 2026-03-13 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-web-editing-board-document/specs/006-canvas-editing-commands/spec.md`
**Input**: Feature specification from `/specs/006-canvas-editing-commands/spec.md` and `docs/features/canvas-editing/README.md`

## Summary

현재 `TSX -> render -> React Flow -> WS RPC -> AST patch` 경로를 유지한 채, 웹 조작을 안전한 semantic command 계층으로 정규화한다. 핵심 설계는 (1) parsed node data에 `editMeta`를 추가해 편집 가능 범위와 carrier를 명시하고, (2) 클라이언트에서 `move/content/style/rename/create/reparent` command를 build한 뒤 기존 RPC(`node.move`, `node.update`, `node.create`, `node.reparent`)에 매핑하며, (3) 서버에서는 command별 patch surface를 분리해 최소 diff만 반영하고, (4) event-based history로 undo/redo를 편집 완료 단위로 유지하는 것이다. 범위는 현행 TSX-backed editing에 한정한다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x workspace runtime  
**Primary Dependencies**: Next.js app runtime, React Flow 11, Zustand graph store, `@magam/core`, `@babel/parser`/`@babel/traverse`/`@babel/generator`, local WS mutation service  
**Storage**: TSX source file(AST patch 기반) + client runtime state(Zustand), 신규 DB 없음  
**Testing**: `bun test` scoped unit/component/ws tests + 수동 canvas validation  
**Target Platform**: 브라우저 기반 Magam editor + Bun local render/WS server  
**Project Type**: 모노레포 웹 애플리케이션(Next.js app + CLI render server + WS patch service)  
**Performance Goals**: SC-001~SC-008 충족, 편집 1회당 불필요한 다중 commit 0건, undo/redo 1회당 이벤트 1건만 반영  
**Constraints**: TSX Source of Truth 유지, 최소 diff patch 원칙, editable subset 밖의 TSX는 read-only 처리, 기존 render/layout 회귀 금지  
**Scale/Scope**: `app/features/render/parseRenderGraph.ts`, `app/components/GraphCanvas.tsx`, `app/components/editor/WorkspaceClient.tsx`, `app/components/FloatingToolbar.tsx`, `app/components/ContextMenu.tsx`, `app/components/nodes/*`, `app/components/ui/StickerInspector.tsx`, `app/hooks/useFileSync.ts`, `app/store/graph.ts`, `app/ws/methods.ts`, `app/ws/filePatcher.ts`, `libs/cli/src/server/http.ts`(필요 시 only if sourceMeta augmentation unavoidable)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: 기존 `sourceMeta`, `move/update/create/reparent` RPC, AST patcher, history store를 먼저 조사했고, 범위를 TSX-backed command layer로 한정했다.
- **II. Structural Simplicity**: 신규 persistence layer를 만들지 않고 기존 WS/RPC/patcher를 재사용한다. 새 feature-level 모듈도 `commands.ts`, `editability.ts`, `createDefaults.ts`로 제한해 현재 재사용 이득이 있는 경계만 둔다.
- **III. Dependency-Linear Design**: 의존성 방향은 `parseRenderGraph/editability -> UI orchestration -> transport -> ws patcher`로 선형화하고, patch helpers는 `filePatcher.ts` 내부 함수 분리까지만 허용한다.
- **IV. Surgical Changes**: 변경 범위는 `parseRenderGraph`, editing UI, store history, ws patch surface에 집중한다. render engine, tabs, chat, search, layout core는 직접 변경 대상이 아니다.
- **V. Goal-Driven Execution**: 각 사용자 스토리는 독립 테스트 가능하도록 command별 acceptance와 회귀 조건을 가졌다. 성공 기준은 최소 diff, 생성 저장, 구조 편집, 롤백/undo 정확도로 측정 가능하다.
- **Technical Constraints**: Zustand 단일 스토어, Bun 워크플로우, AST patch, path alias 규칙, custom reconciler 기반 렌더 모델을 유지한다.

결과: **PASS**

### Post-Phase-1 Re-check

- `research.md`는 `editMeta` 도입 위치, RPC 재사용 전략, insertion policy, reparent UI 해석, rollback/history 정책을 결정한다.
- `data-model.md`는 command envelope, edit target, creation placement, patch surface, history event를 정의한다.
- `contracts/`는 UI intent routing, command envelope, TSX patch surface, create placement, reliability/history 계약을 고정한다.
- `quickstart.md`는 구현 순서와 수동/자동 검증 경로를 명확히 한다.

결과: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/006-canvas-editing-commands/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── semantic-command-envelope-contract.md
│   ├── ui-intent-routing-contract.md
│   ├── editable-subset-contract.md
│   ├── tsx-patch-surface-contract.md
│   ├── patcher-minimal-diff-contract.md
│   ├── create-placement-contract.md
│   ├── rpc-command-mapping-contract.md
│   └── reliability-history-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── components/
│   ├── GraphCanvas.tsx
│   ├── FloatingToolbar.tsx
│   ├── ContextMenu.tsx
│   ├── editor/
│   │   ├── WorkspaceClient.tsx
│   │   └── workspaceEditUtils.ts
│   ├── nodes/
│   │   ├── TextNode.tsx
│   │   ├── MarkdownNode.tsx
│   │   └── ...
│   └── ui/
│       └── StickerInspector.tsx
├── config/
│   └── contextMenuItems.ts
├── features/
│   ├── editing/
│   │   ├── commands.ts
│   │   ├── createDefaults.ts
│   │   └── editability.ts
│   └── render/
│       └── parseRenderGraph.ts
├── hooks/
│   └── useFileSync.ts
├── store/
│   └── graph.ts
└── ws/
    ├── methods.ts
    └── filePatcher.ts

libs/cli/src/server/
└── http.ts
```

**Structure Decision**: 기존 app/ws vertical slice를 유지한다. semantic command와 editability 분류는 `app/features/editing/`에 모으고, UI entrypoint는 `GraphCanvas`/`WorkspaceClient`, server patch entrypoint는 `app/ws/*`에 둔다. `libs/cli/src/server/http.ts`는 가급적 건드리지 않고 `parseRenderGraph.ts`에서 `editMeta`를 계산하는 방향을 우선 택한다.

## Module Boundary Justification

- `app/features/editing/commands.ts`
  - `GraphCanvas.tsx`, `WorkspaceClient.tsx`, `useFileSync.ts`, 테스트들이 같은 command envelope와 payload shape를 공유해야 하므로 현재 시점에 실사용되는 공통 경계다.
  - per-command 파일 분해는 아직 재사용 이득보다 구조 비용이 커서 하지 않는다.
- `app/features/editing/editability.ts`
  - `parseRenderGraph.ts`의 `editMeta` 계산, UI read-only gating, 테스트 검증이 같은 규칙을 공유해야 하므로 별도 파일이 필요하다.
  - 이 파일이 없으면 family/contentCarrier/style whitelist 규칙이 여러 레이어에 중복된다.
- `app/features/editing/createDefaults.ts`
  - Canvas absolute create와 MindMap child/sibling create가 동일한 기본 props, placeholder, ID policy를 공유하므로 독립 경계가 현재 시점에도 유효하다.
- `app/ws/filePatcher.ts`
  - patch helper는 같은 파일 안에서 함수 분리만 하고 별도 모듈로 쪼개지 않는다.
  - 이는 새로운 레이어 수를 늘리지 않으면서 command별 patch surface를 명확히 하기 위한 최소 refactor다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
