# Database-First Canvas Platform 구현 계획

## 1. 문서 목적

이 문서는 `docs/features/database-first-canvas-platform/README.md` 방향 문서를 실제 구현 가능한 작업 레인으로 분해한 실행 계획이다.

핵심 목표는 세 가지다.

- `.tsx` file-first 편집 경로를 database-first 문서 모델로 전환한다.
- canonical model, canvas composition, plugin runtime을 분리된 책임으로 구현한다.
- AI와 사용자 모두가 giant file 편집 없이 부분 조회/부분 수정 가능한 구조를 만든다.

## 2. 구현 원칙

1. 데이터베이스가 workspace와 document의 primary source of truth다.
2. canonical model과 canvas composition은 분리 저장한다.
3. plugin은 확장 경로이지만, core schema를 대체하지 않는다.
4. untrusted plugin 실행을 전제로 sandbox/capability를 먼저 설계한다.
5. AI 편집은 raw file overwrite가 아니라 tool-driven mutation을 기본 경로로 둔다.
6. 기존 `.tsx` legacy migration/import tooling은 별도 feature로 분리하고 이번 계획 범위에서 제외한다.

## 3. 작업 스트림

이 전환은 하나의 기능이 아니라 여러 레이어를 동시에 움직이는 작업이다. 구현은 아래 스트림으로 나눠 병행 가능한 범위를 최대화한다.

### A. Storage and Schema

- workspace/document/object/plugin의 canonical schema 설계
- migration, revision, backup/export 기준 정의
- embedding/search 인덱스 경계 정의

### B. Mutation and Query Engine

- object/document mutation contract 정의
- partial read/query API 설계
- UI 편집과 AI 편집이 같은 mutation path를 쓰도록 정렬

### C. Canvas Runtime Integration

- canvas composition을 DB-backed document로 전환
- selection, layout, placement, reorder, reparent를 mutation 중심으로 재구성
- UI runtime state와 persisted state 경계 분리

### D. Plugin Runtime

- plugin manifest/registry/instance 모델 도입
- sandbox runtime 및 host API 설계
- external chart/table/calendar/custom widget 경로 개방

### E. AI/CLI Tooling

- document/object query tool
- composition mutation tool
- plugin instance 관리 tool
- workspace-aware search tool

## 4. Phase 의존성

| Phase | 선행 Phase | 병렬 가능 | 핵심 산출물 |
|------|------------|-----------|------------|
| 0. 계약 고정 | 없음 | 부분 가능 | README 보강, schema doc, plan doc |
| 1. DB foundation | 0 | 부분 가능 | workspace/document/object/plugin 기본 스키마 |
| 2. Mutation/query core | 1 | 부분 가능 | typed mutation contract, partial query API |
| 3. Canvas DB composition | 2 | 부분 가능 | DB-backed canvas load/save/mutate |
| 4. Plugin runtime v1 | 1,2 | 부분 가능 | manifest, registry, sandbox host API |
| 5. AI/CLI Tooling | 2,3 | 부분 가능 | query/mutation tools, CLI/MCP tools |
| 6. Hardening | 3,4,5 | 낮음 | backup/export, migration, fallback, observability |

## 5. Phase 상세

## Phase 0. 계약 고정

### 목표

- database-first 전환의 용어와 경계를 먼저 고정한다.
- 이후 구현이 README와 ADR에서 drift하지 않게 한다.

### 작업

1. feature README를 기준 방향 문서로 유지한다.
2. schema modeling 문서를 작성해 logical model을 고정한다.
3. plugin runtime 구현 전략을 문서화한다.
4. legacy TSX migration tooling은 별도 후속 feature로 분리한다고 명시한다.

### 완료 기준

- 구현자가 어떤 데이터가 canonical인지 혼동하지 않는다.
- plugin source와 canvas document가 다른 것임이 문서에 명확히 남아 있다.

## Phase 1. DB Foundation

### 목표

- workspace/document/object/plugin을 수용할 최소 persistence layer를 만든다.

### 구현 범위

- `workspaces`
- `documents`
- `document_revisions`
- `objects`
- `object_relations`
- `canvas_nodes`
- `canvas_edges`
- `plugin_packages`
- `plugin_versions`
- `plugin_instances`
- `embedding_records`

### 구현 원칙

1. schema는 PostgreSQL/pgvector에 자연스럽게 매핑되도록 설계한다.
2. 고정 필드와 확장 필드는 분리한다.
3. `jsonb`는 확장성과 plugin payload 저장에 사용하되, join/lookup 핵심 키는 명시 컬럼으로 둔다.

