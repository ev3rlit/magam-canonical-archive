# Quickstart: Canonical Object Persistence

## 목적

`001-canonical-object-persistence` 구현 시작 전에 persistence contract, migration baseline, ownership boundary를 빠르게 확인하기 위한 최소 실행 절차.

## 작업 문서 링크

- 스펙: `specs/001-canonical-object-persistence/spec.md`
- 플랜: `specs/001-canonical-object-persistence/plan.md`
- 리서치: `specs/001-canonical-object-persistence/research.md`
- 데이터 모델: `specs/001-canonical-object-persistence/data-model.md`
- 계약:
  - `specs/001-canonical-object-persistence/contracts/canonical-object-persistence-contract.md`
  - `specs/001-canonical-object-persistence/contracts/canonical-canvas-boundary-contract.md`
  - `specs/001-canonical-object-persistence/contracts/persistence-migration-contract.md`

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-feature-database-first-canvas-platform
bun install
```

## 2) 구현 순서

1. shared canonical persistence module 추가
   - `libs/shared/src/lib/canonical-persistence/`
2. canonical object schema/record/validator 정의
   - `schema.ts`
   - `records.ts`
   - `validators.ts`
   - `content_blocks` extensible note-body shape 포함
3. mapper / repository contract 정의
   - `mappers.ts`
   - `repository.ts`
   - editable note clone-on-create 규칙 포함
4. local embedded bootstrap 추가
   - `pglite-db.ts`
5. drizzle config와 migration output 연결
   - `drizzle.canonical.config.ts`
   - `libs/shared/src/lib/canonical-persistence/drizzle/`
6. migration + round-trip + boundary smoke 테스트 추가
   - `pglite-db.spec.ts`
   - contract/repository smoke tests

## 3) 구현 체크포인트

- Checkpoint A: canonical object row shape가 workspace-scoped uniqueness를 가진다.
- Checkpoint B: native node는 항상 canonical object를 참조한다.
- Checkpoint C: canvas props는 canonical semantic/content payload를 중복 저장하지 않는다.
- Checkpoint D: `Node`/`Sticky` note body는 ordered `content_blocks`로 저장되고 empty text block seed가 보장되며 custom block 확장 경계를 가진다.
- Checkpoint E: editable note-like object는 cross-document create/duplicate 시 clone-on-create가 기본이다.
- Checkpoint F: relation writes는 missing endpoint를 허용하지 않는다.
- Checkpoint G: canonical delete는 tombstone/placeholder resolution 경로를 유지한다.
- Checkpoint H: local `PGlite` bootstrap과 migration이 같은 logical schema contract로 동작한다.

## 4) 실행/검증

```bash
# drizzle schema/migration artifacts
bun run db:generate:canonical
bun run db:migrate:canonical

# targeted persistence tests
bun test app/features/render/canonicalObject.test.ts
bun test libs/shared/src/lib/canonical-persistence
```

## 5) 수동 검증 시나리오

1. `Sticky`, `Image`, `Markdown`, `Sequence` canonical object 샘플을 같은 canonical row shape로 저장한다.
2. legacy `Node`/`Sticky` multi-block body와 custom block fixture가 `content_blocks`와 `canonical_text`로 손실 없이 round-trip 되는지 확인한다.
3. non-note canonical object를 서로 다른 document에서 재사용해도 object row가 중복 생성되지 않는지 확인한다.
4. editable note-like object를 다른 document에 복제할 때 새 canonical object id가 생성되는지 확인한다.
5. native node 저장 시 `canonicalObjectId` 누락이 명시적으로 거부되는지 확인한다.
6. invalid capability key, content-kind mismatch, invalid note body block shape, 또는 invalid custom block namespace가 저장 단계에서 구조화된 오류로 거부되는지 확인한다.
7. canonical object를 tombstone 처리했을 때 canvas reference가 placeholder 경로로 계속 조회되는지 확인한다.
8. relation endpoint가 없는 relation write가 거부되는지 확인한다.

## 6) 정량 검증 기준

- SC-001: alias 계열 입력 100%가 canonical row shape로 기록된다.
- SC-002: canonical/canvas 의미 데이터 중복 저장 사례 0건.
- SC-003: clean database migration 성공률 100%.
- SC-004: canonical persistence round-trip 일치율 100%.
- SC-005: `Node`/`Sticky` multi-block note body round-trip 일치율 100%.
- SC-006: editable note-like object의 기본 shared id 재사용 사례 0건.

## 7) 실행 노트

- 현재 repo에는 `libs/cli/src/chat/repository`에 SQLite + Drizzle 선례가 있다. 이번 slice는 그 모듈을 재사용하지 않고, canonical persistence 전용 shared module을 새로 둔다.
- local embedded path는 `PGlite`, production path는 PostgreSQL/pgvector 호환 경로를 전제로 한다.
- headless CLI, app-attached session, plugin runtime은 다음 slice에서 소비자 입장으로 붙는다.

## 8) 실행 기록 (2026-03-17)

- `bun test app/features/render/canonicalObject.test.ts` → `4 pass`, `0 fail`
- `bun test libs/shared/src/lib/canonical-persistence` → `20 pass`, `0 fail`
- `bun run db:generate:canonical` → 초기 실행에서 `libs/shared/src/lib/canonical-persistence/drizzle/0000_aspiring_malcolm_colcord.sql` 생성, 최신 재실행에서는 `No schema changes, nothing to migrate`
- `bun run db:migrate:canonical` → `.magam/canonical-pgdata` 경로에 canonical PGlite migration 적용
