# Implementation Plan: Overlay Host

**Branch**: `009-overlay-host` | **Date**: 2026-03-18 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-overlay-host/specs/009-overlay-host/spec.md`
**Input**: Feature specification from `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-overlay-host/specs/009-overlay-host/spec.md` and `/Users/danghamo/Documents/gituhb/magam-feature-dbfcp-overlay-host/docs/features/database-first-canvas-platform/canvas-ui-entrypoints/entrypoint-foundation/overlay-host/README.md`

## Summary

`entrypoint-foundation`의 `overlay-host` 책임을 공통 runtime contract로 고정한다. 핵심은 canvas entrypoint 4개 surface(toolbar, selection floating, pane menu, node menu)가 동일한 host에서 (1) lifecycle(`open/close/replace`), (2) positioning/stacking, (3) dismiss/focus 규칙을 재사용하도록 전환하는 것이다. 기존 `ContextMenu` 구현의 portal/clamp/dismiss/focus 동작을 host primitive로 흡수하고, surface별 action gating 책임은 resolver/routing/state 경계에 남긴다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x  
**Primary Dependencies**: React runtime hooks, existing canvas UI runtime (`app/components/GraphCanvas.tsx`, `app/components/ContextMenu.tsx`, `app/hooks/useContextMenu.ts`)  
**Storage**: N/A (runtime-only UI host state)  
**Testing**: `bun test` with component/hook regression (`app/components/GraphCanvas.test.tsx`, `app/components/editor/WorkspaceClient.test.tsx`, 신규 overlay host 테스트)  
**Target Platform**: Magam web editor canvas runtime  
**Project Type**: feature-oriented modular monolith (app UI runtime slice)  
**Performance Goals**: overlay open/close 및 reposition이 사용자 체감 지연 없이 동작, dismiss/focus 회귀 0건, viewport 경계 침범 0건  
**Constraints**: canvas-level host 범위 유지, global dialog/search/tab menu 경계 유지, action gating 책임 비침범, direct portal/listener 중복 제거 방향 유지  
**Scale/Scope**: `app/components/{GraphCanvas,ContextMenu}.tsx`, `app/hooks/useContextMenu.ts`, 필요 시 `app/components/editor/WorkspaceClient.tsx` 경계 확인, `docs/features/.../overlay-host/README.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: source brief에서 host 범위/비범위, surface 책임 분리, 전역 overlay 경계가 명시되어 있어 구현 해석 모호성이 낮다.
- **II. Structural Simplicity**: 신규 대형 abstraction 대신 host contract + slot contribution 경계만 도입해 중복 동작을 흡수한다.
- **III. Feature-Oriented Modular Monolith**: canvas entrypoint runtime 범위에서만 변경하고 persistence/mutation domain으로 확장하지 않는다.
- **IV. Dependency-Linear Design**: UI surface -> host contract -> runtime state 흐름을 유지하고, host가 resolver/routing/state를 역으로 침범하지 않는다.
- **V. Promptable Modules**: overlay lifecycle, positioning, dismiss/focus를 분리 계약으로 문서화해 병렬 작업 시 문맥 요구량을 줄인다.
- **VI. Surgical Changes**: overlay host 관련 경로만 대상으로 하고 global modal/search/tab menu는 변경하지 않는다.
- **VII. Goal-Driven and Verifiable Execution**: dismiss/focus, boundary clamp, layer order, contract 재사용 여부를 독립 검증 시나리오로 측정한다.

Result: **PASS**

### Post-Phase-1 Re-check

- `research.md`에서 host ownership, slot model, dismiss reason taxonomy, focus restore policy, boundary split을 고정했다.
- `data-model.md`에서 overlay host state와 event model을 명시했고, surface contribution과 lifecycle event 간 관계를 정의했다.
- `contracts/` 문서에서 API, positioning, dismiss/focus, integration boundary를 분리 계약으로 정의했다.
- `quickstart.md`가 구현 순서와 검증 체크포인트를 지정해 tasks 분해 가능 상태다.

Result: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/009-overlay-host/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── overlay-host-contract.md
    ├── overlay-positioning-contract.md
    ├── overlay-dismiss-focus-contract.md
    └── overlay-integration-boundary-contract.md
```

### Source Code (repository root)

```text
app/components/
├── GraphCanvas.tsx
├── ContextMenu.tsx
└── editor/
    └── WorkspaceClient.tsx

app/hooks/
└── useContextMenu.ts

app/types/
└── contextMenu.ts

docs/features/database-first-canvas-platform/canvas-ui-entrypoints/
└── entrypoint-foundation/overlay-host/README.md
```

**Structure Decision**: overlay host의 canonical mount는 `GraphCanvas` 범위에 두고, `ContextMenu`와 `useContextMenu`의 공통 동작을 host primitive/adapter로 재배치한다. `WorkspaceClient`는 전역 overlay 경계 확인 대상으로만 다루고, canvas host의 runtime contract는 `app/components` + `app/hooks` 경계 내에서 유지한다.

## Phase Plan

### Phase 0: Research and Policy Lock

- existing overlay 동작과 host contract 간 대응표 작성
- dismiss reason taxonomy와 focus restore policy 고정
- canvas overlay vs global overlay 책임 경계 고정

### Phase 1: Design Artifacts and Contracts

- host state/event 데이터 모델 고정
- host API, positioning 규칙, dismiss/focus lifecycle, integration boundary 계약 문서화
- quickstart에 체크포인트 및 회귀 시나리오 명시

### Phase 2: Task Planning Readiness

- spec의 FR/SC를 story별 구현 작업으로 매핑
- 기존 context menu 흡수 작업과 신규 host wiring 작업을 분리
- 테스트/검증 작업을 story 독립 실행 단위로 배치

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