### 검증

- migration이 빈 DB에 적용된다.
- workspace 단위 문서 생성/삭제/조회가 가능하다.
- plugin 미설치 상태에서도 instance row가 손실되지 않는다.

### 완료 기준

- 문서 하나를 DB에서 생성하고, 빈 canvas와 빈 object graph를 저장할 수 있다.

## Phase 2. Mutation and Query Core

### 목표

- UI 편집과 AI 편집이 동일한 mutation/query surface를 사용하게 만든다.

### 구현 범위

- typed mutation envelope
- object CRUD + relation mutation
- canvas node/edge add/move/remove/reorder
- group/frame/container create, attach, detach, ungroup mutation
- document/surface load
- object/document/plugin instance query

### 구현 원칙

1. mutation은 intent 중심으로 정의한다.
2. partial read/query를 기본 경로로 설계한다.
3. validation 실패는 조용히 무시하지 않고 명시적 에러로 반환한다.

### 검증

- 동일 mutation replay 시 결정적 결과를 만든다.
- `move node`, `reparent node`, `update plugin props`가 전체 문서 overwrite 없이 적용된다.
- `group nodes`, `ungroup nodes`, `move group`이 child 배치 계약을 깨지 않는다.
- AI tool과 UI action이 같은 mutation executor를 공유한다.

### 완료 기준

- direct manipulation 기본 동작이 AST patch 없이 mutation만으로 재현된다.

## Phase 3. Canvas DB Composition

### 목표

- canvas를 `.tsx` 렌더 산출물이 아니라 DB-backed composition document로 전환한다.

### 구현 범위

- surface load/save
- node/edge normalization
- layout persistence
- view state persistence
- group/frame/container persistence
- document open/switch/search wiring

### 구현 원칙

1. persisted canvas state와 runtime-only UI state를 분리한다.
2. layout result는 persisted 가능하지만 derived cache는 최소화한다.
3. canonical object binding과 freeform placement를 동시에 지원한다.
4. 그룹 계층은 `canvas_nodes` 안의 node family로 표현하고, 자식 소속은 `parent_node_id`로 표현한다.
5. `group`과 `frame/container`는 같은 parent-child 메커니즘을 공유하되, 동작 계약은 분리한다.

### 컨테이너 개념 반영

#### Group

- 가벼운 묶음 단위다.
- 자식 노드는 group node의 `id`를 `parent_node_id`로 가진다.
- 주 책임은 함께 선택, 함께 이동, 함께 정렬되는 시각적 grouping이다.

#### Frame / Container

- group보다 강한 의미를 갖는 컨테이너다.
- 동일하게 `parent_node_id` 기반으로 자식을 소속시키되, 추가로 제목, 배경, drop target, clipping, 자동 레이아웃 같은 정책을 가질 수 있다.
- v1에서는 contract를 분리해 두고, 구현은 최소 공통 parent-child 메커니즘 위에서 시작한다.

#### Free Node

- `parent_node_id`가 없는 일반 노드다.
- 필요 시 이후에 group/frame으로 attach될 수 있어야 한다.

### 검증

- 새로고침 후 node placement, z-order, edge 연결이 유지된다.
- large canvas에서 부분 load/query 전략이 가능하다.
- canonical object가 없는 freeform note와 object-bound widget이 함께 공존한다.
- group 이동 시 child가 함께 이동하고, ungroup 시 child가 surface 기준으로 안정적으로 복원된다.
- frame/container는 group과 다른 시각/행동 정책을 가질 수 있어야 한다.

### 완료 기준

- 최소 한 개의 production canvas가 DB-backed document로 동작한다.
- parent-child 기반 그룹 동작이 DB-backed composition에서 재현된다.

## Phase 4. Plugin Runtime v1

### 목표

- 사용자 커스텀 컴포넌트와 외부 라이브러리를 canvas에 안전하게 임베딩할 수 있는 최소 runtime을 연다.

### 권장 구현 방향

- plugin code는 document 본문이 아니라 package/version asset로 저장한다.
- canvas는 `plugin_instance`만 저장한다.
- untrusted plugin은 host DOM에 직접 올라가지 않고 sandbox에서 실행한다.

### v1 권장 런타임

**권장: `iframe sandbox + postMessage bridge`**

이 선택의 이유:

- 브라우저에서 untrusted TS/TSX UI를 가장 현실적으로 격리할 수 있다.
- React/chart/table/calendar 같은 DOM 기반 라이브러리를 수용하기 쉽다.
- host API를 명시적인 capability surface로 제한할 수 있다.

