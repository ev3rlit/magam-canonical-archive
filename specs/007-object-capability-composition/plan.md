# Implementation Plan: Object Capability Composition

**Branch**: `007-object-capability-composition` | **Date**: 2026-03-16 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-object-capability-model-docs/specs/007-object-capability-composition/spec.md`
**Input**: Feature specification from `/specs/007-object-capability-composition/spec.md` and `/docs/features/object-capability-composition/README.md`

## Summary

내부 object 모델을 `Object Core + capability` 조합으로 정규화하고, 공개 API(`Node`, `Shape`, `Sticky`, `Image`, `Markdown`, `Sequence`, `Sticker`)는 authoring alias layer로 유지한다. 구현 핵심은 (1) 최소 안정 canonical role 집합 도입, (2) alias/legacy props 기반 capability inference와 alias preset default 보강, (3) explicit user capability 우선 규칙 확립, (4) `Sticky` semantic 유지와 `content:*` 계약 위반의 명시적 거부, (5) renderer/editability/patcher를 capability/content-contract 중심으로 전환하는 것이다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x  
**Primary Dependencies**: `@magam/core` component contracts, custom reconciler render graph, `app/features/render/parseRenderGraph.ts`, `app/features/editing/{editability,commands,createDefaults}.ts`, WS patch pipeline (`app/ws/methods.ts`, `app/ws/filePatcher.ts`)  
**Storage**: TSX source files (AST patch 기반) + render graph runtime metadata, 신규 DB 없음  
**Testing**: `bun test` 기반 unit/integration (`app/features/render/parseRenderGraph.test.ts`, `app/features/editing/*`, `app/ws/filePatcher.test.ts`, `app/ws/methods.test.ts`, `app/components/editor/WorkspaceClient.test.tsx`, `app/components/GraphCanvas.test.tsx`, `libs/core/src/__tests__`)  
**Target Platform**: Magam web editor + CLI render server  
**Project Type**: 모노레포 기반 CLI-first TSX canvas application (library + app + cli)  
**Performance Goals**: SC-001~SC-006 달성, tag-name 하드코딩 분기 50% 이상 축소, content-kind mismatch 100% 명시적 진단, legacy alias 문서 99% 호환 유지  
**Constraints**: 공개 API 호환 유지, 전체 포맷 일괄 마이그레이션 금지, arbitrary TSX native 편집 포함 금지, explicit capability가 alias preset보다 우선, `Sticky` alias는 일부 기본 capability 제거 후에도 `sticky-note` semantic 유지, content-kind 불일치는 자동 보정 없이 명시적 오류 처리  
**Scale/Scope**: `libs/core/src/components/{Node,Shape,Sticky,Image,Markdown,Sequence,Sticker}.tsx`, `app/features/render/parseRenderGraph.ts`, `app/features/editing/{editability,commands,createDefaults}.ts`, `app/ws/{methods,filePatcher}.ts`, `app/components/{GraphCanvas.tsx,ContextMenu.tsx,FloatingToolbar.tsx}`, `app/components/editor/{WorkspaceClient.tsx,workspaceEditUtils.ts}`, 관련 테스트 파일

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: clarify를 통해 canonical role granularity, legacy inference, preset precedence, `Sticky` semantic 유지, content-kind mismatch rejection을 사전에 확정했다.
- **II. Structural Simplicity**: 새 base object family를 추가하지 않고 canonical schema, capability registry, inference/validation layer만 도입한다.
- **III. Feature-Oriented Modular Monolith**: 변경 범위를 `libs/core` authoring alias, `app/features/render` normalization, `app/features/editing` gate 계산, `app/ws` patch validation으로 제한한다.
- **IV. Dependency-Linear Design**: alias/legacy input -> canonical normalization -> capability profile -> renderer/editability/patch routing의 단방향 흐름을 유지한다.
- **V. Promptable Modules**: normalization, capability validation, content contract, patch gate를 계약 문서와 대응되는 모듈 경계로 분리한다.
- **VI. Surgical Changes**: public alias 제거, 전체 serializer 재작성, 전면 포맷 migration 없이 정규화 레이어와 rule gate만 확장한다.
- **VII. Goal-Driven Verification**: alias 호환성, legacy inference, sticky semantic 보존, content-kind rejection, capability reuse를 회귀 테스트와 수동 시나리오로 검증한다.

결과: **PASS**

### Post-Phase-1 Re-check

- `research.md`는 clarified spec을 바탕으로 minimal role set, legacy inference, preset precedence, sticky semantic stability, strict content-kind validation을 설계 결정으로 고정했다.
- `data-model.md`는 inference source, precedence order, sticky semantic preservation, validation result 구조를 canonical 데이터 모델에 반영했다.
- `contracts/`는 alias normalization, capability declaration, content boundary, migration compatibility, renderer routing, patch/editability 규칙을 spec과 일치시켰다.
- `quickstart.md`는 구현 순서, 체크포인트, 회귀 시나리오를 clarified policy 기준으로 갱신했다.

결과: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/007-object-capability-composition/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── canonical-object-core-contract.md
    ├── capability-declaration-contract.md
    ├── alias-normalization-contract.md
    ├── content-kind-boundary-contract.md
    ├── renderer-routing-contract.md
    ├── patch-editability-contract.md
    └── migration-compatibility-contract.md
```

### Source Code (repository root)

```text
libs/core/src/components/
├── Node.tsx
├── Shape.tsx
├── Sticky.tsx
├── Image.tsx
├── Markdown.tsx
├── Sequence.tsx
└── Sticker.tsx

app/features/
├── render/
│   └── parseRenderGraph.ts
└── editing/
    ├── commands.ts
    ├── createDefaults.ts
    └── editability.ts

app/ws/
├── methods.ts
└── filePatcher.ts

app/components/
├── GraphCanvas.tsx
├── ContextMenu.tsx
├── FloatingToolbar.tsx
└── editor/
    ├── WorkspaceClient.tsx
    └── workspaceEditUtils.ts
```

**Structure Decision**: canonical normalization 책임은 `app/features/render/parseRenderGraph.ts`에 두고, capability/editability/profile 규칙은 `app/features/editing/`에 모은다. 공개 authoring surface는 `libs/core/src/components/*`에서 유지하고, patch validation과 command 재검증은 `app/ws/*`에서 수행한다. UI entrypoint는 `GraphCanvas`와 `WorkspaceClient`가 담당하되, alias 이름이 아니라 canonical metadata만 소비하도록 점진 전환한다.

## Module Boundary Justification

- `libs/core/src/components/*`
  - 공개 authoring alias와 preset 기본값을 유지한다.
  - canonical schema나 patch policy를 직접 소유하지 않는다.
- `app/features/render/parseRenderGraph.ts`
  - alias input과 legacy props를 canonical object + inferred capabilities로 정규화한다.
  - explicit capability precedence와 `Sticky` semantic 보존 규칙의 단일 진입점이다.
- `app/features/editing/{editability,commands,createDefaults}.ts`
  - capability profile, 허용 update surface, command payload shape를 canonical 기준으로 계산한다.
  - legacy-inferred object와 explicit object의 gate를 동일하게 맞춘다.
- `app/ws/{methods,filePatcher}.ts`
  - client gate를 재검증하고 content-kind mismatch, invalid capability 조합, patch surface 위반을 서버 측에서 명시적으로 거부한다.
- `app/components/{GraphCanvas,editor/*}.tsx`
  - UI는 canonical metadata를 읽어 편집 affordance를 결정한다.
  - alias/tag 이름 직접 분기는 제거 대상으로 관리한다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
