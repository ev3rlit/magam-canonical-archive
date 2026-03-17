---
title: ADR-0006 Shared Canonical Contract Extraction and Dedicated Canonical Drizzle Workflow
date: 2026-03-17
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - storage
  - contracts
  - drizzle
  - dependency-direction
aliases:
  - Canonical Contract Extraction ADR
  - Canonical Drizzle Split ADR
  - shared canonical contract ADR
---

# ADR-0006: Extract Shared Canonical Contract and Split Canonical Drizzle Workflow

## Context

ADR-0005는 Magam이 file-first 편집 경로를 내려놓고 database-first canvas platform으로 전환한다고 결정했다. 그 결정 이후 `001-canonical-object-persistence` slice에서는 첫 canonical persistence 경계를 고정해야 한다.

현재 repository에는 다음 두 가지 구조 문제가 있다.

### 1. canonical contract가 render feature 내부에 머물러 있다

`app/features/render/canonicalObject.ts`에는 다음 계약이 함께 들어 있다.

- canonical semantic role
- content kind
- canonical alias
- capability bag
- normalization source
- validation code 일부

이 파일은 render feature ownership 아래에 있다. 그러나 canonical persistence도 같은 계약을 필요로 한다.

이 상태에서 persistence가 render feature 파일을 직접 import하면 다음 문제가 생긴다.

- shared lower layer가 `app/features/*`에 의존하게 된다.
- dependency direction이 역전된다.
- canonical contract와 render-runtime concern이 섞인다.
- 이후 CLI나 다른 consumer가 같은 계약을 재사용할 때 feature boundary를 가로지르게 된다.

### 2. canonical migration이 기존 chat SQLite workflow와 충돌할 수 있다

repo root `drizzle.config.ts`는 현재 `libs/cli/src/chat/repository/schema.ts`를 가리키며, chat SQLite repository의 generate/migrate 경로를 담당한다.

`001-canonical-object-persistence`는 다음을 새로 요구한다.

- PostgreSQL-compatible canonical schema
- `PGlite` 기반 local embedded bootstrap
- canonical persistence 전용 migration output

이 요구를 root `drizzle.config.ts`에 그대로 덮어쓰면 기존 chat SQLite workflow가 깨질 수 있다.

## Decision Drivers

- shared contract는 가장 낮은 안정 계층에 있어야 한다.
- dependency direction은 one-way로 유지해야 한다.
- canonical persistence는 render feature를 import하지 않아야 한다.
- chat SQLite workflow는 기존 기본 경로로 유지해야 한다.
- canonical persistence migration은 별도 경로로 독립 진화할 수 있어야 한다.
- app runtime, future CLI, persistence layer가 같은 canonical contract를 재사용할 수 있어야 한다.

## Decision

다음을 채택한다.

1. canonical role/content/capability 계약은 `libs/shared/src/lib/canonical-object-contract.ts`로 추출한다.
2. `app/features/render/*`와 `libs/shared/src/lib/canonical-persistence/*`는 모두 이 shared contract만 소비한다.
3. `libs/shared/src/lib/canonical-persistence/*`는 `app/features/*`를 import하지 않는다.
4. root `drizzle.config.ts`는 chat SQLite default workflow로 유지한다.
5. canonical persistence는 `drizzle.canonical.config.ts`와 dedicated generate/migrate commands를 사용한다.
6. dependency direction과 import rule은 architecture test로 검증한다.

## Decision Details

### Contract Ownership

- `libs/shared/src/lib/canonical-object-contract.ts`
  - canonical semantic-role, content-kind, alias, capability, normalization-source 계약을 소유한다.
  - render와 persistence가 공통으로 의존하는 lowest stable layer다.
- `app/features/render/*`
  - render parsing, normalization, runtime behavior를 소유한다.
  - contract는 shared layer에서 소비한다.
- `libs/shared/src/lib/canonical-persistence/*`
  - schema, validators, mappers, repository, bootstrap을 소유한다.
  - contract는 shared layer에서 소비한다.

### Drizzle Workflow Ownership

- `drizzle.config.ts`
  - `libs/cli/src/chat/repository/schema.ts`를 계속 가리킨다.
  - 기존 `db:generate`, `db:migrate` chat SQLite workflow를 유지한다.
- `drizzle.canonical.config.ts`
  - `libs/shared/src/lib/canonical-persistence/schema.ts`를 가리킨다.
  - canonical migration artifact를 `libs/shared/src/lib/canonical-persistence/drizzle/` 아래에 생성한다.
- package scripts
  - canonical persistence는 `db:generate:canonical`, `db:migrate:canonical` 같은 dedicated command를 사용한다.

### Dependency Rule

```text
app/features/render/*
  -> libs/shared/src/lib/canonical-object-contract.ts

libs/shared/src/lib/canonical-persistence/*
  -> libs/shared/src/lib/canonical-object-contract.ts

libs/shared/src/lib/canonical-persistence/*
  -/-> app/features/*
```

이 rule은 review comment에만 의존하지 않고 architecture test로 codify한다.

## Alternatives Considered

### A. persistence가 `app/features/render/canonicalObject.ts`를 직접 import

- 장점: 초기 구현이 가장 빠르다.
- 단점: shared lower layer가 feature layer에 의존한다.
- 단점: render concern과 persistence concern이 contract 수준에서 섞인다.
- 단점: CLI와 future consumer가 render feature boundary를 함께 끌어오게 된다.
- 결론: 비채택

### B. canonical contract를 persistence module 내부에만 둔다

- 장점: persistence slice 내부만 보면 단순해 보인다.
- 단점: render가 같은 계약을 재사용할 수 없다.
- 단점: canonical contract가 persistence implementation detail처럼 굳어 버린다.
- 결론: 비채택

### C. root `drizzle.config.ts`를 canonical schema로 교체한다

- 장점: config 파일 수가 늘지 않는다.
- 단점: chat SQLite workflow를 깨뜨릴 위험이 높다.
- 단점: 서로 다른 storage intent를 한 config에서 혼합하게 된다.
- 결론: 비채택

### D. shared canonical contract extraction + dedicated canonical Drizzle workflow split (채택)

- 장점: dependency direction이 명확해진다.
- 장점: shared contract reuse와 boundary clarity를 동시에 얻는다.
- 장점: canonical migration이 chat workflow와 독립적으로 진화할 수 있다.
- 단점: shared contract file과 Drizzle config가 하나씩 추가된다.
- 결론: 최종 채택

## Consequences

### Positive

- render와 persistence가 같은 canonical contract를 공유하되 서로 직접 결합하지 않는다.
- future CLI consumer도 같은 contract를 재사용할 수 있다.
- canonical persistence migration은 chat SQLite 경로와 독립적으로 관리된다.
- architecture test로 dependency rule을 반복 가능하게 검증할 수 있다.

### Negative

- contract extraction 과정에서 render regression 위험이 생긴다.
- Drizzle config와 script가 이원화되어 운영 문서를 함께 관리해야 한다.
- shared contract가 너무 커지면 render/persistence 외 concern까지 끌어안을 위험이 있다.

## Follow-up

1. `001-canonical-object-persistence` plan과 tasks는 이 ADR을 참조해야 한다.
2. render regression test를 추가해 contract extraction이 기존 render behavior를 깨뜨리지 않는지 검증한다.
3. architecture test를 추가해 canonical persistence가 `app/features/*`를 import하지 않음을 검증한다.
4. quickstart와 feature README는 dedicated canonical migration command를 반영해야 한다.

## Related Decisions

- ADR-0005: database-first canvas platform의 상위 방향을 정의한다.
