# App Global State Persistence

작성일: 2026-03-23  
상태: In Progress  
범위: `database-first-canvas-platform` 하위 implementation slice  
결정 방향: `localStorage` 기반 app metadata를 `app-level PGlite + Drizzle ORM`으로 승격

## 1. 배경

현재 앱은 workspace registry와 일부 사용자 상태를 renderer `localStorage`에 저장한다.

대표적으로 아래 정보가 여기에 남아 있다.

- registered workspace list
- active workspace id
- workspace별 last active document
- document resume session 일부
- theme / font 같은 사용자 preference 일부

이 구조는 web prototype 단계에서는 빠르지만, 현재 제품 방향과는 맞지 않는다.

- primary host는 Electron desktop이다.
- 앱은 이미 `PGlite` 기반 canonical persistence를 도입했다.
- workspace/document/canvas의 source of truth는 점점 database-first로 이동 중이다.

반면 app-level metadata는 여전히 browser storage에 흩어져 있다.

이로 인해 다음 문제가 생긴다.

1. desktop product의 durable app state가 browser storage에 종속된다.
2. 등록된 workspace path, 최근 문서, UI restore state가 host boundary 밖에 있다.
3. `localStorage` key가 늘어날수록 state ownership이 분산된다.
4. renderer-only persistence라 desktop/web behavior parity와 migration 관리가 어려워진다.

즉 이제는 “workspace-local canonical DB”와 별도로 “app-global metadata DB”를 정의할 시점이다.

## 2. 목표

이번 slice의 목표는 app-level state의 canonical store를 `PGlite`로 정의하고, schema/repository contract는 `Drizzle ORM`으로 고정하는 것이다.

구체적으로는 다음을 달성한다.

1. app-global metadata를 위한 embedded `PGlite` 저장소를 도입한다.
2. workspace registry를 `localStorage`에서 app DB로 이동한다.
3. active workspace, recent document, resume state를 같은 app DB 안에서 관리한다.
4. renderer는 browser storage가 아니라 host/runtime-backed app state repository를 통해 이 데이터를 읽고 쓴다.
5. web/desktop 모두 같은 logical app-state contract를 사용하게 한다.

## 3. 비목표

이번 slice에서 하지 않는 일은 아래와 같다.

1. workspace 내부 canonical object/document persistence를 app-global DB로 옮기지 않는다.
2. secret, token, credential을 `PGlite`에 저장하지 않는다.
3. plugin/runtime/presence 전체 설정 시스템을 한 번에 통합하지 않는다.
4. workspace-local DB와 app-global DB를 하나의 물리 DB로 합치지 않는다.
5. OS keychain/secure store를 대체하지 않는다.

## 4. 핵심 결정

### 4.1 app-global DB를 별도로 둔다

DB를 둘로 나눈다.

- workspace-local canonical DB
  - 위치: `<workspace>/.magam/canonical-pgdata`
  - 책임: document, object, canonical persistence
- app-global state DB
  - 위치: user-level app data directory 아래
  - 책임: registry, recent, preference, session restore

이 둘은 역할이 다르다.

- workspace-local DB는 “사용자 작업물”의 기준 저장소다.
- app-global DB는 “앱이 여러 workspace를 어떻게 기억하는가”의 기준 저장소다.

### 4.2 `localStorage`는 canonical store가 아니다

`localStorage`는 앞으로 아래 둘 중 하나만 허용한다.

- 일시 캐시
- migration fallback / read-once import source

즉 아래 state는 canonical source of truth가 아니어야 한다.

- registered workspace list
- active workspace
- workspace별 last active document
- durable session restore state

### 4.3 app-global state는 typed repository를 통해 접근한다

renderer가 SQL이나 storage key를 직접 알면 안 된다.

접근 경계는 아래와 같이 둔다.

- shared contract
- app state repository
- host adapter / transport
- renderer consumer

즉 renderer는 `getHostRuntime().appState` 또는 `getHostRuntime().rpc` 확장 surface 같은 typed API만 본다.

### 4.4 contract-first data model을 둔다

app-global state도 canonical persistence와 같은 방식으로 contract를 먼저 둔다.

