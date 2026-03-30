# DB Runtime Owner Hardening

## 개요

이 feature는 `db-mediated-ui-cli-runtime`의 후속 구현을 별도 slice로 분리해 다룬다.

핵심 문제는 이미 분명하다.

- desktop app 내부에서는 `Electron main`이 canonical DB runtime owner가 되는 방향으로 1차 이동했다.
- renderer는 `LISTEN / NOTIFY + version reconciliation` 기반 invalidation으로 넘어가기 시작했다.
- 하지만 외부 CLI write, node-scoped precondition, partial reconciliation, legacy runtime surface 제거는 아직 닫히지 않았다.

이 문서는 그 남은 작업을 하나의 새 feature로 고정한다.

즉 이 feature의 관심사는 “DB-mediated runtime의 방향을 설명하는 것”이 아니라, **실제 owner topology와 node/version contract를 끝까지 굳히는 구현 작업**이다.

## 왜 별도 feature로 분리하는가

`db-mediated-ui-cli-runtime`은 coordination domain과 runtime contract를 고정하는 기준 문서다.

반면 이 문서는 다음 성격을 가진다.

- 현재 landed state를 기준으로 gap을 닫는다.
- owner topology, CLI access path, node precondition, partial reconcile, legacy cleanup, verification을 실제 작업 축으로 나눈다.
- 여러 세션에 걸쳐 이어질 구현 우선순위와 완료 기준을 고정한다.

즉 기존 문서의 부록이 아니라, 별도 실행 slice로 보는 편이 맞다.

## 현재 구현 기준

현재 코드베이스는 최소 아래 상태까지 이동했다.

- desktop renderer는 더 이상 `canvas.subscribe` / `canvas.changed` 기반 WS invalidation을 active path로 사용하지 않는다.
- `Electron main`이 workspace-scoped canonical DB runtime owner가 되는 방향으로 1차 이동했다.
- renderer는 preload IPC bridge를 통해 query / mutation / reconciliation을 시작한다.
- canonical persistence에는 `WorkspaceRuntimeVersion`, `CanvasMetadataVersion`, `NodeVersion` 저장 경로가 추가되었다.
- `app/ws/server.ts`, subscription helper, notification helper는 제거됐다.

하지만 아래는 아직 끝나지 않았다.

- 외부 CLI 프로세스의 독립 embedded DB write를 UI가 live wake-up으로 감지하는 문제
- write precondition을 node version / node revision 기준으로 완전히 옮기는 문제
- active canvas full reconcile을 node-level partial reconcile로 줄이는 문제
- legacy WS / compatibility runtime surface를 완전히 제거하는 문제
- 현재 소스와 별개로 남아 있는 typecheck 잡음 정리

## 현재 구조적 한계

현재 가장 큰 실제 blocker는 embedded `PGlite`의 cross-instance 제약이다.

- 같은 data dir의 별도 인스턴스 사이에서 `NOTIFY`가 전달되지 않았다.
- 따라서 `Electron main`이 장수명 owner를 잡더라도, 외부 CLI가 별도 `PGlite` handle로 직접 write하면 UI live wake-up은 성립하지 않는다.
- 지금 상태의 `LISTEN / NOTIFY`는 desktop app 내부의 단일 runtime owner 경계 안에서만 유효하다.

이 한계 때문에 첫 번째 작업은 owner topology 고정이어야 한다.

## 범위

- canonical DB owner topology 고정
- CLI mutation/query path의 owner-aware 재정렬
- write contract를 node revision / node version 중심으로 이동
- renderer reconciliation을 node-level patch refresh까지 축소
- legacy WS / compatibility runtime surface 제거
- 후속 세션 검증 gate 정리

## 비범위

- direct IPC / WebSocket / local socket attach의 UI-CLI 재도입
- `AgentJob` 같은 actor-specific persisted coordination entity 도입
- payload-driven invalidation 회귀
- `document_*` 물리 schema 명명을 이번 feature에서 전면 교체하는 작업

## 권장 순서

아래 순서를 바꾸지 않는 것을 기본으로 한다.

