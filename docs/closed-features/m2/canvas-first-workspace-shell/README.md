# Canvas-First Workspace Shell

작성일: 2026-03-29  
상태: Draft  
범위: `m2`  
목표: `workspace-scoped database`를 저장 경계로 유지하면서, 사용자가 앱을 열자마자 `canvas editor`로 진입하고 sidebar에서 캔버스 간 이동과 생성을 수행하는 기본 앱 셸 기준을 고정한다.

## 1. 이 문서의 목적

이 문서는 아래 세 가지를 하나의 제품 기준으로 묶는다.

- 데이터베이스 파일은 `workspace` 단위로 둔다.
- 앱의 기본 시작점은 `workspace page`가 아니라 `canvas editor`로 둔다.
- 사용자의 주요 탐색 단위는 파일 트리가 아니라 `canvas`이며, 이동과 생성은 editor sidebar에서 처리한다.

즉 이번 문서는 "workspace를 없앨 것인가?"를 다루지 않는다.  
대신 `workspace는 저장 경계`, `canvas는 작업 경계`라는 분리를 유지하면서, 사용자에게는 canvas-first 경험을 전면에 두는 방향을 고정한다.

이번 문서에서 고정하는 기준 문장은 아래와 같다.

- `workspace = storage boundary`
- `canvas = editing boundary`
- `workspace page = secondary management surface`

## 2. 문제 정의

### 2.1 사용자 관점 문제

1. 앱을 열 때마다 `workspace page`를 먼저 거치면 실제 작업을 다시 시작하기까지 한 단계가 더 늘어난다.
2. 사용자가 실제로 이어서 하려는 일은 대개 특정 workspace를 보는 것이 아니라 특정 `canvas`를 다시 여는 것이다.
3. 캔버스 간 이동이 workspace page 중심으로 설계되면 작업 흐름이 끊기고 editor 집중도가 낮아진다.
4. 새 캔버스를 만들고 싶을 때도 "관리 화면으로 이동 후 생성"보다 "현재 editor shell 안에서 바로 생성"이 더 자연스럽다.

### 2.2 제품 관점 문제

1. `canvas`가 실제 편집 단위인데 `workspace`가 전면에 나오면 제품 mental model이 흐려진다.
2. `workspace`는 여전히 저장, 검색, 권한, 백업, 자산 ownership의 핵심 경계이므로 사라질 수 없다.
3. per-canvas DB를 택하면 캔버스 간 검색, 참조, 인덱싱, 자산 공유가 분절된다.
4. 반대로 workspace page를 기본 홈으로 고정하면 editor-first 제품 경험과 충돌한다.

## 3. 핵심 결정

### 3.1 저장 경계는 `workspace-scoped database`다

- 데이터베이스 파일은 canvas마다 따로 만들지 않는다.
- 하나의 workspace가 하나의 로컬 DB 저장 경계를 가진다.
- 이 경계 안에서 canvas, search index, asset metadata, plugin/runtime metadata를 함께 다룬다.
- 단, first-run에서는 이 workspace가 메모리에서만 임시로 존재할 수 있으며, 첫 저장 또는 첫 canvas 추가 시점에만 실제 DB 파일을 생성한다.
- 이때 구조는 `in-memory DB -> file DB`를 직렬로 거치는 이중 저장 레이어가 아니라, 하나의 persistence contract 아래에서 active backend를 `ephemeral in-memory`에서 `durable file-backed`로 전환하는 방식이어야 한다.

### 3.2 앱의 기본 진입점은 `canvas editor`다

- 앱 재실행 시 항상 마지막 `workspace + canvas`를 먼저 복원 시도한다.
- 복원에 성공하면 별도 dashboard나 workspace page를 거치지 않고 editor로 바로 진입한다.
- 사용자가 체감하는 앱의 시작점은 관리 화면이 아니라 작업 화면이다.
- persisted session이 없으면 앱은 `memory-backed blank workspace + blank canvas`로 바로 진입한다.

### 3.3 `workspace page`는 보조 관리 surface다

- workspace page는 workspace를 추가, 전환, 복구, 제거하는 보조 surface로 남긴다.
- 하지만 기본 랜딩 페이지가 되지 않는다.
- workspace는 UI 전면 주인공이 아니라 배경의 ownership/storage boundary로 작동한다.

### 3.4 캔버스 이동과 생성은 editor sidebar 안에서 처리한다

