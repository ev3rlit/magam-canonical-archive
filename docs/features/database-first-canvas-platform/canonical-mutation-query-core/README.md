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

## 구현 계획

현재 코드베이스 기준 구현 방향은 `libs/shared/src/lib/canonical-persistence/` 위에 transport-neutral query/mutation service를 추가하고, 기존 `app/features/editing/*`, `app/ws/*`는 이 서비스를 호출하는 adapter로 얇게 재구성하는 것이다. 즉 이 slice의 핵심은 또 하나의 UI command layer를 만드는 것이 아니라, AST patch 경로(`app/ws/filePatcher.ts`)를 canonical executor 뒤로 밀어내고 최종적으로 제거 가능한 상태로 만드는 데 있다.

### 1. Shared contract 분리

- `canonical-object-contract`는 object shape에 계속 집중시키고, query/mutation envelope는 신규 shared module(`libs/shared/src/lib/canonical-mutation-query/` 권장)로 분리한다.
- mutation input은 `object.update-core`, `object.update-content`, `object.body.*`, `object.patch-capability`, `object.relation.*`, `canvas-node.*` intent를 기준으로 정규화한다.
- query result는 `objects`, `relations`, `canvasNodes`, `bindings`, `documentRevision`을 부분 포함할 수 있는 `include` 기반 shape로 고정한다.
- error/result는 validation code + path + changed-set + revision token을 포함하는 transport-neutral envelope로 통일한다.

### 2. Persistence repository 확장

- `CanonicalPersistenceRepository`에 workspace filter query, document/surface load, canvas node update/remove/reparent, relation upsert/remove, revision next-number 확보 같은 메서드를 추가한다.
- `object_relations`, `canvas_nodes`, `document_revisions`를 한 mutation batch 안에서 묶을 수 있도록 transaction boundary를 repository 또는 service layer에 둔다.
- editable note-like object clone 기본값은 기존 `cloneEditableNote`를 그대로 재사용한다.

### 3. Query service 구현

- query service는 `semanticRole`, `primaryContentKind`, `hasCapability`, `alias` 필터를 우선 지원한다.
- partial read는 `include`, `limit`, `cursor`, `bounds`를 받아 canonical object 목록 조회와 `document/surface load`를 분리 구현한다.
- `document/surface load`는 `canvas_nodes` placement와 `objects` canonical payload를 join해 UI/CLI가 같은 read model을 소비하게 만든다.
- `app/features/render/parseRenderGraph.ts`는 최종적으로 TSX parse 결과가 아니라 query service가 반환한 canonical read model을 입력으로 받는다.

### 4. Mutation executor 구현

- mutation executor는 object/canvas mutation을 validation -> repository write -> revision append 순서로 처리한다.
- `app/features/editing/commands.ts`의 기존 UI command는 executor input으로 매핑하고, `app/features/editing/editability.ts`의 client gate와 같은 규칙을 server-side validator에서도 강제한다.
- note body block mutation은 replace/insert/update/remove/reorder를 stable block id 기준으로 처리하고 `canonicalText`, `primaryContentKind` projection을 매 write 때 재계산한다.
- canvas node move/reparent/create/remove는 canonical object write와 분리하되 한 batch result 안에서 changed-set을 함께 반환한다.

### 5. Transport 전환과 검증

- `app/ws/methods.ts`는 `filePatcher` 직접 호출 대신 mutation/query service를 호출하고, 현재 `commandId`, conflict response, error code envelope는 최대한 유지한다.
- `baseVersion`은 파일 hash 대신 document revision token으로 옮기되, UI의 retry/queue semantics(`useFileSync`)는 그대로 유지한다.
- 회귀 검증은 `PGlite` 기반 service/repository test + RPC adapter test로 구성하고, 동일 mutation replay, invalid content patch reject, clone-on-create, body block reorder, revision append를 고정한다.
- headless CLI와 다음 slice는 같은 service contract를 transport만 바꿔 재사용한다.

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