1. canonical DB owner topology 고정
2. CLI mutation/query 경로를 owner topology에 맞게 이동
3. write precondition을 node revision / node version 기준으로 전환
4. renderer reconcile 폭을 node-level로 축소
5. legacy WS / compatibility runtime surface 제거
6. 검증 잡음과 남은 typecheck gate 정리

## Workstream 1. Canonical DB Owner Topology 고정

### 목표

외부 CLI write까지 포함한 실제 shared coordination 경계를 하나로 고정한다.

### 왜 먼저 해야 하는가

- 지금 가장 큰 blocker는 `LISTEN / NOTIFY`의 cross-instance 부재다.
- owner topology가 고정되지 않으면 이후의 CLI invalidation, node precondition, partial reconcile 설계가 모두 흔들린다.

### 고정해야 할 결정

- canonical DB write/read owner는 단일 runtime이어야 한다.
- 기본 권장안은 `Electron main runtime owner + CLI가 그 owner를 통해 mutation/query 수행`이다.
- UI 앱과 CLI 앱 사이의 direct IPC / WebSocket / local socket attach는 금지되어 있으므로, “CLI가 owner에 붙는다”는 것은 app-attached transport가 아니라 canonical DB runtime topology 재설계를 뜻해야 한다.
- 이 단계에서 반드시 결정할 것:
  - CLI가 independent embedded DB writer를 유지할지
  - 유지하지 않는다면 어떤 canonical runtime surface를 통해 query/mutation을 위임할지
  - production PostgreSQL runtime을 언제 도입할지
  - local embedded path와 production shared path의 contract 차이를 어디까지 허용할지

### 구현 후보

#### Option A. Embedded owner only

- `Electron main`만 canonical DB owner가 된다.
- CLI는 same-process extension 또는 owner-managed execution으로만 write한다.
- 장점:
  - 현재 코드와 가장 가깝다.
  - `LISTEN / NOTIFY`와 version reconciliation을 가장 빨리 닫을 수 있다.
- 단점:
  - 독립 CLI 프로세스 write 모델을 사실상 포기해야 한다.

#### Option B. Real PostgreSQL owner

- local path도 shared PostgreSQL-compatible runtime으로 승격한다.
- UI / CLI는 둘 다 그 shared DB에 접속한다.
- 장점:
  - 문서 계약과 가장 정합적이다.
  - external CLI write live invalidation이 자연스럽다.
- 단점:
  - 이번 코드베이스 기준으로 변경폭이 가장 크다.

### 권장 결론

- 다음 세션에서는 최소한 A/B 중 하나를 ADR 수준으로 고정한다.
- owner topology가 고정되지 않으면 이후 작업은 구현보다 임시 우회가 된다.

### 완료 기준

- “외부 CLI write가 UI에 live wake-up되어야 하는가”에 대해 예/아니오와 그 이유가 문서로 고정된다.
- owner가 둘 이상 열리는 경로가 금지되거나 명시적으로 예외 처리된다.
- `LISTEN / NOTIFY`가 어느 runtime instance boundary에서 유효한지 명확해진다.

## Workstream 2. CLI Mutation/Query 경로를 Owner Topology에 맞게 이동

### 목표

CLI가 canonical DB에 직접 임의 write하는 경로를 닫고, owner topology에 맞는 canonical mutation/query executor만 사용하게 만든다.

### 세부 작업

- `libs/cli/src` 기준으로 current mutation / render / workspace command가 어떤 DB handle을 여는지 전수 조사한다.
- `createCanonicalPgliteDb(...)`를 직접 여는 CLI path를 owner-aware runtime access layer로 옮긴다.
- 최소 정리 대상:
  - `serve`
  - `render`
  - `canvas`
  - `mutation`
  - `canvas-node`
- “CLI가 canonical mutation/query core를 사용한다”와 “CLI가 canonical DB file을 직접 owner처럼 연다”를 분리해서 본다.

### 구현 원칙

- CLI는 persisted coordination contract를 우회하면 안 된다.
- `AgentJob` 같은 actor-specific persisted entity는 추가하지 않는다.
- actor identity는 mutation actor / audit / lock ownership에만 반영한다.

### 완료 기준

