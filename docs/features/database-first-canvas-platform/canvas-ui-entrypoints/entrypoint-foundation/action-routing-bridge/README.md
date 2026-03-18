# Action Routing Bridge

## 개요

이 sub-slice는 UI intent를 canonical mutation/query action contract로 연결한다.

## 범위

- UI intent -> domain action mapping
- action payload normalization
- command dispatch contract
- optimistic/rollback 연결 포인트

## 비범위

- canonical mutation schema 자체 정의
- selection 해석
- overlay 위치 계산

## 구현 전제

- `selection-context-resolver`가 계산한 selection / target / editability summary를 입력으로 받는다.
- 실제 mutation / query contract의 owner는 `canonical-mutation-query-core`이며, bridge는 이를 소비만 한다.
- viewport 조작처럼 persistence를 건드리지 않는 runtime action은 bridge에서 분기할 수 있지만, state 소유는 `ui-runtime-state`에 둔다.

## 구현 계획

### 1. Intent inventory를 먼저 고정

- `canvas-toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu`가 발생시키는 intent를 한 번에 수집한다.
- 각 intent를 `mutation`, `query`, `runtime-only` 세 갈래로 분류하고 ad-hoc write path 후보를 제거한다.
- intent별로 어떤 canonical action 조합으로 실행되는지 표 형태로 잠근다.
- 이 단계에서 표현 불가능한 intent가 나오면 bridge 우회 구현이 아니라 `canonical-mutation-query-core` 보강 이슈로 되돌린다.

### 2. Bridge contract를 정의

- 공통 request shape를 고정한다.
  - `surface`
  - `intent`
  - `resolvedContext`
  - `uiPayload`
  - `trigger`
- 공통 response shape를 고정한다.
  - `dispatchedActions`
  - `optimisticToken`
  - `rollbackToken`
  - `error`
- dependency direction은 `surface -> resolver -> bridge -> canonical executor` 한 방향으로 유지한다.

### 3. Payload normalization / gating 레이어를 구현

- UI가 보내는 느슨한 payload를 canonical id, relation id, capability patch shape 기준으로 정규화한다.
- 실행 가능 여부는 renderer 이름이 아니라 resolver가 넘긴 `semanticRole`, `primaryContentKind`, capability/editability summary 기준으로 판단한다.
- 실행 불가 케이스는 조용히 무시하지 않고, surface와 intent를 포함한 명시적 진단으로 반환한다.

### 4. Dispatch / optimistic lifecycle 연결

- bridge는 intent를 canonical mutation/query executor 호출로 변환하고, 필요한 경우 여러 action을 순서 있게 묶는다.
- `object.create + canvas-node.create`, `object.create + object-relation.create + canvas-node.create` 같은 복합 흐름을 bridge 내부 orchestration 책임으로 둔다.
- optimistic apply/commit/reject 훅은 bridge가 이벤트를 내보내고, pending state의 저장과 표시 책임은 `ui-runtime-state`가 갖는다.
- rollback은 broad fallback이 아니라 intent 단위 실패 원인과 함께 노출되도록 설계한다.

### 5. Surface adoption을 병렬 가능하게 마무리

- 각 UI surface는 직접 mutation 함수를 호출하지 않고 bridge dispatch API만 사용하도록 강제한다.
- 후속 feature는 "새 write path 추가"가 아니라 "기존 bridge에 intent mapping 추가" 방식으로 확장한다.
- foundation 단계 완료 후에는 toolbar / floating menu / pane menu / node menu가 같은 bridge contract 위에서 병렬 구현 가능해야 한다.

## 단계별 산출물

- intent catalog: surface별 intent 목록과 canonical action 매핑표
- bridge contract: request / response / error / optimistic event shape
- normalizer/gating spec: payload 정규화 규칙과 실행 가능 조건
- dispatch orchestration spec: 단일 action / 복합 action 실행 순서와 rollback 연결점
- adoption checklist: 모든 UI entrypoint가 direct write path 없이 bridge만 쓰는지 확인하는 점검표

## 검증 계획

- intent별 contract test가 예상 canonical action 조합을 정확히 생성한다.
- capability / content-kind 제약 위반 시 bridge가 명시적 오류를 반환하고 silent fallback이 없다.
- 복합 intent 실패 시 optimistic pending state와 rollback 이벤트가 일관되게 정리된다.
- UI surface 코드에 bridge 외 직접 mutation 경로가 없는지 확인한다.

## 완료 기준

- 모든 UI entrypoint가 ad-hoc write path 없이 같은 action bridge를 사용한다.
- surface별 intent 추가가 bridge contract 확장만으로 가능하다.
- optimistic/rollback 연결이 surface별 중복 구현 없이 공통 경로로 수렴한다.
