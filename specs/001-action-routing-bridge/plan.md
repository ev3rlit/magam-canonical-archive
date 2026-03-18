# Implementation Plan: Action Routing Bridge

**Branch**: `001-action-routing-bridge` | **Date**: 2026-03-18 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-action-routing-bridge/specs/001-action-routing-bridge/spec.md`
**Input**: Feature specification from `/specs/001-action-routing-bridge/spec.md` and `/docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/action-routing-bridge/README.md`

## Summary

UI surface별 ad-hoc write path를 제거하고 `Action Routing Bridge`를 단일 진입점으로 도입한다. 핵심 설계는 (1) 모든 UI surface가 공통 `UI Intent Envelope`를 bridge에 전달하고, (2) bridge registry가 selection context + canonical metadata로 gating과 payload normalization을 수행하며, (3) bridge가 ordered dispatch plan(`canonical mutation`, `canonical query`, `runtime-only action`)을 반환하고, (4) optimistic/rollback metadata를 동일 descriptor에 포함해 `ui-runtime-state`와 연결하는 것이다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x  
**Primary Dependencies**: `@magam/core`, `app/features/editing/{commands,editability,capabilityProfile}.ts`, `app/features/render/parseRenderGraph.ts`, `app/components/{GraphCanvas,ContextMenu,FloatingToolbar}.tsx`, `app/components/editor/{WorkspaceClient,workspaceEditUtils}.ts`, `app/hooks/useFileSync.ts`, `app/store/graph.ts`, `app/ws/{methods,filePatcher}.ts`  
**Storage**: TSX source files(AST patch 기반) + runtime graph state(Zustand), 신규 DB 없음  
**Testing**: `bun test` 기반 unit/component/ws tests (`app/features/editing/*`, `app/components/*`, `app/ws/*`, `app/hooks/useFileSync.test.ts`, `app/store/graph.test.ts`)  
**Target Platform**: Magam web editor + Bun WS runtime  
**Project Type**: 모노레포 웹 애플리케이션(React editor + WS patch service)  
**Performance Goals**: SC-001~SC-006 충족, 대표 intent 실행 시 bridge 우회 호출 0건, optimistic 실패 시 rollback 누락 0건  
**Constraints**: canonical mutation schema 재정의 금지, selection 해석/overlay 계산 제외, broad fallback 금지, 기존 validation/error contract 전달 보존  
**Scale/Scope**: `app/features/editing/`의 bridge 모듈 추가와 4개 UI surface 연동(`GraphCanvas`, `FloatingToolbar`, `ContextMenu`, `WorkspaceClient`) + ws/rpc 연계 경로 보강

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: 범위를 action bridge 계약으로 제한하고, mutation schema/selection/overlay는 비범위로 명시했다.
- **II. Structural Simplicity**: surface별 분산 로직을 하나의 bridge registry/dispatcher로 통합하되, 기존 `commands.ts`/`methods.ts`를 재사용한다.
- **III. Feature-Oriented Modular Monolith**: bridge 관련 책임은 `app/features/editing/actionRoutingBridge/*`에 묶고 UI와 WS는 소비자로 유지한다.
- **IV. Dependency-Linear Design**: `UI intent -> bridge -> command/dispatch -> ws` 단방향을 유지하며 UI에서 ws 직접 우회 호출을 금지한다.
- **V. Promptable Modules**: intent envelope, registry rule, dispatch descriptor, optimistic metadata를 문서화된 계약으로 분리한다.
- **VI. Surgical Changes**: 기존 toolbar/menu UI 세트 확장 대신 routing 경로만 전환한다.
- **VII. Goal-Driven and Verifiable Execution**: 미등록 intent, invalid payload, rollback 경로를 회귀 기준으로 포함한다.

결과: **PASS**

### Post-Phase-1 Re-check

- `research.md`에서 bridge output contract, registry ownership, ordered dispatch, optimistic propagation 규칙을 결정했다.
- `data-model.md`에서 `UIIntentEnvelope`, `IntentRegistryEntry`, `DispatchDescriptor`, `OrderedDispatchPlan`, `OptimisticPendingRecord`를 고정했다.
- `contracts/`에 intent/registry/dispatch/optimistic/surface-adoption 계약을 분리해 병렬 구현 경계를 명확히 했다.
- `quickstart.md`에 단계별 구현 순서와 회귀/수동 검증 루틴을 정의했다.

결과: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/001-action-routing-bridge/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── bridge-intent-envelope-contract.md
│   ├── intent-registry-contract.md
│   ├── dispatch-descriptor-contract.md
│   ├── optimistic-rollback-contract.md
│   └── surface-adoption-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── features/
│   ├── editing/
│   │   ├── commands.ts
│   │   ├── editability.ts
│   │   ├── capabilityProfile.ts
│   │   └── actionRoutingBridge/
│   │       ├── types.ts
│   │       ├── registry.ts
│   │       ├── routeIntent.ts
│   │       └── optimistic.ts
│   └── render/
│       └── parseRenderGraph.ts
├── components/
│   ├── GraphCanvas.tsx
│   ├── FloatingToolbar.tsx
│   ├── ContextMenu.tsx
│   └── editor/
│       ├── WorkspaceClient.tsx
│       └── workspaceEditUtils.ts
├── hooks/
│   └── useFileSync.ts
├── store/
│   └── graph.ts
└── ws/
    ├── methods.ts
    └── filePatcher.ts
```

**Structure Decision**: bridge 자체는 `app/features/editing/actionRoutingBridge/`에서 소유한다. UI surface 파일들은 intent envelope 생성과 bridge 호출만 담당한다. 서버 측은 기존 `methods.ts`/`filePatcher.ts` 계약을 유지하며, bridge에서 전달되는 descriptor/metadata 소비만 보강한다.

## Module Boundary Justification

- `actionRoutingBridge/types.ts`: intent input, descriptor output, 오류/optimistic 타입을 고정하는 계약 경계
- `actionRoutingBridge/registry.ts`: surface와 독립적인 intent mapping/gating 규칙 저장소
- `actionRoutingBridge/routeIntent.ts`: envelope -> dispatch plan 변환 오케스트레이션
- `actionRoutingBridge/optimistic.ts`: pending key/baseVersion/rollback metadata 보강 책임
- UI/WS 파일: bridge 소비자 책임만 유지하고 bridge 내부 규칙을 복제하지 않음

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
