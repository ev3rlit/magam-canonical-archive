# Tasks: Runtime Access Refactoring

**Input**: `docs/features/m2/runtime-access-refactoring/README.md`, `docs/features/m2/runtime-access-refactoring/implementation-plan.md`  
**Prerequisites**: `canvas-runtime-contract`, `canvas-runtime-cqrs`, `ai-first-canonical-cli`, completed `runtimews-refactoring` baseline  
**Tests**: 이 문서는 상위 refactoring backlog 이다. 현 시점에서는 구조 검증과 compatibility hard removal 검증이 가장 중요하다.

**Current Baseline**: 이 task 문서는 `runtimews-refactoring` 작업이 이미 완료된 현재 코드베이스를 기준으로 다시 작성한다. 즉 `app/ws/routes.ts`, `app/ws/handlers/*`, `app/ws/shared/*`, subscription handler 분리, `methods.ts` 제거는 이미 완료된 상태로 간주한다.

**Organization**: task 는 현재 baseline 확인 -> ownership / contract 정렬 -> CLI-first / desktop host-owned 방향 고정 -> collaboration event/outbox 정리 -> integrated compatibility removal -> 검증 / 운영 posture 순서로 나눈다.

## Format: `[ID] [P?] Description`

- `[P]`: 병렬 가능
- 완료된 baseline 은 `[X]`, 남은 work item 은 `[ ]` 로 표시한다.

## Phase 0: Verified Baseline

**Purpose**: 이미 완료된 `runtimews-refactoring` 결과를 현재 기준점으로 고정한다.

- [X] T001 `app/ws/routes.ts` 가 top-level route registry 로 존재한다
- [X] T002 `app/ws/methods.ts` 가 제거되어 더 이상 주 진입점이 아니다
- [X] T003 `app/ws/handlers/canvasHandlers.ts`, `workspaceHandlers.ts`, `appStateHandlers.ts`, `compatibilityHandlers.ts`, `historyHandlers.ts` 가 존재한다
- [X] T004 subscription surface 가 `canvasSubscriptionHandlers`, `compatibilitySubscriptionHandlers` 로 분리되어 있다
- [X] T005 shared helper 가 `app/ws/shared/params.ts`, `errors.ts`, `responses.ts`, `runtimeTransforms.ts`, `subscriptions.ts` 로 분리되어 있다
- [X] T006 production code 에서 `filePatcher.ts` 직접 import 는 `app/ws/handlers/compatibilityHandlers.ts` 로 수렴되어 있다

**Checkpoint**: 이후 task 는 `runtimews-refactoring` 을 다시 하는 것이 아니라, 그 위에서 상위 runtime access 구조와 compatibility 제거를 진행한다.

---

## Phase 1: Ownership / Contract 정렬

**Purpose**: 코어 ownership 과 adapter ownership 문장을 문서와 backlog 에서 먼저 고정한다.

- [ ] T007 `shared runtime` 이 유일한 write owner 라는 문장을 README / implementation-plan 에서 더 명확히 고정
- [ ] T008 [P] `HTTP/WS` 는 adapter 이고 ownership 을 가지지 않는다는 검증 기준을 문서에 명시
- [ ] T009 [P] compatibility hard removal 을 상위 access refactor 의 하위 실행 단계로 유지
- [ ] T010 현재 baseline 완료 항목과 남은 항목을 README / implementation-plan / tasks 사이에 동일하게 반영

**Checkpoint**: transport, runtime, compatibility 의 역할 분리가 더 이상 흔들리지 않는다.

---

## Phase 2: CLI-first / Desktop Host-Owned Runtime

**Purpose**: AI 와 desktop 의 공식 진입점을 분명히 한다.

- [ ] T011 CLI 를 AI 공식 진입점으로 쓰는 contract 요구사항 정리
  - machine-readable JSON
  - dry-run
  - structured error
  - revision / conflict
  - changed set
- [ ] T012 [P] desktop renderer 는 IPC client, host/main process 는 privileged runtime owner 라는 경계 정리
- [ ] T013 [P] `CLI -> Desktop`, `Desktop -> CLI`, `Renderer -> shared runtime`, `Renderer -> DB` 금지 경로를 문서상 명시
- [ ] T014 `ai-first-canonical-cli` 와 이 상위 문서의 역할 연결을 재확인

**Checkpoint**: "AI 는 어디로 붙는가?" 와 "desktop runtime owner 는 누구인가?" 에 대한 답이 각각 `CLI`, `host/main process` 로 고정된다.

---

## Phase 3: Collaboration Event / Outbox

