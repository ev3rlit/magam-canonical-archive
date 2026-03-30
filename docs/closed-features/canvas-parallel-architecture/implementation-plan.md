# Canvas Parallel Architecture 구현 계획 (Command Router Only)

## 1. 목적

`/docs/features/canvas-parallel-architecture/README.md` 설계를 실제 코드로 옮기기 위한 실행 계획이다.

핵심 지표:

- `GraphCanvas.tsx` 중심 충돌 감소
- 기능 PR 로컬성 증가
- EventBus 없이 유지보수 단순성 확보

## 2. 구현 원칙

1. 상태 변경은 `CommandRouter.dispatch()`로만 수행한다.
2. feature는 `Ports`로만 읽기/쓰기한다.
3. feature 간 직접 import를 금지한다.
4. 중앙 수동 등록 파일을 없애고 generated registry를 사용한다.

## 3. 전체 페이즈 의존성

| Phase | 선행 Phase | 병렬 가능 | 병렬 레인 |
|------|------------|-----------|----------|
| 0. 계약 고정 | 없음 | 부분 가능 | A(contracts), B(CI skeleton) |
| 1. Core + Router 도입 | 0 | 부분 가능 | A(core split), B(router impl) |
| 2. Feature 분리 | 1 | 높음 | A(layout), B(context-menu), C(export), D(shortcuts) |
| 3. Registry 자동 생성 | 2 | 낮음 | A(generator), B(CI verify) |
| 4. 경계 강제 | 2,3 | 부분 가능 | A(ESLint), B(CI checks) |
| 5. 안정화/측정 | 4 | 가능 | A(test hardening), B(metrics) |

## 4. Phase 상세

## Phase 0. 계약 고정

### 구현 파일

- `/app/components/canvas/contracts/commands.ts`
- `/app/components/canvas/contracts/ports.ts`
- `/app/components/canvas/contracts/canvas-feature.ts`

### 구현 방법

1. command 유니온 타입을 정의한다.
2. ports read/write 인터페이스를 정의한다.
3. feature `mount/unmount` 계약을 정의한다.
4. command 네임스페이스 규칙(`domain.action`)을 문서화한다.

### 명시적 테스트

- `contracts/commands.test.ts`
  - command payload 누락 타입 실패 확인(tsd 또는 tsc fixture)
  - command type 중복 금지 규칙 확인
- `contracts/ports.test.ts`
  - 필수 포트 누락 시 타입 실패 확인

### 병렬 처리

- 가능:
  - 레인 A: command/ports 타입 정의
  - 레인 B: CI에서 `tsc --noEmit` 계약 검증 파이프라인 준비
- 동기화 지점:
  - command type 네이밍 최종 확정 1회

### 완료 기준

1. contracts 변경 없이 feature 스켈레톤 추가 가능
2. 타입 체크 통과

## Phase 1. Core + Router 도입

### 구현 파일

- `/app/components/canvas/core/GraphCanvasShell.tsx`
- `/app/components/canvas/core/GraphViewport.tsx`
- `/app/components/canvas/core/FeatureHost.tsx`
- `/app/components/canvas/runtime/command-router.ts`
- `/app/components/canvas/runtime/create-ports.ts`

### 구현 방법

1. 기존 `GraphCanvas.tsx`를 Shell/View로 분리한다.
2. `CommandRouter`를 생성한다.
   - `register(type, handler)` 구현
   - `dispatch(command)` 구현
   - 미등록 command 에러 처리 구현
3. router와 ports를 `FeatureHost`에서 생성/주입한다.
4. 기존 동작은 임시 core handler로 유지해 회귀를 막는다.

### 명시적 테스트

- `runtime/command-router.test.ts`
  - 등록된 handler 1회 호출
  - 미등록 command 에러
  - 중복 handler 등록 에러
  - handler 실패 전파
- `core/GraphCanvasShell.test.tsx`
  - 기존 렌더 동작 동일성(snapshot 또는 interaction)

### 병렬 처리

- 가능:
  - 레인 A: core 파일 분리
  - 레인 B: command-router 구현 및 테스트
- 주의:
  - 최종 통합은 한 PR에서 합치지 말고 PR 2개로 분리 후 순차 머지

### 완료 기준

1. GraphCanvas가 router/ports를 생성해 feature host에 주입
2. 기존 UX 회귀 없음

## Phase 2. Feature 분리

### 공통 구현 규칙

1. feature 폴더 외 파일 수정 금지
2. feature 내부에서 store direct access 금지
3. 상태 변경은 command dispatch만 사용

### Phase 2-1 layout

#### 구현 파일

- `/app/components/canvas/features/layout/feature.ts`
- `/app/components/canvas/features/layout/commands.ts`

#### 구현 방법

1. 기존 layout effect를 feature mount 로직으로 이동
2. `layout.run` command handler 등록
3. 레이아웃 결과 반영은 `ports.write.setNodes`만 사용

#### 명시적 테스트

- `features/layout/feature.test.ts`
  - 그래프 로드 시 `layout.run` dispatch
  - 레이아웃 완료 시 `setNodes` 호출
  - 조건 미충족 시 미실행

#### 병렬 처리

- 독립 병렬 가능 (레인 A)

### Phase 2-2 context-menu