초기 contract 파일은 아래 위치를 기준으로 한다.

- `libs/shared/src/lib/app-state-persistence/contracts/types.ts`
- `libs/shared/src/lib/app-state-persistence/contracts/schema.ts`
- `libs/shared/src/lib/app-state-persistence/contracts/index.ts`

원칙:

- TypeScript record/type 정의와 Drizzle schema를 같은 contract 경계 안에 둔다.
- repository, migration, bootstrap은 이 contract를 소비한다.
- renderer나 host adapter는 table shape를 직접 알지 않고 repository contract만 본다.

### 4.5 secret과 runtime env는 별도 관리한다

“전역 환경 구성” 전체를 PGlite에 넣지는 않는다.

분리는 아래처럼 유지한다.

- PGlite
  - non-secret app metadata
  - recent/workspace/session/prefs
- env / host runtime config
  - port
  - base URL
  - workspace bootstrap path
- secure store
  - token
  - API key
  - credential

## 5. 저장 위치 정책

### 5.1 기본 위치

기본 저장소는 user-level app data 아래에 둔다.

후보 예시:

- macOS: `~/Library/Application Support/Magam/app-state-pgdata`
- Linux: `~/.local/share/magam/app-state-pgdata`
- Windows: `%APPDATA%/Magam/app-state-pgdata`

개발 초기에는 host capability가 준비되기 전까지 아래 같은 임시 규칙을 둘 수 있다.

- repo/dev fallback: `<repo>/.magam/app-state-pgdata`

단, 제품 기준 canonical path는 user-level app data directory여야 한다.

### 5.2 경로 해석 ownership

경로 해석은 renderer가 아니라 host가 소유한다.

- desktop: Electron main/preload가 OS app data directory를 해석한다.
- web secondary: dev/test 목적에 맞는 local fallback path를 host adapter가 제공한다.

현재 구현 정렬:

- desktop host는 `main -> orchestrator -> backend/preload` 경로로 하나의 `MAGAM_APP_STATE_DB_PATH`를 선택하고 전달한다.
- desktop runtime config는 `appStateDbPath`를 포함해 renderer/debug surface에서도 같은 경로를 관찰할 수 있다.
- desktop backend와 preload는 더 이상 각자 다른 app-state path fallback을 계산하지 않는다.

## 6. 데이터 모델 및 contract 파일

데이터 모델의 canonical contract는 아래 파일에 고정한다.

- `libs/shared/src/lib/app-state-persistence/contracts/types.ts`
- `libs/shared/src/lib/app-state-persistence/contracts/schema.ts`
- `libs/shared/src/lib/app-state-persistence/contracts/index.ts`
- `libs/shared/src/lib/app-state-persistence/index.ts`

후속 구현 파일은 아래를 기준으로 추가한다.

- `libs/shared/src/lib/app-state-persistence/pglite-db.ts`
- `libs/shared/src/lib/app-state-persistence/repository.ts`
- `libs/shared/src/lib/app-state-persistence/drizzle/`

이 문서에서는 contract 파일과 중복해서 엔티티 shape를 다시 쓰지 않는다.  
데이터 모델 설명은 엔티티 이름과 역할까지만 유지하고, 실제 필드/제약/Drizzle 정의는 contract 파일을 기준으로 본다.

### 6.1 `app_workspaces`

설명:

- 등록된 workspace registry를 저장한다.
- root path, display identity, pinning, 최근 접근 metadata의 canonical owner다.

contract reference:

- `AppWorkspaceRecord`
- `appWorkspaces`

### 6.2 `app_workspace_session`

설명:

- 현재 active workspace 같은 app-global singleton session state를 저장한다.
- 한 번에 하나의 active workspace를 복원하는 기준 엔티티다.

contract reference:

- `AppWorkspaceSessionRecord`
- `appWorkspaceSession`

### 6.3 `app_recent_documents`

설명:

- workspace별 최근 문서와 restore target을 저장한다.
- last active document와 recent document 복원 흐름의 canonical owner다.

contract reference:

- `AppRecentDocumentRecord`
- `appRecentDocuments`