**Purpose**: 멀티 클라이언트 협업의 기준점을 transport 가 아니라 semantic event 로 이동시킨다.

- [ ] T015 collaboration event / outbox 최소 필드 정리
  - `actorId`
  - `commandId`
  - `canvasId`
  - `canvasRevision`
  - `changedSet`
  - `timestamp`
- [ ] T016 [P] invalidate relay 와 collaboration event 의 관계 정리
- [ ] T017 [P] same-origin ignore, replay, follow-up query 기준 정리
- [ ] T018 CLI / desktop / web 이 같은 event semantics 를 소비한다는 시나리오 정리

**Checkpoint**: "변경 반영" 이 더 이상 `WS 자체` 로 설명되지 않고, runtime event 기준으로 읽힌다.

---

## Phase 4: Integrated Compatibility Removal

**Purpose**: 현재 코드베이스에 실제로 남아 있는 compatibility 흔적을 제거 가능한 순서로 정리한다.

### 4.1 Inventory

- [ ] T019 현재 compatibility inventory 를 코드 기준으로 확정
  - `app/ws/filePatcher.ts`
  - `patchFile`, `patchNode*`
  - `resolveCanvasCompatibilityPath`
  - `baseVersion` file hash fallback
  - `file.subscribe`, `file.unsubscribe`
  - `file.changed`, `files.changed`
  - `compatibilityFilePath`, `currentCompatibilityFilePath`
  - `sourceVersion`, `sourceVersions`
  - `compatibility-mutation`

### 4.2 Already Reduced In Code

- [X] T020 `app/ws/shared/params.ts` 는 더 이상 `filePatcher.ts` 타입 import 에 의존하지 않는다
- [X] T021 transport 쪽 subscription 경계는 이미 `shared/subscriptions.ts` 와 subscription handlers 로 분리되었다
- [X] T022 `routes.ts` 는 얇은 registry 로 존재하고, `methods.ts` 허브는 제거되었다

### 4.3 Remaining Compatibility Work

- [ ] T023 [P] UI / store 쪽 `compatibilityFilePath`, `currentCompatibilityFilePath` 제거 계획 고정
- [ ] T024 [P] UI / store / host 쪽 `sourceVersion`, `sourceVersions` 제거 계획 고정
- [ ] T025 [P] `actionRoutingBridge` 의 `compatibility-mutation` 제거 순서 고정
- [ ] T026 runtime command 가 이미 있는 intent 부터 compatibility executor 제거 대상 확정
  - style
  - content
  - create / duplicate
  - delete
  - reparent
  - z-order
- [ ] T027 runtime 대체가 먼저 필요한 intent 목록 고정
  - rename
  - lock toggle
  - group membership / ungroup
- [ ] T028 watcher / file bridge 의 남은 소비자와 역할 정리
- [ ] T029 host/API contract 에서 `sourceVersion` 제거 계획 수립
- [ ] T030 `filePatcher.ts` 최종 삭제 조건과 완료 정의 고정

**Checkpoint**: compatibility 제거 backlog 가 현재 실제 코드 흔적을 기준으로 정리된다. 이미 끝난 transport 정리와 아직 남아 있는 UI/store/host 제거 작업이 섞이지 않는다.

---

## Phase 5: Verification / Operating Posture

**Purpose**: 최종 구조를 실제로 검증 가능한 기준으로 정리한다.

- [ ] T031 CLI / desktop / web access path 별 구조 검증 항목 정리
- [ ] T032 [P] collaboration event / invalidate 검증 항목 정리
- [ ] T033 [P] compatibility 완료 검증 항목 정리
  - `filePatcher.ts` production import 0건
  - `compatibility-mutation` production code 0건
  - runtime-only editing path 확인
  - `sourceVersion`, `compatibilityFilePath` public contract 제거 확인
- [ ] T034 [P] optional local daemon 승격 조건 기록
- [ ] T035 관련 문서 우선순위와 역할 분담 정리

**Checkpoint**: 구현자가 다음 작업을 시작할 때 무엇이 이미 끝났고 무엇이 남았는지, 그리고 무엇으로 완료를 판단할지 명확하다.

## Notes

- 이 task 문서는 `runtimews-refactoring` 이후 상태를 전제로 하는 umbrella backlog 다.
- 따라서 `routes.ts` 도입, handler split, subscription handler 분리, shared helper 추출, `methods.ts` 제거 같은 작업은 다시 pending 으로 다루지 않는다.
- 현재 남은 핵심은 두 가지다.
  - 상위 runtime access ownership 문장 고정
  - UI/store/host 중심의 compatibility hard removal
