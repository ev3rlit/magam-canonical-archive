# Implementation Plan: Workspace `className` Runtime

**Branch**: `001-workspace-classname-runtime` | **Date**: 2026-03-15 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-workspace-classname-runtime/specs/001-workspace-classname-runtime/spec.md`
**Input**: Feature specification from `/specs/001-workspace-classname-runtime/spec.md` and feature brief `/docs/features/workspace-classname-runtime/README.md`

## Summary

Workspace `className` styling을 앱 전역 스타일 경로와 분리해, 스타일 변경이 편집 세션을 끊지 않고 즉시 반영되도록 한다. v1 지원 전략은 node family 하드코딩이 아니라 class category 우선 모델을 사용하며, eligible object는 기존에 styling/size 관련 props 또는 className surface를 제공하는 오브젝트로 한정한다. safelist 기반 bootstrap 완화책은 runtime styling 도입 중에도 공존하며, 회귀 검증 항목으로 관리한다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18.x, Bun workspace  
**Primary Dependencies**: Next.js app runtime, React Flow, workspace sync pipeline, graph/editor store, runtime class interpreter candidate  
**Storage**: Workspace TSX source + in-memory style interpretation/session cache  
**Testing**: `bun test` 기반 단위/통합 테스트 + dev bootstrap smoke 검증  
**Target Platform**: 브라우저 기반 Magam editor (Next.js app)  
**Project Type**: Monorepo web application (app + libs + scripts)  
**Performance Goals**: 스타일-only 수정 시 맥락 유지, 연속 수정 마지막 입력 우선, category 기반 결과 재현성 95%+  
**Constraints**: class-category 중심 v1 지원, eligible object 규칙 고정, 미지원 입력 진단 필수, safelist/bootstrap 공존 회귀 금지  
**Scale/Scope**: `app/features/workspace-styling/*`, `app/components/GraphCanvas.tsx`, `app/components/editor/WorkspaceClient.tsx`, `app/components/editor/workspaceEditUtils.ts`, `app/components/nodes/*`, `app/store/graph.ts`, `app/tailwind.config.js`, `scripts/dev/app-dev.ts`, `scripts/generate-tailwind-workspace-safelist.mjs`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: 모호했던 지원 기준을 "node family"에서 "eligible object + class category"로 명시적으로 고정했다.
- **II. Structural Simplicity**: 기존 전역 스타일링 체계를 바꾸지 않고 workspace 스타일 해석 경계만 추가한다.
- **III. Feature-Oriented Modular Monolith**: 새 로직은 `app/features/workspace-styling/*`로 집중해 feature 경계를 유지한다.
- **IV. Dependency-Linear Design**: editor/canvas -> workspace-styling facade -> interpreter -> diagnostics/session/store로 단방향 흐름을 유지한다.
- **V. Promptable Modules**: eligibility, class categories, interpretation, diagnostics를 분리해 파일 단위 문맥을 축소한다.
- **VI. Surgical Changes**: 기존 캔버스 렌더/파일 sync 흐름을 유지하면서 스타일 적용 경로만 확장한다.
- **VII. Goal-Driven and Verifiable Execution**: SC-001~SC-009와 FR-019~FR-020(bootstrap 공존)을 테스트 가능한 작업으로 연결한다.

결과: **PASS**

### Post-Phase-1 Re-check

- `research.md`에 class category 우선순위와 safelist 공존 결정이 반영되어야 한다.
- `data-model.md`에 eligible object capability와 class category 매핑 엔티티가 정의되어야 한다.
- `contracts/`에 surface, interpretation, diagnostics, update-flow에서 class category 및 bootstrap 공존 규칙이 명시되어야 한다.
- `quickstart.md`에 size/visual/shadow/outline 검증과 bootstrap 회귀 검증이 포함되어야 한다.

결과: **PASS (planned)**

## Project Structure

### Documentation (this feature)

```text
specs/001-workspace-classname-runtime/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── workspace-style-surface-contract.md
│   ├── workspace-style-interpretation-contract.md
│   ├── workspace-style-diagnostics-contract.md
│   └── workspace-style-update-flow-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── features/
│   └── workspace-styling/
│       ├── index.ts
│       ├── types.ts
│       ├── classCategories.ts
│       ├── eligibility.ts
│       ├── interpreter.ts
│       ├── diagnostics.ts
│       └── sessionState.ts
├── components/
│   ├── GraphCanvas.tsx
│   ├── editor/
│   │   ├── WorkspaceClient.tsx
│   │   └── workspaceEditUtils.ts
│   └── nodes/
│       ├── BaseNode.tsx
│       ├── StickerNode.tsx
│       └── WashiTapeNode.tsx
├── hooks/
│   └── useFileSync.ts
├── store/
│   └── graph.ts
└── tailwind.config.js

scripts/
├── dev/
│   ├── app-dev.ts
│   └── app-dev.test.ts
└── generate-tailwind-workspace-safelist.mjs
```

**Structure Decision**: `app/features/workspace-styling/*`를 runtime styling의 단일 진입 경계로 사용한다. 이 경계는 eligible object 판정과 class category 해석을 책임지며, 캔버스/에디터/store는 결과 소비만 수행한다. bootstrap 공존성은 `scripts/dev/app-dev.ts` + safelist 생성 스크립트 경계에서 별도 회귀 체크로 유지한다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
