# Implementation Plan: Canonical Mutation Query Core

**Branch**: `008-canonical-mutation-query-core` | **Date**: 2026-03-17 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-canonical-mutation-query-core/specs/008-canonical-mutation-query-core/spec.md`
**Input**: Feature specification from `/specs/008-canonical-mutation-query-core/spec.md` and source brief `/docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`

## Summary

이 feature는 `canonical-object-persistence` 위에서 transport-neutral query/mutation core를 고정해 현재 UI 경로와 다음 slice의 AI CLI 경로가 같은 domain contract를 공유하게 만드는 것이 목적이다. 설계 핵심은 (1) intent 중심 mutation envelope와 partial query envelope를 shared contract로 분리하고, (2) validation/revision/changed-set을 공통 결과 모델로 통일하며, (3) 기존 WS AST patch 경로를 직접 쓰는 흐름을 첫 adapter로 전환해 다음 slice의 headless CLI가 같은 domain contract를 재사용하도록 만드는 것이다. 이 staged transport 해석은 `docs/adr/ADR-0007-canonical-mutation-query-core-transport-staging.md`를 따른다.

## Active Requirement Focus

- canonical filter(`semanticRole`, `primaryContentKind`, `hasCapability`, `alias`)와 partial read(`include`, `limit`, `cursor`, `bounds`)를 domain query 계약으로 고정한다.
- object/canvas mutation, note body block mutation, relation mutation을 intent 중심 envelope로 통합한다.
- validation failure는 명시적 오류 코드와 경로를 포함한 구조화된 envelope로 고정한다.
- revision append + optimistic concurrency + changed-set 결과를 mutation 표준 응답으로 고정한다.
- 현재 slice의 in-repo adapter는 WS/editor 경로로 제한하고, headless CLI transport 구현은 다음 slice consumer로 남긴다.
- shell-facing CLI UX나 app-attached session bridge는 구현 범위에서 제외한다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, Bun 1.x  
**Primary Dependencies**: `libs/shared/src/lib/canonical-object-contract.ts`, `libs/shared/src/lib/canonical-persistence/*`, `docs/adr/ADR-0007-canonical-mutation-query-core-transport-staging.md`, WS RPC adapter (`app/ws/methods.ts`, `app/ws/rpc.ts`), editor command surfaces (`app/features/editing/*`, `app/hooks/useFileSync*`)  
**Storage**: PostgreSQL-compatible canonical persistence (`Drizzle ORM` + `PGlite` local profile) reused from previous slice  
**Testing**: `bun test` 기반 unit/integration (`libs/shared/src/lib/canonical-persistence/*.spec.ts`, 신규 `libs/shared/src/lib/canonical-mutation-query/*.spec.ts`, `app/ws/methods.test.ts`, `app/hooks/useFileSync.test.ts`)  
**Target Platform**: Magam web editor runtime + upcoming headless CLI transport  
**Project Type**: feature-oriented modular monolith (shared library + app adapter + ws transport)  
**Performance Goals**: mutation replay 결정성 100%, content-kind mismatch silent-success 0건, partial query overfetch 0건, concurrency conflict explicit return 100%  
**Constraints**: AST patch 경로 직접 호출 제거 방향 유지, validation 실패 무시 금지, transport별 별도 domain rule 금지, 기존 `commandId`/응답 envelope 호환성 유지, 비범위(slice) 기능 확장 금지  
**Scale/Scope**: `libs/shared/src/lib/canonical-mutation-query/` 신설, `libs/shared/src/lib/canonical-persistence/repository.ts` 확장, `app/ws/methods.ts` adapter 전환, `app/hooks/useFileSync{.ts,.shared.ts}` concurrency token 전환

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: source README와 spec에서 범위/비범위를 먼저 고정했고, ambiguity는 spec assumptions로 명시했다.
- **II. Structural Simplicity**: 새로운 persistence fork를 만들지 않고 기존 canonical persistence 위에 service 계층만 추가한다.
- **III. Feature-Oriented Modular Monolith**: domain contract는 shared 라이브러리에 두고 WS/UI는 adapter 역할로 제한한다.
- **IV. Dependency-Linear Design**: contract -> executor/query service -> transport adapter 방향으로 의존을 선형화한다.
- **V. Promptable Modules**: query, mutation, validator, concurrency, adapter를 분리해 최소 컨텍스트 수정이 가능하게 유지한다.
- **VI. Surgical Changes**: 기존 렌더/편집 기능 전면 재작성 없이 mutation/query core 진입점만 교체한다.
- **VII. Goal-Driven and Verifiable Execution**: 각 user story에 독립 검증 기준과 정량 success criteria를 정의했다.

Result: **PASS**

### Post-Phase-1 Re-check

- `research.md`는 transport-neutral contract, concurrency, validation, migration 전략을 결정했고 unresolved clarification이 없다.
- `data-model.md`는 query/mutation envelope, revision token, validation failure, changed-set을 명시했다.
- `contracts/`는 query/mutation/revision 계약을 분리해 next slice handoff 가능 상태로 고정했다.
- `quickstart.md`는 실행 순서와 게이트를 user story 단위로 검증 가능하게 정의했다.

Result: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/008-canonical-mutation-query-core/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── canonical-query-envelope-contract.md
│   ├── canonical-mutation-envelope-contract.md
│   └── revision-concurrency-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
libs/shared/src/lib/
├── canonical-object-contract.ts
├── canonical-persistence/
│   ├── records.ts
│   ├── repository.ts
│   └── validators.ts
└── canonical-mutation-query/
    ├── contracts.ts
    ├── errors.ts
    ├── query-service.ts
    ├── mutation-executor.ts
    ├── validators.ts
    ├── index.ts
    └── *.spec.ts

app/ws/
├── rpc.ts
├── methods.ts
└── methods.test.ts

app/features/
├── editing/
│   ├── commands.ts
│   └── editability.ts
└── render/
    └── parseRenderGraph.ts

app/hooks/
├── useFileSync.shared.ts
├── useFileSync.ts
└── useFileSync.test.ts
```

**Structure Decision**: canonical query/mutation contract와 executor는 `libs/shared/src/lib/canonical-mutation-query/`에 모아 transport-neutral core로 유지한다. `app/ws/*`는 현재 slice의 첫 transport adapter로만 동작하게 하고, editor-side command/build queue(`app/features/editing/*`, `app/hooks/useFileSync*`)는 domain envelope 소비자 역할로 제한한다. headless CLI는 다음 slice consumer로 남기며, canonical storage truth는 계속 `libs/shared/src/lib/canonical-persistence/`가 소유한다.

## Phase Plan

### Phase 0: Research Lock

- typed query/mutation envelope의 최소 계약을 고정한다.
- optimistic concurrency, revision append, changed-set 반환 규칙을 고정한다.
- validation code 재사용/확장 원칙을 고정한다.

### Phase 1: Design Artifacts

- `data-model.md`에서 query/mutation/revision/result 엔티티와 invariant를 정의한다.
- `contracts/`에서 query/mutation/revision 계약을 분리해 transport adapter와 독립시킨다.
- `quickstart.md`에서 단계별 구현/검증 경로를 고정한다.

### Phase 2: Execution Planning Input (for tasks)

- US1: shared canonical mutation surface + validation gate
- US2: partial query + document/surface load read model
- US3: note body block mutation + clone safety
- US4: transport-neutral handoff + concurrency envelope

## Acceptance Mapping

- `FR-001` ~ `FR-008`: `libs/shared/src/lib/canonical-mutation-query/{contracts,query-service,mutation-executor}.ts`, `libs/shared/src/lib/canonical-persistence/repository.ts`
- `FR-009` ~ `FR-015`: `libs/shared/src/lib/canonical-mutation-query/{validators,errors}.ts`, `libs/shared/src/lib/canonical-object-contract.ts`, `app/ws/methods.ts`
- `FR-016` ~ `FR-018`: `libs/shared/src/lib/canonical-mutation-query/mutation-executor.ts`, `libs/shared/src/lib/canonical-persistence/repository.ts`
- `FR-019` ~ `FR-021`: `libs/shared/src/lib/canonical-mutation-query/validators.ts`, `libs/shared/src/lib/canonical-mutation-query/mutation-executor.ts`, `app/ws/methods.ts`
- `FR-022` ~ `FR-023`: `libs/shared/src/lib/canonical-mutation-query/contracts.ts`, `app/ws/methods.ts`, CLI-ready handoff contract for next-slice consumer
- `FR-024` ~ `FR-026`: scope gate in `specs/008-canonical-mutation-query-core/spec.md` and `specs/008-canonical-mutation-query-core/tasks.md`

## Execution Notes

- 기존 `app/ws/filePatcher.ts` 경로는 이 slice에서 직접 실행 경로가 아니라 호환 adapter 대상으로 유지하되, 신규 domain executor가 우선 경로가 된다.
- UI retry queue semantics는 유지하고, concurrency key는 file hash 중심에서 revision token 중심으로 이동한다.
- ADR-0007 기준으로 WS는 현재 slice의 검증 adapter이고, headless CLI transport는 다음 slice에서 같은 contract를 소비한다.
- analyze 단계에서 spec/plan/tasks coverage를 확인한 뒤 구현으로 handoff 한다.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
