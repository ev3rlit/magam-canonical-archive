# Canvas-First Workspace Shell 구현 계획서

## 1. 문서 목적

이 문서는 `docs/features/m2/canvas-first-workspace-shell/README.md`의 결정을 실제 실행 순서로 옮긴 구현 계획이다.

- 기준 문서: `docs/features/m2/canvas-first-workspace-shell/README.md`
- 관련 ADR:
  - `docs/adr/ADR-0005-database-first-canvas-platform.md`
  - `docs/adr/ADR-0012-workspace-scoped-database-and-canvas-first-shell.md`
- 관련 기존 문서:
  - `docs/features/database-first-canvas-platform/workspace-document-shell/README.md`

핵심 목적은 `workspace는 storage/search/ownership boundary`, `canvas는 navigation/editing boundary`라는 분리를 유지한 채, 앱의 기본 진입을 dashboard가 아니라 editor-first로 재배치하고, first-run에서는 `메모리 기반 blank workspace + blank canvas`로 먼저 시작한 뒤 첫 저장 또는 첫 canvas 추가 시점에만 workspace DB를 생성하도록 lazy persistence 흐름을 고정하는 것이다. 이때 persistence 구조는 `in-memory DB -> file DB`를 직렬로 겹치는 것이 아니라, 하나의 persistence contract 아래에서 active backend를 `ephemeral in-memory`에서 `durable file-backed`로 promote하는 방식으로 다룬다.

## 2. 구현 원칙

1. workspace는 storage, search, ownership의 경계다.
2. canvas는 사용자가 체감하는 navigation, editing의 경계다.
3. 앱 launch path는 dashboard-first가 아니라 editor-first다.
4. sidebar는 file explorer가 아니라 canvas navigator다.
5. first-run 기본 상태는 persisted workspace가 아니라 memory-backed transient workspace다.
6. workspace DB는 첫 저장 또는 첫 canvas 추가 시점에만 생성한다.
7. runtime은 backend 종류를 모르는 상태로 하나의 persistence contract만 소비해야 한다.
8. save 시점에는 active backend promotion만 일어나야 하며, memory DB와 file DB를 동시에 source of truth로 두지 않는다.
9. restore, fallback, workspace recovery는 모두 이 mental model을 깨지 않는 방향으로 설계한다.

## 3. Public Contract 수준 결정

### 3.1 Launch Contract

- persisted session이 있으면 앱은 `last workspace + last canvas`를 먼저 복원 시도한다.
- 복원 성공 시 기본 진입은 마지막 canvas editor다.
- persisted session이 없으면 앱은 `memory-backed blank workspace + blank canvas` editor로 진입한다.

### 3.2 Fallback Contract

- restore 실패 시 별도 홈 화면으로 튕기지 않는다.
- 가능한 한 editor shell 안에서 recovery state를 제공한다.
- first-run에서는 workspace 생성 화면 대신 blank canvas editor를 먼저 보여 준다.
- 단, workspace 자체가 없거나 접근 불가능하면 workspace reconnect 또는 alternate selection 경로를 노출한다.

### 3.3 Navigation Contract

- canvas switch는 full home redirect 없이 editor context 안에서 처리한다.
- canvas 생성도 editor shell 내부 action으로 수행하고, 생성 후 즉시 target canvas를 연다.

### 3.4 Persistence Contract

- DB는 canvas 단위가 아니라 workspace 단위다.
- canvas는 workspace 안의 document/editing unit으로 존재한다.
- 단, first-run blank workspace는 메모리에서만 유지된다.
- workspace DB 파일은 사용자가 저장하거나 새 canvas를 추가하는 첫 persisted action에서 생성된다.
- 즉 `workspace-scoped DB`는 storage boundary를 뜻하며, 앱 최초 진입 시점의 eager file creation을 뜻하지 않는다.

### 3.5 Backend Contract

- runtime 아래에는 하나의 persistence contract만 둔다.
- first-run active backend는 `ephemeral in-memory postgres-compatible backend`다.
- 첫 저장 또는 첫 canvas 추가 시 active backend를 `durable file-backed postgres backend`로 promote한다.
- promote 이후 canonical source of truth는 file-backed backend 하나만 남는다.
- `UI -> runtime -> in-memory DB -> file DB` 같은 직렬 이중 저장 레이어는 채택하지 않는다.

