# Quickstart: Canonical Mutation Query Core

## 목적

`008-canonical-mutation-query-core` 구현에 들어가기 전에 query/mutation contract, concurrency, adapter 전환 경계를 빠르게 고정하기 위한 실행 가이드.

## 작업 문서 링크

- 스펙: `specs/008-canonical-mutation-query-core/spec.md`
- 플랜: `specs/008-canonical-mutation-query-core/plan.md`
- 리서치: `specs/008-canonical-mutation-query-core/research.md`
- 데이터 모델: `specs/008-canonical-mutation-query-core/data-model.md`
- 계약:
  - `specs/008-canonical-mutation-query-core/contracts/canonical-query-envelope-contract.md`
  - `specs/008-canonical-mutation-query-core/contracts/canonical-mutation-envelope-contract.md`
  - `specs/008-canonical-mutation-query-core/contracts/revision-concurrency-contract.md`

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-feature-canonical-mutation-query-core
bun install
```

## 2) 구현 순서

1. shared query/mutation contract 모듈 신설
   - `libs/shared/src/lib/canonical-mutation-query/`
2. query service와 mutation executor 도입
   - `query-service.ts`
   - `mutation-executor.ts`
   - `validators.ts`
   - `errors.ts`
3. canonical persistence repository extension
   - `libs/shared/src/lib/canonical-persistence/repository.ts`
4. WS transport adapter 전환
   - `app/ws/methods.ts`
   - `app/ws/rpc.ts`
5. UI mutation queue/concurrency token 경계 정리
   - `app/hooks/useFileSync.shared.ts`
   - `app/hooks/useFileSync.ts`

## 3) 구현 체크포인트

- Checkpoint A: query filter/include/pagination/bounds contract가 transport-neutral하게 고정된다.
- Checkpoint B: object/canvas/body/relation mutation이 intent-based operation으로 고정된다.
- Checkpoint C: validation failure가 명시적 오류 envelope로만 반환된다.
- Checkpoint D: revision conflict가 `VERSION_CONFLICT`로 명시되고 silent overwrite가 없다.
- Checkpoint E: mutation success 응답이 `changedSet`과 `revision.after`를 항상 포함한다.
- Checkpoint F: `content.kind` 불일치 patch가 100% 명시적으로 reject된다.
- Checkpoint G: `Node`/`Sticky` body block mutation이 stable block id 기준으로 동작한다.
- Checkpoint H: UI/AI가 동일 executor를 공유하고 transport별 domain drift가 없다.

## 4) 실행/검증

```bash
# shared canonical persistence regression
bun test libs/shared/src/lib/canonical-persistence

# shared canonical mutation/query core
bun test libs/shared/src/lib/canonical-mutation-query

# WS adapter and mutation queue regression
bun test app/ws/methods.test.ts
bun test app/hooks/useFileSync.test.ts
```

## 5) 수동 검증 시나리오

1. 동일 object mutation intent를 UI path와 AI path로 실행해 결과 envelope가 같은지 확인한다.
2. `semanticRole`/`hasCapability`/`include`/`cursor` 조합 query가 overfetch 없이 subset만 반환하는지 확인한다.
3. `object.body.block.insert/update/remove/reorder`를 순차 실행해 order와 projection이 유지되는지 확인한다.
4. `content.kind`와 충돌하는 patch 요청이 조용히 성공하지 않고 명시적으로 실패하는지 확인한다.
5. stale `baseRevision` 요청에서 `VERSION_CONFLICT`와 expected/actual detail이 반환되는지 확인한다.
6. missing `baseRevision` 요청이 conflict가 아니라 `VERSION_BASE_REQUIRED` validation failure로 반환되는지 확인한다.
7. 지원되지 않는 `include` 필드가 부분 성공 없이 `INVALID_QUERY_INCLUDE`로 거부되는지 확인한다.

## 6) 정량 검증 기준

- SC-001: UI/AI 동일 intent regression의 100%에서 결과 envelope 일치
- SC-002: 동일 replay scenario의 100%에서 결과 state/changed-set 결정성 확보
- SC-003: partial query regression의 100%에서 include/filter/pagination 조건 만족
- SC-004: content-kind mismatch scenario의 100% 명시적 실패 + silent-success 0건
- SC-005: note body block mutation scenario의 100% canonical mutation 경로로 성공
- SC-006: clone-on-create violation scenario의 canonical id 재사용 0건
- SC-007: concurrency conflict scenario의 100% 명시적 conflict 응답
- SC-008: next-slice handoff에서 required JSON envelope 누락 0건

## 6) 범위 가드

- shell-facing CLI UX는 이번 slice에서 구현하지 않는다.
- app-attached session bridge는 이번 slice에서 구현하지 않는다.
- plugin runtime execution은 이번 slice에서 구현하지 않는다.
- 고급 export/import는 이번 slice에서 구현하지 않는다.

## 7) 실행 노트

- 이번 slice는 domain contract와 executor를 고정하는 단계다. CLI UX, app-attached session bridge, plugin runtime은 범위 밖이다.
- 기존 AST patch 경로는 완전 삭제보다 adapter 전환을 우선해 회귀 위험을 제어한다.
- 다음 slice(`ai-cli-headless-surface`)는 이 계약을 transport wrapper로 직접 소비한다.
