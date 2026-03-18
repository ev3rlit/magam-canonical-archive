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

## 완료 기준

- 모든 UI entrypoint가 ad-hoc write path 없이 같은 action bridge를 사용한다.

## 구현 계획

### 1. bridge contract 고정

- `toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu`가 공통으로 넘길 `intent` 입력 shape를 먼저 잠근다.
- 입력에는 최소한 `surfaceId`, `intentId`, selection/target 참조, raw UI payload, optimistic 필요 여부를 포함한다.
- bridge 출력은 `canonical mutation`, `canonical query`, `runtime-only action` 셋 중 하나의 dispatch descriptor로 제한해서 ad-hoc 분기를 막는다.

### 2. intent registry와 gating 기준 분리

- 각 UI surface는 직접 mutation을 호출하지 않고, 자기 intent descriptor만 bridge에 등록한다.
- intent enable/disable 판단은 `selection-context-resolver`가 만든 공통 context와 canonical metadata를 기준으로 수행한다.
- renderer 이름이나 surface별 임시 조건식 대신 `semanticRole`, `primaryContentKind`, capability 기반 gating만 허용한다.

### 3. payload normalization과 ordered dispatch 구성

- bridge 내부에서 UI payload를 canonical action payload로 정규화한다.
- 하나의 UI intent가 여러 mutation을 요구하면 bridge가 ordered dispatch plan을 만들고, surface는 그 순서를 알지 못하게 유지한다.
- create, rename, style patch, relation create 같은 대표 intent는 여기서 공통 mapping table로 고정한다.

### 4. optimistic/rollback 연결 지점 고정

- dispatch descriptor에는 `baseVersion`, pending key, rollback에 필요한 최소 metadata를 함께 실어 `ui-runtime-state`와 연결한다.
- 실패는 `canonical-mutation-query-core`의 validation/error contract를 그대로 surface까지 올리고, bridge 내부에서 성공처럼 숨기지 않는다.
- runtime-only action과 mutation action이 섞이는 경우에도 bridge가 단일 진입점으로 순서를 조정한다.

### 5. surface 전환과 검증

- 네 UI entrypoint를 순차 전환하면서 직접 write path 호출을 제거한다.
- 미등록 intent, invalid capability payload, optimistic rollback 경로를 최소 검증 세트로 묶어 regression을 막는다.
- 이 단계가 끝나면 이후 surface 기능 추가는 bridge registry 확장만으로 병렬 진행 가능해야 한다.
