# Implementation Plan: Canonical Object Persistence

**Branch**: `001-canonical-object-persistence` | **Date**: 2026-03-17 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-database-first-canvas-platform/specs/001-canonical-object-persistence/spec.md`
**Input**: Feature artifacts from `/Users/danghamo/Documents/gituhb/magam-feature-database-first-canvas-platform/specs/001-canonical-object-persistence/` (`spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`)

## Summary

이 feature는 native object를 workspace-scoped canonical persistence로 통합하고, canvas placement와 canonical 의미 데이터를 분리한다. 이번 refresh의 핵심은 editable note-like object(`Node`, `Sticky`)에 대해 ordered extensible `contentBlocks`/`content_blocks`를 canonical note body truth로 고정하고, create/duplicate/import에서 항상 clone-on-create를 적용하며, shared editable-note template/library는 backlog로 명시적으로 제외하는 것이다. `primaryContentKind`와 `canonicalText`는 direct content 또는 `contentBlocks` projection 규칙으로 계산되어 저장 계약의 중심 불변식이 된다.

## Active Requirement Focus

- Editable note-like object는 create/duplicate/import 시 항상 새 canonical object로 clone되어야 한다.
- Shared editable-note template/library는 이번 slice 범위 밖이며 backlog 항목으로만 유지한다.
- Note body canonical model은 ordered extensible `contentBlocks`/`content_blocks`다.
- v1 core block은 `text`, `markdown`이고, namespaced custom block(`plugin.*`, `core.*` 등)은 structured payload로 허용한다.
- `primaryContentKind`와 `canonicalText`는 direct `capabilities.content` 또는 `contentBlocks`에서 projection되어야 하며 충돌 입력은 reject한다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, Bun 1.x  
**Primary Dependencies**: `drizzle-orm`, `drizzle-kit`, `@electric-sql/pglite` (local embedded), `zod`  
**Storage**: PostgreSQL-compatible relational schema (local embedded `PGlite`, production PostgreSQL/pgvector-compatible profile)  
**Testing**: `bun test` 기반 unit/integration + migration smoke + boundary/round-trip tests  
**Target Platform**: Magam web editor runtime and future headless CLI consumer (공유 persistence contract 재사용)  
**Project Type**: feature-oriented modular monolith (shared libs + app surfaces)  
**Performance Goals**: migration success 100%, canonical persistence round-trip 100%, ownership overlap 0건, note clone-on-create 위반 0건  
**Constraints**: alias-specific table 금지, workspace-scoped canonical identity, native node canonical ref 필수, tombstone placeholder 유지, dangling relation 금지, note shared-template in-scope 금지  
**Scale/Scope**: `libs/shared/src/lib/canonical-persistence/`를 중심으로 schema/validator/mapper/repository/pglite bootstrap 제공

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: 핵심 모호성(workspace uniqueness, clone semantics, projection 규칙, tombstone, relation integrity)이 spec clarifications로 해소됨.
- **II. Structural Simplicity**: alias family 분기 대신 canonical 단일 shape를 유지하고, note body도 동일 canonical contract 안에서 확장 가능 블록으로 유지.
- **III. Feature-Oriented Modular Monolith**: persistence contract는 shared 모듈 소유, app/editor는 소비자 역할로 제한.
- **IV. Dependency-Linear Design**: canonical contract -> persistence module -> app/CLI consumer의 단방향 의존을 유지.
- **V. Promptable Modules**: schema/validator/mapper/repository/bootstrap/test 경계를 분리해 slice 단위 작업이 가능함.
- **VI. Surgical Changes**: 기존 canonical path와 app runtime 경계는 유지하고 canonical persistence 전용 shared path만 분리 추가함.
- **VII. Goal-Driven Verification**: projection, clone-on-create, boundary, tombstone, migration, relation integrity를 각각 검증 가능한 체크포인트로 정의함.

Result: **PASS**

### Post-Phase-1 Re-check

- `research.md`의 결정들이 모두 spec active requirements(특히 note-body/clone/projection)에 정합적이다.
- `data-model.md`와 `contracts/`가 `content_blocks`, clone-on-create, custom block namespace, projection 규칙을 명시한다.
- `quickstart.md` 검증 시나리오가 alias canonicalization, note block round-trip, clone enforcement를 포함한다.
- unresolved clarification 또는 constitution violation 없음.

Result: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/001-canonical-object-persistence/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── canonical-object-persistence-contract.md
    ├── canonical-canvas-boundary-contract.md
    └── persistence-migration-contract.md
```