- sidebar는 file explorer가 아니라 `canvas navigator`가 된다.
- 사용자는 editor shell 안에서 다른 캔버스로 전환할 수 있어야 한다.
- 사용자는 editor shell 안에서 새 캔버스를 만들고 즉시 그 캔버스 편집으로 들어가야 한다.

### 3.5 persistence 구조는 backend promotion 모델로 다룬다

- 런타임 아래에는 하나의 persistence contract만 둔다.
- first-run에서는 `ephemeral in-memory postgres-compatible backend`가 active storage backend가 된다.
- 첫 저장 또는 첫 canvas 추가 시에는 현재 state를 file-backed backend로 promote한 뒤, active backend를 교체한다.
- 저장 이후 canonical source of truth는 file-backed backend 하나만 남아야 한다.
- memory backend와 file backend를 동시에 source of truth로 두는 구조는 채택하지 않는다.

## 4. 목표

1. 사용자가 앱을 재실행했을 때 마지막 `workspace + canvas`를 자동으로 복원한다.
2. 신규 사용자도 첫 캔버스 편집까지 최소 단계로 진입할 수 있다.
3. workspace는 storage/ownership boundary로 유지하되, UI 전면 노출은 줄인다.
4. 캔버스 간 이동과 생성이 editor 내부 흐름으로 일관되게 동작한다.
5. restore 실패나 workspace 경로 불가 같은 예외 상태도 editor-first mental model을 깨지 않도록 정리한다.

## 5. 비목표

1. 여러 workspace를 동시에 활성 상태로 여는 기능
2. cloud sync 또는 multi-user collaboration
3. global dashboard-first 홈 화면
4. canvas를 넘는 복합 project dashboard
5. 이번 문서 하나에서 전체 DB schema나 low-level IPC shape를 확정하는 일

## 6. 사용자 스토리

- As a returning user, I want the app to reopen my last active canvas immediately so that I can resume work without navigating a workspace home first.
- As an active author, I want to switch to another canvas from the editor sidebar so that I can move between related work without leaving the editing surface.
- As an active author, I want to create a new canvas from the sidebar and land in it right away so that the creation flow feels continuous.
- As a user recovering from broken state, I want a clear fallback path when the last canvas is missing or damaged so that I can keep working without being stranded.
- As a user managing local data, I want workspace identity and path to remain visible as supporting context so that I still trust where my data lives.

## 7. 요구사항

### 7.1 P0 Must Have

1. app launch는 `last workspace + last canvas` 복원을 항상 우선 시도해야 한다.
2. persisted session이 없으면 기본 진입 화면은 `memory-backed blank workspace + blank canvas` editor여야 한다.
3. 복원 성공 시 기본 진입 화면은 `canvas editor`여야 한다.
4. editor sidebar는 active workspace의 canvas 목록을 표시해야 한다.
5. editor sidebar에서 canvas 전환이 가능해야 하며, full home redirect 없이 editor context 안에서 동작해야 한다.
6. editor sidebar에서 새 canvas를 생성할 수 있어야 하며, 생성 직후 해당 canvas가 열린 상태가 되어야 한다.
7. last canvas 복원 실패 시 명확한 fallback state를 제공해야 한다.
8. per-canvas DB가 아니라 per-workspace DB를 persistence contract로 유지해야 한다.
9. first-run에서는 in-memory backend만 active source of truth가 되어야 한다.
10. 첫 저장 또는 첫 canvas 추가 시에는 file-backed backend 생성과 active backend promotion이 일어나야 한다.

### 7.2 P1 Nice to Have

1. recent canvases 목록
2. pinned canvases
3. sidebar canvas search
4. restore 실패 원인에 따른 더 구체적인 recovery affordance

### 7.3 P2 Future Considerations

1. multi-window canvas workflows
2. global omnibox 또는 command palette 기반 cross-canvas jump
3. cross-workspace canvas jump
4. sidebar personalization 또는 custom sections

## 8. 정보 구조

### 8.1 기본 원칙

- 상단/좌측에서 `workspace identity`는 보조 정보다.
- 사용자에게 가장 강하게 보이는 것은 현재 canvas와 canvas 목록이다.
- sidebar는 canvas navigator이며, file tree를 primary 정보구조로 삼지 않는다.

### 8.2 추천 레이아웃

