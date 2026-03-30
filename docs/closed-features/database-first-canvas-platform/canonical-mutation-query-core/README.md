# Canonical Mutation Query Core

## 개요

이 slice는 `canonical-object-persistence` 위에 query/mutation service를 올리는 단계다.

목표는 UI와 AI가 같은 canonical object 및 canvas mutation surface를 공유하게 만드는 것이다.

## 왜 두 번째인가

- persistence shape가 잠기기 전에는 mutation contract가 쉽게 흔들린다.
- canonical object patch gate와 content/capability validation을 server-side contract로 먼저 고정해야 CLI와 UI가 같은 executor를 쓸 수 있다.

## 범위

- typed mutation envelope
- canonical object query
- canonical object create/update-core/update-content/patch-capability
- extensible note body `contentBlocks` replace/insert/update/remove/reorder
- object relation mutation
- canvas node move/reparent/create/remove
- document/surface load query
- validation error contract
- revision append 및 optimistic concurrency 전제

## 비범위

- shell-facing CLI UX
- app-attached selection/session
- plugin runtime 실행
- 고급 export/import

## 핵심 계약

### Query

- canonical filter 우선
  - `semanticRole`
  - `primaryContentKind`
  - `hasCapability`
  - `alias`
- partial read 우선
  - `include`
  - `limit`
  - `cursor`
  - `bounds`

### Mutation

- `object.update-core`
- `object.update-content`
- `object.body.replace`
- `object.body.block.insert`
- `object.body.block.update`
- `object.body.block.remove`
- `object.body.block.reorder`
- `object.patch-capability`
- `canvas-node.move`
- `canvas-node.reparent`

### Validation

- capability allow-list 검증
- content-kind boundary 검증
- content block shape/order 검증
- custom block namespace/payload 검증
- editable note clone-vs-share 검증
- patch surface gate 검증
- 대표 오류
  - `INVALID_CAPABILITY`
  - `INVALID_CAPABILITY_PAYLOAD`
  - `CONTENT_CONTRACT_VIOLATION`
  - `INVALID_CONTENT_BLOCK`
  - `CONTENT_BODY_CONFLICT`
  - `EDITABLE_OBJECT_REQUIRES_CLONE`
  - `PATCH_SURFACE_VIOLATION`

## 선행조건

- `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`

## 다음 slice에 넘겨야 할 것

- headless CLI가 바로 노출할 query/mutation service contract
- structured JSON response shape
- revision/changed-set result contract

## 완료 기준

- 동일 mutation replay가 결정적 결과를 만든다.
- `content.kind`와 맞지 않는 patch field는 명시적으로 reject된다.
- `Node`/`Sticky`의 text/markdown block body create/update/reorder가 canonical mutation만으로 표현된다.
- style/content patch가 capability profile 허용 surface를 벗어나면 reject된다.
- UI와 AI가 같은 mutation executor를 재사용할 수 있다.
