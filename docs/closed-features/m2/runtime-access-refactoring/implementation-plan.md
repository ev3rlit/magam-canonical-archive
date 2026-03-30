# Runtime Access Refactoring 구현 계획서

## 1. 문서 목적

이 문서는 `docs/features/m2/runtime-access-refactoring/README.md` 의 방향을 실제 실행 순서로 압축한 구현 계획이다.

- 기준 문서: `docs/features/m2/runtime-access-refactoring/README.md`
- 관련 문서:
  - `docs/features/m2/canvas-runtime-contract/README.md`
  - `docs/features/m2/canvas-runtime-cqrs/README.md`
  - `docs/features/m2/ai-first-canonical-cli/README.md`
  - `docs/features/m2/runtimews-refactoring/README.md`

핵심 목적은 `shared runtime + canonical DB + event log/outbox` 를 코어로 고정하고, CLI / desktop / HTTP/WS 를 그 위의 access adapter 로 재배치하며, compatibility hard removal 을 그 하위 실행 단계로 통합하는 것이다.

## 2. 구현 원칙

1. `shared runtime` 이 유일한 write owner 다.
2. AI 에이전트는 `CLI` 를 통해서만 접근한다.
3. desktop renderer 는 runtime owner 가 아니라 IPC client 다.
4. desktop host/main process 가 privileged runtime owner 다.
5. `HTTP/WS` 는 남아도 되지만 ownership 을 가지면 안 된다.
6. collaboration invalidation 은 DB row change 가 아니라 semantic event 기준이어야 한다.
7. compatibility hard removal 은 이 문서 안의 하위 실행 단계다.

## 3. 목표 결과물

이 리팩터링이 끝났을 때 기대하는 결과는 아래와 같다.

1. AI 에이전트의 정식 surface 가 CLI 로 고정된다.
2. desktop 과 CLI 는 서로 직접 의존하지 않는다.
3. desktop runtime access 는 host/main process 쪽으로 모인다.
4. `HTTP/WS` 는 adapter / invalidate relay 로 역할이 축소된다.
5. collaboration event / outbox 기준이 runtime contract 의 일부로 정리된다.
6. compatibility removal 은 transport 축소와 충돌하지 않는 하위 단계로 실행된다.

## 4. 구현 단계

## Phase 0. Ownership / Contract 고정

목표:

- 어떤 컴포넌트가 무엇을 소유하는지 먼저 고정한다.

작업:

1. `shared runtime` 의 write ownership 명시
2. CLI 를 AI-first official surface 로 문서화
3. desktop host / renderer 역할 경계 문서화
4. `HTTP/WS` 를 adapter 로 명시
5. collaboration event / outbox 최소 contract 정의

종료 기준:

- "누가 runtime owner 인가?" 에 대한 답이 더 이상 흔들리지 않는다.

Gate:

- 문서 gate: README / implementation-plan / tasks 가 같은 ownership 문장을 공유

## Phase 1. CLI-first Agent Surface 정렬

목표:

- AI 에이전트가 접근할 정식 surface 를 CLI 로 고정한다.

작업:

1. CLI 를 `shared runtime` wrapper 로 명확히 재정의
2. agent-facing contract 요구사항 정리
   - JSON output
   - dry-run
   - structured error
   - revision/conflict
   - changed set
3. direct DB patch / desktop IPC access 를 비권장 경로가 아니라 금지 경로로 명시
4. 기존 `ai-first-canonical-cli` 문서와 연결

종료 기준:

- AI 에이전트의 접근 권장 경로가 하나로 잠긴다.

Gate:

- 계약 gate: CLI surface 가 runtime contract 와 모순되지 않음

## Phase 2. Desktop Host-Owned Runtime 정렬

목표:

- desktop 의 runtime owner 를 renderer 밖으로 고정한다.

작업:

1. renderer 는 IPC client 라는 점을 명시
2. host/main process 가 runtime access 와 privileged integration owner 임을 명시
3. renderer direct runtime / DB ownership 금지
4. desktop lifecycle 과 workspace ownership 경계 문서화

종료 기준:

- desktop 에서 runtime access owner 가 host 라는 점이 문서상 명확하다.

Gate:

- 구조 gate: renderer responsibilities 와 host responsibilities 가 섞이지 않음

## Phase 3. Collaboration Event / Outbox 도입 기준 정리

목표:

- 멀티 클라이언트 협업의 기준점을 transport 가 아니라 collaboration event 로 재정의한다.

작업:

1. event log / outbox 최소 schema 수준 정의
   - `actorId`
   - `commandId`
   - `canvasId`
   - `canvasRevision`
   - `changedSet`
   - `timestamp`
2. invalidate relay 와 semantic event 의 관계 정의
3. same-origin ignore, replay, follow-up query 기준 정리
4. CLI / desktop / web 이 같은 event semantics 를 공유하도록 정리