## 4. 구현 단계

## Phase 0. Terminology / Ownership 고정

목표:

- 구현 전 용어와 ownership 문장을 먼저 고정한다.

작업:

1. `workspace = storage/search/ownership boundary`를 모든 구현 문서와 코드 경계에서 동일하게 사용한다.
2. `canvas = navigation/editing boundary`를 UI entrypoint와 persistence 문서에서 동일하게 사용한다.
3. `workspace page = secondary management surface`를 explicit rule로 정리한다.

종료 기준:

- 구현자가 workspace와 canvas를 서로 다른 경계로 혼동하지 않는다.

Gate:

- 문서 gate: PRD, implementation plan, ADR이 같은 문장을 공유한다.

## Phase 1. App Entrypoint를 Canvas-First로 재정의

목표:

- 앱 시작 시 기본 landing을 workspace page가 아니라 canvas editor로 바꾸고, first-run 기본 상태를 transient blank workspace로 고정한다.

작업:

1. launch bootstrap에서 persisted session이 있으면 마지막 `workspace + canvas` 복원을 먼저 시도하도록 정의한다.
2. persisted session이 없으면 `memory-backed blank workspace + blank canvas`를 기본 bootstrap path로 연다.
3. restore success path를 editor-first path로 고정한다.
4. first-run 또는 restore 불가 상태를 workspace page가 아니라 transient blank editor 상태로 재정의한다.
5. workspace page direct landing이 필요했던 기존 가정을 보조 관리 경로로 재해석한다.

종료 기준:

- 정상적인 returning user flow에서는 마지막 canvas editor가 열리고, first-run user flow에서는 blank canvas editor가 열린다.

Gate:

- 흐름 gate: valid last session이 있으면 workspace page를 기본 홈처럼 거치지 않으며, persisted session이 없으면 blank editor로 진입한다.

## Phase 1.5 Backend Promotion Contract 고정

목표:

- runtime과 persistence의 관계를 `backend promotion` 모델로 고정한다.

작업:

1. `UI -> runtime -> persistence adapter -> active backend` 구조를 기준 경로로 명시한다.
2. first-run active backend를 `ephemeral in-memory postgres-compatible backend`로 정의한다.
3. 첫 저장 또는 첫 canvas 추가 시 `file-backed postgres backend` 생성과 promote 순서를 정의한다.
4. promote 이후 memory backend를 canonical source of truth에서 내리는 규칙을 정의한다.
5. snapshot copy 또는 event-log replay 중 어떤 promote 메커니즘을 택하더라도 runtime contract는 동일하게 유지되도록 정리한다.

종료 기준:

- 구현자가 memory DB와 file DB를 직렬 write path로 오해하지 않는다.

Gate:

- persistence gate: active backend는 항상 하나만 canonical source of truth가 된다.

## Phase 2. Sidebar Navigation을 Canvas 중심으로 재구성

목표:

- editor sidebar가 active workspace의 canvas navigator가 되도록 재구성한다.

작업:

1. sidebar primary information architecture를 file tree 중심에서 canvas list 중심으로 재배치한다.
2. `workspace summary`는 보조 정보로 유지한다.
3. `new canvas`, `switch canvas`, `switch workspace`의 우선순위를 정리한다.
4. transient blank workspace 상태에서도 sidebar가 최소 canvas/navigation affordance를 유지하도록 정리한다.
5. canvas 전환이 editor shell을 깨지 않는 navigation path로 동작하도록 contract를 고정한다.

종료 기준:

- 사용자가 editor를 떠나지 않고 다른 canvas로 전환하거나 새 canvas를 만들 수 있다.

Gate:

- navigation gate: canvas switch가 full home redirect에 의존하지 않는다.

## Phase 3. Restore / Fallback / Session Semantics 고정

목표:

- 복원 실패와 예외 상태가 editor-first mental model을 깨지 않도록 정리한다.

작업:

1. `last session restore success` 상태를 기본 경로로 정의한다.
2. `first run blank workspace` 상태를 memory-backed transient session으로 정의한다.
3. `missing last canvas` 상태의 fallback 동작을 정의한다.
4. `missing workspace path` 상태의 reconnect 또는 alternate selection 흐름을 정의한다.
5. `empty workspace` 상태에서 첫 canvas 생성이 primary action이 되도록 정리한다.
6. 첫 저장 또는 첫 canvas 추가 시점에 workspace DB를 생성하고 backend promote를 수행하는 lazy creation trigger를 정의한다.

