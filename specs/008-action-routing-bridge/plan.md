# Implementation Plan: Action Routing Bridge

**Branch**: `008-action-routing-bridge` | **Date**: 2026-03-18 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-selection-floating-menu/specs/008-action-routing-bridge/spec.md`
**Input**: Feature specification from `/specs/008-action-routing-bridge/spec.md` and source brief `/docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/action-routing-bridge/README.md`

## Summary

UI entrypoint intent를 단일 action routing bridge로 수렴시켜 ad-hoc write path를 제거한다. 구현 핵심은 (1) surface 공통 request/response contract 고정, (2) payload normalization과 semantic/capability 기반 gating, (3) 단일/복합 canonical action orchestration, (4) optimistic apply/commit/reject 이벤트와 ui-runtime-state 책임 분리, (5) 4개 entrypoint surface의 bridge-only adoption 검증이다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x  
**Primary Dependencies**: `app/features/render/parseRenderGraph.ts`, `app/features/editing/{editability.ts,commands.ts,createDefaults.ts,capabilityProfile.ts}`, `app/ws/{methods.ts,filePatcher.ts,rpc.ts}`, `app/components/{GraphCanvas.tsx,ContextMenu.tsx,FloatingToolbar.tsx}`, `app/components/editor/{WorkspaceClient.tsx,workspaceEditUtils.ts}`  
**Storage**: TSX source file patch pipeline + runtime-only UI state (새 DB 없음)  
**Testing**: `bun test` 기반 unit/integration (`app/ws/*.test.ts`, `app/components/*.test.tsx`, `app/components/editor/*.test.tsx`, `app/features/editing/*.ts`)  
**Target Platform**: Magam web canvas editor + WS command pipeline  
**Project Type**: 모노레포 기반 CLI-first TSX canvas application  
**Performance Goals**: SC-001~SC-005 달성, intent routing 정확도 95%+, rollback 이벤트 누락 0%, direct write path 0건  
**Constraints**: canonical mutation schema 변경 금지, selection 해석/overlay 위치 계산 구현 제외, silent fallback 금지, surface별 중복 optimistic 처리 금지  
**Scale/Scope**: 4개 entrypoint surface(toolbar/floating/pane/node), bridge contract/normalizer/orchestrator, ws validation contract, entrypoint adoption 검사

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: intent 분류, bridge contract, optimistic 책임 경계를 사전 명시해 해석 여지를 줄인다.
- **II. Structural Simplicity**: 새 persistence 모델 추가 없이 기존 canonical executor 위에 bridge 계층만 도입한다.
- **III. Feature-Oriented Modular Monolith**: 변경 범위를 entrypoint/routing/editability/ws 경계에 제한하고 surface item 구성과 분리한다.
- **IV. Dependency-Linear Design**: `surface -> resolver -> bridge -> canonical executor` 단방향 흐름을 강제한다.
- **V. Promptable Modules**: intent catalog, normalizer, orchestrator, optimistic lifecycle를 문서 계약으로 분리해 병렬 작업 가능성을 높인다.
- **VI. Surgical Changes**: selection 해석, overlay positioning, schema 변경을 제외하고 routing 경계만 수정한다.
- **VII. Goal-Driven and Verifiable Execution**: routing coverage, error explicitness, rollback consistency, direct write path 검출 기준을 검증 항목으로 고정한다.

결과: **PASS**

### Post-Phase-1 Re-check

- `research.md`에서 intent taxonomy, normalization precedence, orchestration 실패 처리, optimistic event model, adoption enforcement 전략을 확정했다.
- `data-model.md`에서 bridge request/response, dispatch recipe, lifecycle event를 정규화했다.
- `contracts/`에서 surface 입력 계약, validation/error 계약, optimistic/rollback 계약, adoption 계약을 분리했다.
- `quickstart.md`에서 단계별 실행/검증 체크포인트와 테스트 명령을 정의했다.

결과: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/008-action-routing-bridge/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── bridge-request-response-contract.md
│   ├── intent-catalog-contract.md
│   ├── normalization-gating-contract.md
│   ├── dispatch-orchestration-contract.md
│   ├── optimistic-lifecycle-contract.md
│   └── surface-adoption-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/features/
├── editing/
│   ├── __fixtures__/actionRoutingBridgeFixtures.ts
│   ├── actionDispatchRecipes.ts
│   ├── actionGating.test.ts
│   ├── actionGating.ts
│   ├── actionIntentCatalog.ts
│   ├── actionOptimisticLifecycle.ts
│   ├── actionPayloadNormalizer.ts
│   ├── actionRoutingBridge.test.ts
│   ├── actionRoutingBridge.ts
│   ├── actionRoutingBridge.types.ts
│   ├── actionRoutingBridgeTestUtils.ts
│   ├── actionRoutingErrors.ts
│   ├── capabilityProfile.ts
│   ├── commands.ts
│   ├── createDefaults.ts
│   └── editability.ts
└── render/
    └── parseRenderGraph.ts

app/components/
├── GraphCanvas.tsx
├── ContextMenu.tsx
├── FloatingToolbar.tsx
└── editor/
    ├── WorkspaceClient.tsx
    └── workspaceEditUtils.ts

app/hooks/
└── useContextMenu.ts

app/store/
└── graph.ts

app/ws/
├── filePatcher.ts
├── methods.ts
└── rpc.ts
```

**Structure Decision**: bridge 책임은 `app/features/editing` 계층(요청 정규화/게이팅/intent 매핑)으로 모으고, UI surface는 bridge dispatch만 호출한다. `app/store/graph.ts`는 optimistic pending token을 저장하는 ui-runtime-state owner로 남긴다. WS 계층(`app/ws/*`)은 canonical executor 오류 계약과 재검증 책임을 유지한다. `parseRenderGraph.ts`는 resolver input metadata의 canonical 기반을 제공한다.

## Module Boundary Justification

- `app/features/editing/*`
  - bridge request 해석, intent-to-action 매핑, gating 규칙의 단일 소유자.
  - UI component와 WS transport 세부사항을 직접 소유하지 않는다.
- `app/components/*`, `app/components/editor/*`
  - intent 발행과 상태 표시를 담당한다.
  - canonical action 조립과 validator 로직을 소유하지 않는다.
- `app/ws/*`
  - 최종 mutation validation/error contract와 rollback 안전성을 보장한다.
  - surface별 UI 분기를 소유하지 않는다.
- `app/features/render/parseRenderGraph.ts`
  - selection/target canonical metadata의 정규화 기반 제공.
  - overlay/toolbar action 결정 로직은 소유하지 않는다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