종료 기준:

- "변경 반영" 이 더 이상 WS 자체에 묶여 설명되지 않는다.

Gate:

- 계약 gate: collaboration event 가 mutation result / revision contract 와 맞물려 있음

## Phase 4. Transport Demotion

목표:

- `HTTP/WS` 를 thin adapter 로 축소한다.

작업:

1. `runtimews-refactoring` 을 이 상위 구조의 Phase 4 slice 로 재해석
2. `HTTP/WS` ownership 금지 규칙 명시
3. mutate/query/invalidate 중 무엇을 transport 에 남길지 정리
4. desktop / CLI direct runtime path 와 web transport path 를 분리

종료 기준:

- `HTTP/WS` 는 남아도 core runtime 과 혼동되지 않는다.

Gate:

- 구조 gate: transport 가 runtime ownership 을 갖지 않음

## Phase 5. Integrated Compatibility Removal

목표:

- legacy file-first compatibility 를 이 문서 안의 하위 실행 단계로 제거한다.

작업:

1. compatibility inventory 확정
   - `filePatcher.ts`
   - `patchFile`, `patchNode*`
   - `resolveCanvasCompatibilityPath`
   - `baseVersion` file hash lock
   - `file.subscribe`, `file.changed`, `files.changed`
   - `sourceVersion`, `sourceVersions`
   - `compatibilityFilePath`, `compatibility-mutation`
2. import 차단
   - `filePatcher.ts` 직접 import 금지
   - `app/ws/shared/params.ts` 타입 의존 제거
3. 호출 경로 제거
   - runtime command 가 이미 있는 intent 부터 compatibility executor 제거
   - `baseVersion` file hash fallback 제거
4. watcher / file bridge 정리
   - `file.subscribe`, `file.unsubscribe` 소비자 분리
   - `file.changed`, `files.changed` 를 write correctness 에서 분리
5. UI / store / host contract 축소
   - `compatibilityFilePath`, `sourceVersion`, `sourceVersions` 제거
6. `filePatcher.ts` 삭제
   - 마지막 production import 제거 후 파일 삭제
7. compatibility 완료 정의 검증
   - production import 0건
   - `compatibility-mutation` 0건
   - runtime-only editing path 확인

종료 기준:

- compatibility 가 별도 폴더 문서 없이도 이 계획 안에서 구현 가능하게 정리된다.

Gate:

- 정적 gate: `filePatcher.ts` import 0건, `compatibility-mutation` 0건
- 계약 gate: `sourceVersion`, `compatibilityFilePath` public contract 제거
- 시나리오 gate: UI/CLI 편집, external invalidation, host create flow

## Phase 6. 검증 / 운영 posture 정리

목표:

- 최종 구조가 실제 운영 / 협업 관점에서 검증 가능하게 만든다.

작업:

1. CLI / desktop / web access path 별 검증 포인트 정의
2. collaboration event / invalidate 경로 검증 포인트 정의
3. 향후 optional daemon 승격 조건 기록
4. 문서 간 역할 분담과 우선순위 정리

종료 기준:

- 이후 구현자가 어떤 surface 를 어떤 순서로 정리해야 하는지 명확하다.

## 5. 하위 문서 정렬 원칙

### `runtimews-refactoring`

- 이 문서는 transport demotion slice 다.
- 질문은 "WS 를 남길 것인가" 가 아니라 "WS 가 ownership 을 가지는가" 여야 한다.

### `ai-first-canonical-cli`

- CLI 를 정식 agent surface 로 쓰는 contract 문서다.
- AI 는 desktop internal surface 가 아니라 CLI 로 접근해야 한다.

## 6. 검증 전략

### 6.1 구조 검증

- CLI 와 desktop 사이 직접 의존 없음
- renderer direct runtime ownership 없음
- `HTTP/WS` ownership 없음

### 6.2 계약 검증

- runtime contract 와 CLI contract 정렬
- collaboration event / mutation result / revision semantics 정렬
- compatibility removal 완료 정의와 상위 architecture 정렬

### 6.3 시나리오 검증

- AI agent 가 CLI 로 canvas 조회 / 수정 / dry-run / conflict 처리
- desktop renderer 가 host IPC 를 통해 동일 runtime 결과를 소비
- web / remote surface 가 adapter 로만 동작
- change event 가 서로 다른 surface 를 따라 invalidate 됨

## 7. 결론

이 구현 계획의 핵심은 단순하다.

- 코어는 `shared runtime + DB + event log`
- AI 는 `CLI`
- desktop 은 `host IPC`
- `HTTP/WS` 는 adapter
- compatibility removal 은 그 위의 하위 실행 단계

이 순서를 지키면 구조를 과도하게 뒤집지 않으면서도, AI 협업에 맞는 최종 runtime topology 로 수렴할 수 있다.