### Source Code (repository root)

```text
drizzle.config.ts

# dedicated canonical workflow
drizzle.canonical.config.ts

libs/shared/src/lib/canonical-object-contract.ts

libs/shared/src/lib/canonical-persistence/
├── index.ts
├── records.ts
├── schema.ts
├── validators.ts
├── mappers.ts
├── repository.ts
├── pglite-db.ts
├── architecture.spec.ts
├── validators.spec.ts
├── repository.spec.ts
├── boundary.spec.ts
├── migration.spec.ts
├── pglite-db.spec.ts
└── drizzle/

app/features/render/
└── canonicalObject.ts  # shared canonical contract consumer/re-export 경계
```

**Structure Decision**: canonical role/content/capability 계약은 `libs/shared/src/lib/canonical-object-contract.ts`로 추출하고, persistence-specific 구현은 `libs/shared/src/lib/canonical-persistence/`가 소유한다. canvas/app 계층은 canonical truth를 저장하지 않으며, note-body canonical truth(`contentBlocks`)는 persistence contract의 일부로 고정한다.

## Migration Command Strategy

- `drizzle.canonical.config.ts`
  - canonical persistence schema 전용 migration artifact를 생성한다.
  - output: `libs/shared/src/lib/canonical-persistence/drizzle/`
- canonical migration 검증은 clean DB 기준 smoke 테스트로 고정한다.

## Phase Plan

### Phase 0: Research Confirmation

- `research.md` 결정사항과 spec active requirements의 정합성 재확인
- note-body model 및 clone-vs-share 범위(out-of-scope 포함) 잠금

### Phase 1: Design Artifact Lock

- `data-model.md`의 entity/invariant를 schema/validator/mappers로 매핑
- `contracts/`를 repository failure contract 및 boundary test 기준으로 연결
- `quickstart.md` 검증 시나리오를 task acceptance 기준으로 사용

### Phase 2: Execution Planning (for tasks.md)

- US1: alias-independent canonical shape + projection invariants
- US2: canonical/canvas ownership boundary + tombstone placeholder
- US3: ordered extensible note blocks + clone-on-create(create/duplicate/import)
- US4: migration/contract readiness and next-slice handoff

## Acceptance Mapping

- `SC-001`, `FR-001`, `FR-002`, `FR-006`: `libs/shared/src/lib/canonical-object-contract.ts`, `libs/shared/src/lib/canonical-persistence/{records,mappers,validators,repository}.ts`, `libs/shared/src/lib/canonical-persistence/{validators,repository}.spec.ts`
- `SC-003`, `FR-011`, `FR-014`, `FR-015`: `drizzle.canonical.config.ts`, `libs/shared/src/lib/canonical-persistence/schema.ts`, `libs/shared/src/lib/canonical-persistence/drizzle/0000_aspiring_malcolm_colcord.sql`, `libs/shared/src/lib/canonical-persistence/migration.spec.ts`
- `SC-004`, `FR-003`, `FR-004`, `FR-005`, `FR-016`: `libs/shared/src/lib/canonical-persistence/{mappers,validators,repository}.ts`, `libs/shared/src/lib/canonical-persistence/repository.spec.ts`
- `SC-005`, `FR-021` ~ `FR-028`: `libs/shared/src/lib/canonical-object-contract.ts`, `libs/shared/src/lib/canonical-persistence/{schema,validators,repository}.ts`, `libs/shared/src/lib/canonical-persistence/{validators,repository}.spec.ts`
- `SC-006`, `FR-022`, `FR-025`: `libs/shared/src/lib/canonical-persistence/repository.ts`, `libs/shared/src/lib/canonical-persistence/repository.spec.ts`

## Execution Notes

- 구현 결과로 shared canonical contract는 `app/features/render/canonicalObject.ts`에서 재사용/re-export되며 persistence 계층 역의존은 없다.
- 검증 명령 `bun test app/features/render/canonicalObject.test.ts`, `bun test libs/shared/src/lib/canonical-persistence`, `bun run db:generate:canonical`, `bun run db:migrate:canonical` 모두 성공했다.
- 남은 명시적 open item은 binding placeholder diagnostics를 repository surface로 더 드러내는 후속 작업(T022)이다.

## Out-of-Scope Enforcement

- shared editable-note template/library 구현은 금지한다.
- custom block runtime rendering/UX 확장 구현은 다음 slice로 미룬다.
- mutation/query core 구현은 이번 slice에 포함하지 않는다.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