### 구현 범위

- plugin manifest
- plugin registry
- plugin bundle loading
- sandbox bridge
- instance props validation
- missing plugin fallback

### 검증

- 플러그인이 없거나 로드 실패해도 문서 로드가 깨지지 않는다.
- plugin은 허용된 host API만 호출할 수 있다.
- props/binding schema가 맞지 않으면 validation error를 표준 방식으로 표시한다.

### 완료 기준

- 최소 2종의 plugin 예제(예: chart, table)가 sandbox 경로로 렌더된다.

## Phase 5. AI/CLI Tooling

### 목표

- AI가 file-first 이점을 잃지 않도록 새 도구 경로를 제공한다.
- DB-backed 문서에 대한 partial query/mutation UX를 고정한다.

### 구현 범위

- workspace/query 도구
- object/canvas/plugin mutation 도구
- selection-aware AI command

### 구현 원칙

1. AI tool은 “전체 문서 읽기”보다 “필요 데이터만 읽기”를 우선한다.
2. UI action과 같은 mutation executor를 재사용한다.
3. legacy TSX migration/import tooling은 이 plan에 포함하지 않는다.

### 검증

- AI가 giant file 없이 필요한 일부만 조회/수정할 수 있다.
- selection, object query, plugin instance 수정이 같은 tool contract로 노출된다.

### 완료 기준

- AI가 representative DB-backed document를 partial query/mutation으로 수정할 수 있다.

## Phase 6. Hardening and Operations

### 목표

- schema migration, backup/export, plugin failure, index rebuild 등 운영 이슈를 정리한다.

### 구현 범위

- backup/export 포맷
- revision/rollback
- embedding rebuild job
- plugin load failure fallback
- observability/metrics

### 검증

- DB schema migration이 이전 문서를 유지한다.
- plugin 제거/비활성화 시 placeholder fallback이 동작한다.
- embedding 재생성이 문서 무결성을 깨지 않는다.

### 완료 기준

- 운영자가 문서 손실 없이 migration과 recovery를 수행할 수 있다.

## 6. 플러그인 구현 전략

플러그인은 이번 전환의 부가 기능이 아니라 핵심 확장 경로다. 다만 구현 방식은 엄격하게 제한해야 한다.

### 원칙

1. plugin source와 plugin instance를 구분한다.
2. plugin은 canvas schema를 직접 소유하지 않는다.
3. plugin은 선언된 capability만 사용한다.
4. plugin failure는 host 문서 전체 failure가 되면 안 된다.

### 권장 모델

#### Plugin Package

- 사용자 또는 팀이 작성한 TS/TSX 소스
- build 결과와 manifest를 가진다
- package와 version 단위로 관리한다

#### Plugin Export

- 하나의 package version이 노출하는 widget entry
- 예: `chart.bar`, `table.grid`, `calendar.month`

#### Plugin Instance

- 특정 canvas에 배치된 실제 인스턴스
- props, binding, local persisted state를 가진다

### Host API 최소 범위

- `queryObjects(input)`
- `getObject(id)`
- `getSelection()`
- `updateInstanceProps(instanceId, patch)`
- `emitAction(type, payload)`
- `requestResize(sizeHint)`

플러그인은 host store나 DB에 직접 접근하지 않는다. 모든 접근은 bridge를 거친다.

### 비권장 모델

- DB document 내부에 raw TSX source를 그대로 넣고 직접 실행
- same-origin main React tree에 untrusted plugin을 직접 mount
- plugin이 arbitrary DOM/DB/network 권한을 기본으로 가지는 구조

## 7. 주요 리스크

- canonical model과 canvas composition 경계가 흐려질 위험
- plugin runtime 격리 비용이 예상보다 커질 위험
- AI tool contract가 충분하지 않으면 기존 file-first 생산성을 잃을 위험
- DB schema migration 설계가 늦어지면 초기 DB 문서가 빠르게 부채가 될 위험

## 8. 성공 기준

- 주요 편집 동작이 더 이상 `.tsx` AST patch에 의존하지 않는다.
- large workspace를 giant file 없이 탐색/편집할 수 있다.
- 최소 plugin runtime이 table/chart/custom widget을 수용한다.
- AI가 workspace-aware query/mutation 경로를 통해 필요한 일부만 편집한다.

## 9. 다음 문서

- `docs/features/database-first-canvas-platform/schema-modeling.md`
- `docs/features/legacy-tsx-migration/README.md`
- `docs/adr/ADR-0005-database-first-canvas-platform.md`