종료 기준:

- restore 실패나 first-run이 곧 dead-end나 홈 화면 회귀를 뜻하지 않게 된다.

Gate:

- recovery gate: first-run blank workspace, missing canvas, missing workspace path, empty workspace가 각각 명확한 recovery path를 가진다.

## Phase 4. Workspace Management Surface를 보조 화면으로 축소

목표:

- workspace page의 역할을 관리 surface로 제한하고 primary landing 책임을 제거한다.

작업:

1. workspace page는 workspace add, switch, reconnect, remove에 집중하도록 역할을 재정의한다.
2. editor shell 안에서 해결 가능한 작업은 workspace page로 보내지 않는다.
3. workspace identity는 신뢰와 ownership 설명을 위한 supporting context로 유지한다.
4. future dashboard 요구는 별도 feature로 분리하고 이번 범위에 포함하지 않는다.

종료 기준:

- workspace page는 필요할 때 여는 보조 surface가 되고, editor-first 기본 흐름을 방해하지 않는다.

Gate:

- ownership gate: workspace page가 primary entrypoint나 everyday navigation hub로 다시 커지지 않는다.

## 5. 검증 시나리오

구현자는 아래 시나리오를 기준으로 behavior를 검증해야 한다.

1. fresh install
   - 등록된 workspace가 없을 때 memory-backed blank workspace + blank canvas editor가 바로 열린다.
2. first save creates DB
   - first-run blank workspace 상태에서 첫 저장 시 workspace DB 파일이 생성되고 active backend가 file-backed backend로 promote된다.
3. first additional canvas creates DB
   - first-run blank workspace 상태에서 새 canvas 추가 시 workspace DB 파일이 생성되고 active backend가 file-backed backend로 promote된다.
4. no dual-source-of-truth after promote
   - promote 이후 memory backend와 file backend가 동시에 canonical write owner로 남지 않는다.
5. one workspace / one canvas
   - 마지막 session 복원 시 해당 canvas editor로 바로 진입한다.
6. one workspace / many canvases
   - sidebar에서 canvas 전환이 editor context 유지 상태로 동작한다.
7. missing last canvas
   - dead-end 없이 fallback canvas 선택 또는 새 canvas 생성 상태로 이동한다.
8. missing workspace path
   - reconnect 또는 alternate workspace selection 경로가 명확하다.
9. create canvas then immediate open
   - 새 canvas 생성 직후 곧바로 해당 canvas 편집 상태가 된다.
10. switch canvas preserving editor shell state
   - canvas 전환이 앱을 다시 시작하는 느낌이 아니라 editor 내부 이동처럼 동작한다.

## 6. 구현 순서 원칙

1. 먼저 terminology와 ownership을 고정한다.
2. 그다음 launch entrypoint와 transient first-run bootstrap을 editor-first로 재정의한다.
3. 그 위에서 backend promotion contract를 잠근다.
4. 그다음 lazy DB creation trigger를 backend promotion에 연결한다.
5. 그다음 sidebar IA와 navigation contract를 정리한다.
6. 마지막으로 restore/fallback과 workspace management demotion을 마감한다.

이 순서를 지키는 이유는 단순하다.

- launch path가 먼저 잠기지 않으면 sidebar와 workspace page의 책임이 계속 흔들린다.
- backend promotion contract가 먼저 없으면 memory DB와 file DB가 이중 write path로 설계될 위험이 있다.
- transient first-run과 lazy DB creation trigger가 먼저 없으면 persistence timing이 화면 이벤트마다 흔들린다.
- navigation contract가 먼저 없으면 restore/fallback이 화면 단위 우회로로 퍼지기 쉽다.

## 7. 관련 문서

- `docs/features/m2/canvas-first-workspace-shell/README.md`
- `docs/adr/ADR-0005-database-first-canvas-platform.md`
- `docs/adr/ADR-0012-workspace-scoped-database-and-canvas-first-shell.md`
- `docs/features/database-first-canvas-platform/workspace-document-shell/README.md`