- CLI command path에서 independent embedded DB direct write 경로가 제거되거나 owner-aware adapter 뒤로 숨겨진다.
- CLI mutation apply가 `WorkspaceRuntimeVersion` / `NodeVersion` 갱신 루틴을 우회하지 않는다.
- live invalidation 가능 여부가 owner topology 결정과 일치한다.

## Workstream 3. Write Preconditions를 Node Revision / Node Version 중심으로 전환

### 목표

현재 남아 있는 `canvasRevision` 중심 stale check를 일반 편집 경로에서 제거하고, write contract를 node 중심으로 옮긴다.

### 현재 상태

- runtime version entity는 추가되었지만, 일반 편집 경로의 precondition은 여전히 `canvasRevision` 흔적이 남아 있다.
- `MutationResultEnvelopeV1`, projection, store, compatibility version token에 canvas revision 의미가 많이 섞여 있다.

### 세부 작업

- `libs/shared/src/lib/canonical-mutation/*`
  - batch precondition에서 `canvasRevision` 기본값 제거
  - target node set 기준 expected revision/version 추가
- `libs/shared/src/lib/canvas-runtime/contracts/*`
  - mutation result / projection contracts에서 authoritative field를 `canvasRevision`이 아니라 node-version aware shape로 이동
- `app/hooks/useCanvasRuntime.ts`
  - conflict retry / stale handling이 canvas-wide revision mismatch를 기본 가정하지 않게 수정
- `app/store/graph.ts`
  - `canvasRevisionsById`를 일반 editing correctness source로 쓰지 않도록 축소

### 규칙

- 일반 node edit는 node set precondition을 쓴다.
- canvas metadata mutation만 `CanvasMetadataVersion` 경로를 사용한다.
- canvas-wide revision은 legacy compatibility debt로만 취급한다.

### 완료 기준

- drag / rename / body edit / style patch가 canvas-wide revision mismatch 때문에 reject되지 않는다.
- multi-node mutation은 target node set precondition으로 reject/commit된다.
- stale write error message가 canvas 전체가 아니라 affected node set 기준으로 설명된다.

## Workstream 4. Renderer Reconciliation을 Active Canvas Full Reconcile에서 Node-Level Partial Reconcile로 축소

### 목표

현재의 안전한 whole-canvas refresh를 다음 단계의 node-level patch refresh로 줄인다.

### 현재 상태

- 현재는 `workspace-runtime-invalidated` 후 active canvas 전체 재조회 / 재렌더가 기본이다.
- 이 경로는 문서 계약과 정합적이지만, “changed node만 부분 reload”까지는 아직 아니다.

### 세부 작업

- reconcile 시 다음을 함께 읽는다.
  - `WorkspaceRuntimeVersion`
  - `CanvasMetadataVersion`
  - active canvas 범위 `NodeVersion` 집합
- local fingerprint와 DB fingerprint를 비교해 changed node set을 계산한다.
- 다음 분기만 허용한다.
  - canvas metadata version changed: shell reload
  - node version subset changed: node patch refresh
  - no diff: no-op

### 구현 기준

- 알림 payload는 wake-up hint일 뿐 authoritative diff source가 아니다.
- authoritative truth는 항상 DB 재조회 결과다.
- reconnect / resume / focus도 같은 reconciliation 함수로 처리한다.

### 완료 기준

- unrelated node까지 전체 dirty처럼 취급하지 않는다.
- changed node subset만 다시 읽는 path가 생긴다.
- active canvas full reconcile은 fallback path로만 남는다.

## Workstream 5. Legacy WS / Compatibility Runtime Surface 제거

### 목표

더 이상 active path에 쓰이지 않는 WS/compatibility runtime surface를 제거해 구조를 단순화한다.

### 현재 상태

- `app/ws/server.ts`와 subscription invalidation surface는 제거됐다.
- 하지만 `app/ws/*` 전체는 아직 legacy mutation/query compatibility layer로 남아 있다.
- 일부 테스트도 옛 file mutation runtime을 계속 가정한다.

### 세부 작업