#### 구현 파일

- `/app/components/canvas/features/context-menu/feature.ts`
- `/app/components/canvas/features/context-menu/commands.ts`

#### 구현 방법

1. 메뉴 open/close 로직 이동
2. 메뉴 액션을 command dispatch로 변환
3. UI 상태는 ports.write API로만 처리

#### 명시적 테스트

- `features/context-menu/feature.test.ts`
  - node/pane context별 메뉴 분기
  - action 클릭 시 command dispatch
  - handler 실패 시 메뉴 close 보장

#### 병렬 처리

- 독립 병렬 가능 (레인 B)

### Phase 2-3 export

#### 구현 파일

- `/app/components/canvas/features/export/feature.ts`
- `/app/components/canvas/features/export/commands.ts`

#### 구현 방법

1. export dialog 상태 제어를 command로 통합
2. clipboard/download 흐름을 feature 내부로 이동
3. 실패 에러는 core가 아닌 feature에서 처리

#### 명시적 테스트

- `features/export/feature.test.ts`
  - `export.dialog.open` command 처리
  - copy/download 성공/실패 분기
  - selection/full 영역 분기

#### 병렬 처리

- 독립 병렬 가능 (레인 C)

### Phase 2-4 shortcuts

#### 구현 파일

- `/app/components/canvas/features/shortcuts/feature.ts`
- `/app/components/canvas/features/shortcuts/commands.ts`

#### 구현 방법

1. window keydown 리스너를 feature로 이동
2. 단축키 동작은 command dispatch로만 연결
3. input/textarea/contentEditable 예외 처리 유지

#### 명시적 테스트

- `features/shortcuts/feature.test.ts`
  - 단축키 입력 시 command dispatch
  - 입력 포커스 시 무시
  - unmount 시 listener 해제

#### 병렬 처리

- 독립 병렬 가능 (레인 D)

### Phase 2 완료 기준

1. `GraphCanvas`에서 layout/context-menu/export/shortcut 로직 제거
2. 기능별 PR이 각 feature 폴더 중심으로 분리

## Phase 3. Registry 자동 생성

### 구현 파일

- `/scripts/generate-canvas-features.ts`
- `/app/components/canvas/registry/generated-features.ts`

### 구현 방법

1. `features/*/index.ts`를 스캔한다.
2. deterministic 정렬로 generated registry 생성
3. `FeatureHost`는 generated 파일만 import

### 명시적 테스트

- `scripts/generate-canvas-features.test.ts`
  - 스캔 결과 안정적 정렬 확인
  - 누락/중복 feature 감지 확인
- CI check:
  - 생성 후 git diff가 비어있는지 검증

### 병렬 처리

- 부분 병렬:
  - 레인 A: generator 구현
  - 레인 B: CI verify step 구현

### 완료 기준

1. 수동 registry 편집 없이 feature 추가 가능
2. CI에서 generated drift 자동 검출

## Phase 4. 경계 강제

### 구현 파일

- `/eslint.config.mjs` (boundary rule)
- `/scripts/check-canvas-boundary.ts`
- `/scripts/check-command-catalog.ts`

### 구현 방법

1. feature 간 import 금지 룰 추가
2. feature에서 `useGraphStore.getState` 사용 금지 룰 추가
3. command type 중복/미사용 handler 체크 스크립트 추가

### 명시적 테스트

- `scripts/check-canvas-boundary.test.ts`
  - 위반 샘플에서 실패 확인
- `scripts/check-command-catalog.test.ts`
  - 중복 command 선언 시 실패 확인
- CI job:
  - `bun test`
  - `bun run lint` (또는 lint equivalent)
  - boundary/check scripts 실행

### 병렬 처리

- 부분 병렬:
  - 레인 A: lint 규칙
  - 레인 B: check 스크립트

### 완료 기준

1. 규칙 위반 PR은 CI에서 차단
2. router 우회 코드가 main에 머지되지 않음

## Phase 5. 안정화 및 충돌 지표 운영

### 구현 파일

- `/docs/history/<date>/canvas-parallel-metrics.md`

### 구현 방법

1. PR 충돌 지표 수집 기준 정의
2. 기능별 PR 로컬성 지표 수집
3. 월간 core 변경 횟수 추적

### 명시적 테스트/검증

- 주간 검증:
  - 충돌 발생 횟수
  - feature 폴더 외 수정 비율
- 회귀 검증:
  - `bun test`
  - `bun run test:e2e` 주요 플로우

### 병렬 처리

- 가능:
  - 레인 A: 지표 수집
  - 레인 B: 회귀 테스트 강화

### 완료 기준

1. 동일 파일 충돌 주당 1회 이하
2. feature 중심 PR 비율 80% 이상

## 5. PR 분할 전략

1. PR-1: contracts + router
2. PR-2: core split
3. PR-3~6: feature별 분리(layout/context-menu/export/shortcuts)
4. PR-7: registry generator
5. PR-8: lint/CI 경계 강제

각 PR은 300~500 LOC 범위를 목표로 유지한다.

## 6. 롤백 전략

1. feature 단위 롤백 가능하도록 adapter별 플래그 유지
2. router 장애 시 임시 core fallback handler 활성화
3. registry 생성 실패 시 이전 generated 파일 사용