### 6.4 `app_preferences`

설명:

- theme, font, future UI preference 같은 app-global preference를 저장한다.
- 초기에는 generic key/value preference store로 시작하고, 이후 hot-path setting만 별도 승격 여부를 검토한다.

contract reference:

- `AppPreferenceRecord`
- `appPreferences`

## 7. 구현 단계

### Phase 1. app-global persistence foundation

1. `libs/shared`에 app-global `PGlite` bootstrap 모듈을 추가한다.
2. `Drizzle ORM` 기반 app-state contract와 분리된 migration 경로를 만든다.
3. app-global DB location resolver를 추가한다.
4. minimal repository를 만든다.

foundation file set:

- `libs/shared/src/lib/app-state-persistence/contracts/types.ts`
- `libs/shared/src/lib/app-state-persistence/contracts/schema.ts`
- `libs/shared/src/lib/app-state-persistence/pglite-db.ts`
- `libs/shared/src/lib/app-state-persistence/repository.ts`
- `libs/shared/src/lib/app-state-persistence/drizzle/*`

최초 repository 범위:

- list workspaces
- upsert workspace
- remove workspace
- read/write active workspace
- read/write workspace recent document

### Phase 2. workspace registry migration

1. `workspaceRegistry.ts`의 `localStorage` read/write를 repository-based API로 교체한다.
2. 초기 부팅 시 `localStorage -> app-global DB` one-time migration을 추가한다.
3. migration 이후 기존 storage key는 더 이상 canonical source로 사용하지 않는다.

권장 migration 규칙:

- app-state registry가 비어 있을 때만 legacy `localStorage`를 read-once import source로 사용한다.
- import 완료 여부는 app-global preference marker로 기록한다.
- import 이후 renderer는 app-state를 canonical source로 hydrate하고, legacy key는 migration input으로만 남긴다.

### Phase 3. preference convergence

1. theme와 global font는 app-global preference를 canonical source로 사용한다.
2. renderer `localStorage`는 first-paint bootstrap cache로만 유지한다.
3. provider/store는 mount 이후 app-state preference를 다시 읽어 cache drift를 수렴시킨다.

현재 구현 정렬:

- theme는 `theme.mode` app-state preference를 읽고 쓰며, `localStorage['theme']`는 bootstrap cache로만 남긴다.
- global font는 `font.globalFamily` app-state preference를 읽고 쓰며, `localStorage['magam.font.globalFamily']`는 bootstrap cache로만 남긴다.

- app DB가 비어 있고 localStorage key가 존재할 때만 import
- import 성공 후 localStorage는 삭제하거나 stale source로 무시
- malformed localStorage는 best-effort import 후 버린다

### Phase 3. graph store / renderer integration

1. `graph` store hydration이 app-global repository를 통해 registry를 읽도록 바꾼다.
2. workspace upsert/remove/reconnect/update가 app DB에 반영되게 한다.
3. active workspace와 last active document restore를 app DB에서 읽는다.

### Phase 4. preference convergence

1. theme/font 같이 이미 `localStorage`에 있는 preference의 이전 후보를 분리 검토한다.
2. hot-path bootstrap이 필요한 값은 여전히 light bootstrap cache를 둘 수 있다.
3. 단, canonical source는 app-global DB로 옮긴다.

## 8. API / 경계 제안

### 8.1 shared repository contract

예상 shape:

```ts
interface AppStateRepository {
  listWorkspaces(): Promise<AppWorkspaceRecord[]>;
  upsertWorkspace(input: AppWorkspaceUpsertInput): Promise<AppWorkspaceRecord>;
  removeWorkspace(workspaceId: string): Promise<void>;

  getActiveWorkspaceId(): Promise<string | null>;
  setActiveWorkspaceId(workspaceId: string | null): Promise<void>;

  listRecentDocuments(workspaceId: string): Promise<AppRecentDocumentRecord[]>;
  setLastActiveDocument(input: { workspaceId: string; documentPath: string | null }): Promise<void>;

  getPreference<T>(key: string): Promise<T | null>;
  setPreference<T>(key: string, value: T): Promise<void>;
}
```

### 8.2 host boundary