- `app/ws/*`에서 실제 desktop/web active path에 더 이상 쓰이지 않는 파일을 전수 정리한다.
- `useCanvasRuntime`가 더 이상 참조하지 않는 WS rpc helper를 삭제한다.
- route/handler 테스트를 “legacy compatibility”와 “active desktop runtime”으로 명확히 분리하거나, 필요 없다면 삭제한다.
- `package.json`과 dev script에서 죽은 WS entrypoint를 제거한 상태를 유지한다.

### 규칙

- 새로운 active runtime은 `desktop main IPC runtime` 또는 다음 topology에서 정한 owner-aware path만 사용한다.
- “남겨두되 아무도 안 쓰는” surface를 추가로 만들지 않는다.

### 완료 기준

- editor active path에서 `app/ws/*` import가 사라진다.
- legacy compatibility 경로가 남더라도 이름과 위치로 “active contract가 아님”이 분명하게 드러난다.
- stale WS terminology가 새 코드/새 계약에 재유입되지 않는다.

## Workstream 6. Typecheck / Verification Gate 정리

### 목표

후속 세션들이 실제 regression을 잡을 수 있도록 검증 환경 잡음을 먼저 걷어낸다.

### 현재 알려진 문제

- `app/.next/types/...` generated route ref mismatch
- i18n locale shape mismatch
- 일부 legacy ws route test가 active contract와 어긋남

### 세부 작업

- `.next` generated artifact가 source-of-truth처럼 typecheck를 막지 않게 build/typecheck 절차를 정리한다.
- `app/features/i18n/locales/{ko,en}.ts`와 `AppMessages` shape mismatch를 먼저 닫는다.
- desktop runtime smoke test를 추가한다.
  - workspace select
  - canvas list/create
  - render
  - mutate
  - invalidation wake-up
  - focus/resume reconciliation
- 가능하면 다음 수준까지 검증한다.
  - desktop main runtime owner가 살아 있는 동안 `LISTEN`이 유지된다
  - commit 후 workspace invalidation token이 갱신된다
  - renderer는 payload가 아니라 re-read 결과로 refresh한다

### 완료 기준

- `typecheck:app` 결과에서 기존 known-noise가 제거된다.
- 최소 smoke test 세트가 현재 active runtime contract를 커버한다.
- 다음 세션에서 새로운 regression이 생기면 legacy noise에 묻히지 않는다.

## 세션 운영 규칙

다음 세션부터는 아래 규칙을 고정한다.

- owner topology가 고정되기 전까지, external CLI live invalidation을 “이미 되는 것처럼” 구현하지 않는다.
- node/version migration 전에 `canvasRevision` 의존 필드를 새 코드에 추가하지 않는다.
- 새 코드와 새 문서에서는 `workspace / canvas / node / lock / audit / version` terminology를 우선한다.
- `document_*`는 물리 schema 또는 호환성 부채 명명으로만 남긴다.
- UI 앱과 CLI 앱 사이에 direct IPC / WebSocket / local socket attach를 다시 도입하지 않는다.
- payload-driven invalidation은 금지한다. wake-up 후 re-read 결과만 authoritative truth다.

## 다음 세션의 추천 시작점

다음 세션은 아래 순서로 시작하는 것을 권장한다.

1. owner topology를 문서와 코드 기준으로 하나로 고정한다.
2. 그 topology에 맞춰 CLI mutation/query 경로 조사 결과를 표로 정리한다.
3. 어떤 CLI path가 direct embedded DB writer인지 식별한다.
4. 가장 작은 migration slice 하나를 골라 owner-aware path로 옮긴다.

## 관련 문서

- `docs/features/database-first-canvas-platform/db-mediated-ui-cli-runtime/README.md`
- `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`
- `docs/adr/ADR-0012-workspace-scoped-database-and-canvas-first-shell.md`

## 완료 기준

이 feature는 아래 상태가 되면 완료로 본다.

- external CLI write까지 포함한 live invalidation topology가 닫힌다.
- write correctness의 primary contract가 node revision / node version으로 이동한다.
- renderer가 node-level reconcile을 수행한다.
- active path에서 legacy WS runtime surface가 제거된다.
- typecheck / smoke / integration gate가 새 contract 기준으로 안정화된다.