```text
┌────────────────────────────────────┐
│ Workspace Summary                  │
│  Acme Product                      │
│  /Users/.../Acme Product           │
│  Switch Workspace                  │
├────────────────────────────────────┤
│ Canvases                           │
│  + New Canvas                      │
│  Search / Pin / Recent             │
│  Roadmap                           │
│  Notes                             │
│  IA Draft                          │
├────────────────────────────────────┤
│ Editor                             │
│  Active Canvas                     │
│  Canvas Content                    │
└────────────────────────────────────┘
```

### 8.3 Sidebar 순서

1. `workspace summary`
2. `canvas list`
3. `new canvas`
4. `switch workspace` 유틸

## 9. 상태 정의

### 9.1 First Run

- 등록된 workspace가 없거나 복원 가능한 session 정보가 없다.
- 앱은 `memory-backed blank workspace + blank canvas` editor로 바로 진입한다.
- 이 상태는 영구 홈 화면이 아니라 transient bootstrap 상태다.
- 사용자가 첫 저장 또는 새 canvas 추가를 수행하면 그 시점에 workspace DB 파일이 생성된다.
- 이 시점에 runtime은 in-memory backend에서 file-backed backend로 promote된다.

### 9.2 Last Session Restore Success

- 마지막 `workspace + canvas`가 모두 유효하다.
- 앱은 해당 canvas editor로 바로 진입한다.

### 9.3 Restore Target Missing

- 마지막 workspace는 존재하지만 마지막 canvas가 없거나 열 수 없다.
- 앱은 동일 workspace 범위 안에서 fallback canvas 선택 또는 새 canvas 생성 상태를 보여 준다.

### 9.4 Empty Workspace

- workspace는 유효하지만 canvas가 하나도 없다.
- editor shell 안에서 "첫 canvas 만들기"가 primary action이 된다.

### 9.5 Workspace Unavailable

- 마지막 workspace 경로가 없어졌거나 접근할 수 없다.
- 앱은 문제를 명확히 알리고 workspace reconnect 또는 다른 workspace 선택으로 recovery를 제공한다.

## 10. 성공 지표

### 10.1 Leading Indicators

- 앱 재실행 후 사용자가 첫 편집 가능한 canvas에 도달하기까지의 단계 수 감소
- 복귀 사용자 중 `last workspace + canvas` 자동 복원 성공 비율
- canvas 생성 후 즉시 편집 진입 성공 비율
- sidebar 기반 canvas 전환 사용 비율

### 10.2 Quality Indicators

- restore 실패 상태에서 사용자가 막히지 않고 다른 canvas 또는 새 canvas로 이동하는 비율
- workspace path missing 상황에서 reconnect 또는 alternate workspace selection 완료 비율
- editor 진입 전 불필요한 intermediate screen 노출 비율 감소

## 11. Acceptance Criteria

- 앱에 유효한 마지막 session이 있으면, 앱 시작 시 workspace page를 거치지 않고 마지막 canvas editor가 열린다.
- 앱에 persisted session이 없으면, 앱 시작 시 `memory-backed blank workspace + blank canvas` editor가 열린다.
- active workspace 안에 여러 canvas가 있으면, sidebar에서 다른 canvas를 선택해 editor context를 유지한 채 전환할 수 있다.
- 사용자가 sidebar에서 `New Canvas`를 실행하면 새 canvas가 생성되고 즉시 열린다.
- first-run 상태에서 첫 저장 또는 첫 canvas 추가가 일어나면 file-backed workspace DB가 생성되고 active backend가 해당 DB로 전환된다.
- 마지막 canvas가 삭제되었거나 손상되었으면, 앱은 crash 또는 dead-end 없이 fallback canvas/workspace 선택 상태를 제공한다.
- 마지막 workspace 경로가 유효하지 않으면, 앱은 문제를 설명하고 reconnect 또는 다른 workspace 선택 경로를 제공한다.
- 저장 경계 문서와 구현 계획에서 `workspace = storage boundary`, `canvas = editing boundary`가 일관되게 유지된다.

## 12. 관련 문서

- `docs/features/m2/canvas-first-workspace-shell/implementation-plan.md`
- `docs/adr/ADR-0012-workspace-scoped-database-and-canvas-first-shell.md`
- `docs/adr/ADR-0005-database-first-canvas-platform.md`
- `docs/features/database-first-canvas-platform/workspace-document-shell/README.md`