renderer는 storage engine을 몰라야 한다.

권장 방향:

- 기존 host runtime boundary에 `appState` surface 추가
- 또는 `RendererRpcClient`에 app-state logical methods 추가

이번 저장소의 최근 방향을 따르면 아래가 더 자연스럽다.

- app-global state도 host RPC logical method로 넣는다
- web/desktop transport 차이는 adapter 뒤로 숨긴다

즉 향후 logical method 예시는 아래처럼 갈 수 있다.

- `appState.workspaces.list`
- `appState.workspaces.upsert`
- `appState.workspaces.remove`
- `appState.workspace.active.get`
- `appState.workspace.active.set`
- `appState.documents.recent.list`
- `appState.documents.lastActive.set`
- `appState.preferences.get`
- `appState.preferences.set`

## 9. 파일 구조 제안

```text
libs/shared/src/lib/app-state-persistence/
  contracts/
    index.ts
    types.ts
    schema.ts
  drizzle/
    0000_app_global_state.sql
  index.ts
  pglite-db.ts
  repository.ts
```

이 구조에서 책임은 아래처럼 나눈다.

- `contracts/types.ts`
  - app-global entity TypeScript record
- `contracts/schema.ts`
  - Drizzle `pgTable` schema
- `pglite-db.ts`
  - app-global PGlite bootstrap
- `repository.ts`
  - typed persistence read/write API
- `drizzle/*`
  - app-global migration artifact

## 10. 마이그레이션 전략

### 9.1 read path

부팅 시 순서는 아래처럼 둔다.

1. app-global DB 읽기 시도
2. 비어 있으면 legacy localStorage import 시도
3. import 결과를 app-global DB에 기록
4. 이후부터 app-global DB만 읽기

### 9.2 write path

새 write는 바로 app-global DB로 간다.

선택적 dual-write는 migration safety를 위해 아주 짧게만 허용할 수 있다.

권장 기본:

- Stage 1: DB write + localStorage no-write
- Stage 1 fallback 필요 시: temporary dual-write
- Stage 2: localStorage 완전 제거

## 11. 테스트 계획

### 11.1 shared persistence

- app-global DB bootstrap path resolution
- migration 적용
- workspace unique root path 보장
- active workspace singleton update
- recent document upsert/clear

### 11.2 migration

- 빈 app DB + 기존 localStorage => import 성공
- 기존 app DB 존재 + localStorage 존재 => DB 우선
- malformed localStorage => 안전하게 무시

### 11.3 renderer/store integration

- registered workspace hydration이 app DB에서 복원된다.
- active workspace가 재시작 후 유지된다.
- last active document가 workspace별로 복원된다.
- workspace remove 시 registry/recent state가 정리된다.

### 11.4 web/desktop parity

- desktop와 web이 같은 logical app-state contract를 노출한다.
- renderer는 storage path나 PGlite location을 직접 몰라도 된다.

## 12. 리스크와 완화

### 리스크 1. app-global DB와 workspace-local DB 책임 혼선

완화:

- app-global DB는 registry/prefs/session only
- document/object canonical data는 workspace-local DB only

### 리스크 2. 너무 많은 설정을 한 번에 통합

완화:

- first migration scope는 workspace registry + active workspace + recent document로 제한

### 리스크 3. desktop와 web path resolution 차이

완화:

- path resolution은 host adapter가 소유
- renderer는 logical contract만 사용

### 리스크 4. bootstrap latency

완화:

- initial schema는 작게 유지
- optional bootstrap cache가 필요한 값만 별도 light cache 검토

## 13. 완료 기준

아래 조건을 만족하면 이 slice를 완료로 본다.

1. registered workspace list의 canonical source가 app-global `PGlite`다.
2. active workspace와 last active document가 app-global DB에서 복원된다.
3. renderer에서 workspace registry용 `localStorage` key를 canonical source로 사용하지 않는다.
4. web/desktop 모두 같은 logical app-state boundary를 통해 이 데이터를 읽고 쓴다.
5. workspace-local canonical DB와 app-global metadata DB의 책임이 문서와 코드에서 모두 명확하다.
