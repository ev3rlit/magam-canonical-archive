# RuntimeWS Refactoring 구현 계획서

## 1. 문서 목적

이 문서는 `runtimews-refactoring/README.md` 의 방향을 실제 구현 순서로 압축한 실행 계획이다.

- 기준 문서: `docs/features/m2/runtimews-refactoring/README.md`
- 상위 기준점: `docs/features/m2/canvas-runtime-contract/README.md`
- 관련 분석: `docs/bottleneck/runtime-read-write-boundary.md`

핵심은 `shared runtime` 을 흔들지 않으면서, `RuntimeWS` 주변의 과잉 책임과 중복 계층을 줄이는 것이다.

## 2. 구현 원칙

1. `runtime` 은 코어로 유지한다.
2. 현재 `methods.ts` 는 최종적으로 `routes.ts` 로 수렴시키고, 라우트 연결 파일 역할만 남긴다.
3. mutate / query / subscription 은 기술 축이 아니라 도메인 안의 operation 으로 정리한다.
4. RPC 규약은 transport 와 별개로 통일한다.
5. compatibility patch 는 primary write owner 가 아니라 adapter 로 후퇴시킨다.
6. client / WS / runtime 중복 변환은 shared codec 또는 shared helper 로 수렴시킨다.
7. 한 번에 전체를 뒤집지 않고 vertical slice 로 줄인다.

## 3. 현재 기준점

### 이미 있는 것

- shared runtime contracts
  - `libs/shared/src/lib/canvas-runtime/contracts/*`
- runtime mutation / projection baseline
  - `dispatchCanvasMutation`
  - `buildRenderProjection`
  - `buildEditingProjection`
  - `buildHierarchyProjection`
- WS subscription baseline
  - `canvas.subscribe`
  - `file.subscribe`
  - `canvas.changed`
  - `file.changed`

### 현재 병목

- `app/ws/methods.ts`
  - transport, rpc parsing, handler, compatibility bridge 가 한 파일에 몰려 있음
- `app/ws/filePatcher.ts`
  - compatibility patch 가 여전히 core write path 처럼 보임
- `app/hooks/useCanvasRuntime.ts`
  - command payload / content / placement 변환이 client 에 남아 있음
- `parseRenderGraph.ts`, `aliasNormalization.ts`
  - read 쪽에도 중복 변환이 큼

## 4. 목표 결과물

이 리팩터링이 끝났을 때 기대하는 결과는 다음과 같다.

1. 최종적으로 `routes.ts` 는 도메인별 RPC 메서드를 연결하는 얇은 파일이 된다.
2. RPC 메서드가 도메인 단위 handler 로 정리되고, mutate/query/subscription 은 그 안의 operation 으로 배치된다.
3. WS 는 subscription 중심으로 역할이 좁아지고, full-RPC 허브 성격이 약해진다.
4. compatibility patch 는 shrinking adapter 로 위치가 명확해진다.
5. command / payload / result 변환 규칙이 shared layer 로 수렴한다.

## 5. 목표 파일 구조와 변경 목록

이 작업은 단순히 "코드를 나눈다" 수준이 아니라, 최종적으로 어떤 파일이 남고 어떤 파일이 사라지는지까지 명확해야 한다.

### 5.1 최종 목표 파일 구조

```text
app/ws/
  routes.ts
  server.ts
  rpc.ts
  messages.ts
  filePatcher.ts
  handlers/
    canvasHandlers.ts
    workspaceHandlers.ts
    appStateHandlers.ts
    compatibilityHandlers.ts
    historyHandlers.ts
  shared/
    params.ts
    errors.ts
    responses.ts
```

### 5.2 추가될 파일

- `app/ws/routes.ts`
- `app/ws/handlers/canvasHandlers.ts`
- `app/ws/handlers/workspaceHandlers.ts`
- `app/ws/handlers/appStateHandlers.ts`
- `app/ws/handlers/compatibilityHandlers.ts`
- `app/ws/handlers/historyHandlers.ts`
- `app/ws/shared/params.ts`
- `app/ws/shared/errors.ts`
- `app/ws/shared/responses.ts`

MVP 에서 이 파일들의 책임은 아래처럼 고정한다.

- `app/ws/routes.ts`
  - route registry 전용 파일
  - `handlers/*`, `rpc.ts`, `shared/*` 이외의 구체 구현에 직접 의존하지 않음
- `app/ws/handlers/canvasHandlers.ts`
  - canvas mutate / projection / subscribe
  - runtime mutation / projection 사용 가능
  - `filePatcher.ts` 직접 import 금지
- `app/ws/handlers/workspaceHandlers.ts`
  - workspace surface 전용
- `app/ws/handlers/appStateHandlers.ts`
  - app-state surface 전용
- `app/ws/handlers/compatibilityHandlers.ts`
  - file patch / file subscribe / file changed bridge
  - `filePatcher.ts` import 허용
- `app/ws/handlers/historyHandlers.ts`
  - undo / redo / revision 관련 runtime API 전용

테스트도 가능하면 같은 기준으로 추가한다.

- `app/ws/routes.test.ts`
- `app/ws/handlers/canvasHandlers.test.ts`
- `app/ws/handlers/compatibilityHandlers.test.ts`

### 5.3 축소 또는 이름 변경될 파일

- `app/ws/methods.ts`
  - 최종적으로 `app/ws/routes.ts` 로 대체
- `app/ws/methods.test.ts`
  - `routes.test.ts` 및 도메인 handler 테스트로 분해
- `app/ws/methods.mutex.test.ts`
  - `compatibilityHandlers.test.ts` 또는 전용 helper 테스트로 이동

### 5.4 유지될 파일

- `app/ws/server.ts`
- `app/ws/rpc.ts`
- `app/ws/messages.ts`
- `app/ws/filePatcher.ts`

단, `filePatcher.ts` 는 남더라도 역할이 바뀌어야 한다.

- 지금: broad write owner
- 목표: compatibility adapter

## 6. 구현 범위 분해

## Phase 0. RPC 표면 분해 기준과 네이밍 고정

목표:

- 지금의 `methods.ts` 를 어떤 도메인으로 쪼갤지, 그리고 최종 파일 이름을 `routes.ts` 로 가져갈지 먼저 고정한다.

작업:

1. 현재 RPC 메서드 inventory 정리
2. 도메인 분류 고정
   - `canvas`
   - `workspace`
   - `appState`
   - `compatibility`
   - `history` 또는 `runtimeSession`
3. 공통 parsing / validation / error mapping 경계 정의
4. route registry shape 정의
5. `methods.ts -> routes.ts` 네이밍 전환 기준 확정

수정 범위:

- `docs/features/m2/runtimews-refactoring/README.md`
- 필요 시 보조 문서 추가

종료 기준:

- 새 폴더 구조와 메서드 소유권이 더 이상 애매하지 않다.

## Phase 1. `methods.ts` 를 `routes.ts` 방향의 route registry 로 축소

목표:

- 메서드 구현을 도메인별 파일로 분리하고, 현재 `methods.ts` 를 최종적으로 `routes.ts` 가 될 수 있는 연결 파일 구조로 바꾼다.

작업:

1. 공통 helper 분리
   - params parsing
   - common error mapping
   - rootPath / canvasId / commandId helper
2. 도메인 handler 파일 추가
   - `canvasHandlers`
   - `workspaceHandlers`
   - `appStateHandlers`
   - `compatibilityHandlers`
   - 필요 시 `historyHandlers` 또는 `runtimeSessionHandlers`
3. `methods.ts` 는 registry merge 만 담당하도록 축소
4. 구조가 안정되면 파일명을 `routes.ts` 로 변경

수정 범위:

- `app/ws/methods.ts`
- `app/ws/routes.ts`
- `app/ws/handlers/*Handlers.ts`
- `app/ws/shared/*.ts`

종료 기준:

- `methods.ts` 에서 구체 메서드 구현 비중이 크게 줄고, 도메인별 파일에서 책임이 보인다.
- 파일명 변경 시점에는 `routes.ts` 만 보고도 라우트 연결 파일이라는 의도가 명확하다.
- `routes.ts` 가 handler 생성/합성은 할 수 있지만, runtime/file patch 구현을 다시 끌어안지 않는다.

## Phase 2. 도메인 handler 안에서 operation 경계 정리

목표:

- full-RPC 성격을 약화시키고, 각 도메인 안에서 operation 의도를 분명하게 나눈다.

작업:

1. `canvasHandlers` 안에 canvas mutate / snapshot query / canvas subscribe 경계 정리
2. `workspaceHandlers` 안에 workspace query / mutation 경계 정리
3. `appStateHandlers` 안에 app-state query / update 경계 정리
4. `compatibilityHandlers` 안에 file patch / file subscribe / file change bridge 경계 정리
5. `historyHandlers` 또는 `runtimeSessionHandlers` 안에 undo / redo / revision 관련 경계 정리
6. 공통 RPC envelope 와 method naming 일관성 점검

수정 범위:

- `app/ws/*Handlers.ts`
- `app/hooks/useCanvasRuntime.ts`

종료 기준:

- 파일만 봐도 각 메서드가 어느 도메인 소유인지 바로 구분되고, mutate/query/subscribe 는 그 도메인 안에서 읽힌다.

## Phase 3. compatibility patch 의 역할 격하

목표:

- compatibility patch 를 primary write owner 가 아닌 adapter 로 재배치한다.

작업:

1. runtime mutation 과 compatibility patch 호출 지점 분리
2. compatibility patch 적용 조건 명확화
3. code path 상에서 runtime success 이후 secondary adapter 로 보이게 정리
4. diagnostics / history / provenance 에서 runtime 을 기준점으로 맞춤

수정 범위:

- `app/ws/routes.ts` 또는 분리된 runtime/file handler
- `app/ws/filePatcher.ts`

종료 기준:

- 변경의 진실이 runtime 임이 코드 구조상 드러난다.

## Phase 4. 중복 변환 로직 shared layer 로 수렴

목표:

- client / WS / runtime 에 흩어진 의미 변환을 한곳으로 줄인다.

작업:

1. 중복 변환 목록 확정
   - placement
   - content kind
   - body block
   - source identity
2. shared codec/helper 추가
3. `useCanvasRuntime.ts` 와 WS handler 에서 중복 로직 제거
4. parser/read 쪽 thin adapter 기준 정리

수정 범위:

- `app/hooks/useCanvasRuntime.ts`
- `app/ws/*Handlers.ts`
- shared helper / codec 파일

이번 세션에서 우선 수렴할 canonical transform inventory:

1. create placement
   - `useCanvasRuntime.ts`
   - `app/ws/handlers/canvasHandlers.ts`
2. object content update payload
   - `useCanvasRuntime.ts`
   - `app/ws/handlers/canvasHandlers.ts`
3. presentation-style patch mapping
   - `useCanvasRuntime.ts`
   - `app/ws/handlers/canvasHandlers.ts`
4. object body block insert payload
   - `useCanvasRuntime.ts`
   - `app/ws/handlers/canvasHandlers.ts`
5. legacy explicit content inference
   - `app/features/render/parseRenderGraph.ts`
   - `app/features/render/aliasNormalization.ts`

적용 기준:

- runtime-side mutation transform 은 `app/ws/shared/runtimeTransforms.ts` 로 수렴
- render-side legacy content inference 는 `aliasNormalization.ts` export helper 를 기준점으로 맞춤
- parser 는 render canonical boundary 를 재사용하고, WS helper 를 직접 참조하지 않음

종료 기준:

- 동일한 의미 변환 규칙이 한 곳에만 존재한다.

## Phase 5. subscription-only WS 방향 정리

목표:

- WS 를 앞으로 subscription 중심으로 유지할 수 있게 역할을 축소한다.

작업:

1. 어떤 mutate/query 가 WS 에서 꼭 남아야 하는지 재검토
2. subscription 채널과 request/response 채널 경계 문서화
3. 향후 HTTP 또는 다른 transport 로 이동 가능한 surface 식별

수정 범위:

- `app/ws/server.ts`
- `app/hooks/useCanvasRuntime.ts`
- 관련 문서

종료 기준:

- WS 의 존재 이유가 `subscription` 으로 설명 가능해진다.

## 7. 검증 계획

이 작업은 "대충 잘 나뉜 것처럼 보인다" 로 끝내면 안 된다.  
아래 항목을 모두 만족해야 구조 변경이 실제로 이루어졌다고 볼 수 있다.

### 7.1 파일 구조 검증

반드시 확인할 것:

1. `app/ws/methods.ts` 가 제거되었거나 더 이상 주 진입 파일이 아니다.
2. `app/ws/routes.ts` 가 존재한다.
3. `app/ws/handlers/` 폴더가 존재한다.
4. 최소한 아래 파일이 존재한다.
   - `canvasHandlers.ts`
   - `workspaceHandlers.ts`
   - `appStateHandlers.ts`
   - `compatibilityHandlers.ts`
   - `historyHandlers.ts` 또는 `runtimeSessionHandlers.ts`
5. `app/ws/shared/` 폴더가 존재하고 공통 helper 가 분리돼 있다.

### 7.2 라우팅 구조 검증

`routes.ts` 에서 확인할 것:

1. route table 만 정의하거나 registry 를 merge 한다.
2. `dispatchCanvasMutation`, `buildRenderProjection`, `filePatcher` 같은 구체 구현에 직접 깊게 의존하지 않는다.
3. 실제 구현은 `handlers/*` 로 위임한다.

### 7.3 레이어 의존성 검증

아래 규칙을 만족해야 한다.

1. `routes.ts`
   - `handlers/*`, `rpc.ts`, `shared/*` 만 참조한다.
2. `canvasHandlers.ts`
   - runtime mutation / runtime projections 를 사용할 수 있다.
   - `filePatcher.ts` 를 직접 참조하지 않는다.
3. `workspaceHandlers.ts`, `appStateHandlers.ts`
   - workspace/app-state 서비스만 참조한다.
   - runtime mutation 과 compatibility patch 둘 다 직접 소유하지 않는다.
4. `compatibilityHandlers.ts`
   - `filePatcher.ts` 를 참조할 수 있는 유일한 handler 다.
5. `historyHandlers.ts` 또는 `runtimeSessionHandlers.ts`
   - undo / redo / revision 관련 runtime API 만 다룬다.

즉 `filePatcher.ts` import 는 `compatibilityHandlers.ts` 로 수렴해야 하고, 다른 handler 들은 compatibility path 를 직접 참조하면 안 된다.

### 7.3.1 MVP 구조 메모

- 현재 inventory 에 workspace/app-state 전용 RPC surface 가 적더라도, `workspaceHandlers.ts` 와 `appStateHandlers.ts` 는 먼저 생성해 route ownership 을 명시한다.
- 비어 있는 registry 는 허용하지만, 기술 축 파일로 우회해서는 안 된다.
- plugin/runtime-session 처럼 경계가 애매한 surface 도 `projectionHandlers.ts` 같은 기술 기준 파일로 새로 빼지 않는다.

### 7.3.2 Subscription-First Guardrails

- `app/ws/routes.ts`
  - subscription routes 와 non-subscription routes 가 구분돼 보여야 한다.
  - transport가 개별 method 문자열을 하드코딩해 분기하지 않도록 route metadata/helper를 재사용한다.
- `app/ws/server.ts`
  - notification emission 은 canvas/file/files subscription fan-out helper 기준으로 정리한다.
  - watcher 경로와 command 경로 모두 같은 subscription matching 규칙을 사용한다.
- `app/hooks/useCanvasRuntime.ts`
  - active canvas subscription request 생성과 notification 처리 로직이 mutation/query helper 와 분리돼 있어야 한다.
  - active canvas 에 대해 `canvas.subscribe` 와 `file.subscribe` 를 함께 유지해 watcher 기반 변경도 받는다.
- `app/ws/shared/subscriptions.ts`
  - subscription method names, notification names, subscription key/matching 규칙의 기준점이 된다.

### 7.4 기능 검증

최소한 아래 기능은 계속 동작해야 한다.

1. canvas mutate
2. undo / redo
3. runtime projection 조회
4. canvas subscribe
5. file subscribe / file changed 알림
6. workspace probe / list / create
7. app-state workspaces / session / preferences / recent-canvases

### 7.5 중복 책임 검증

이 항목은 정성 검증이 아니라 실제 검색으로 확인한다.

- `sourceId`, `content kind`, `create placement`, `body block` 변환 로직이 client / WS / runtime 에 중복 정의되지 않았는지 검색
- `routes.ts` 가 helper/service 구현 파일처럼 커지지 않았는지 라인 수와 import 수 확인
- `filePatcher.ts` 가 runtime primary path 처럼 여러 handler 에서 호출되지 않는지 검색

예시 검증 방식:

- `rg "from './filePatcher' app/ws"`
- `rg "dispatchCanvasMutation|buildRenderProjection|buildEditingProjection" app/ws`
- `rg "sourceId|blockType|mindmap-child|mindmap-sibling" app/hooks app/ws libs/shared`

추천 구조 검증 명령:

```bash
rg -n "from '../filePatcher'|from './filePatcher'" app/ws
rg -n "canvas.subscribe|canvas.unsubscribe|file.subscribe|file.unsubscribe" app/ws/routes.ts app/ws/handlers
rg -n "canvas.changed|file.changed|files.changed" app/ws/server.ts app/hooks/useCanvasRuntime.ts
rg -n "dispatchCanvasMutation|buildRenderProjection|buildEditingProjection|filePatcher" app/ws/routes.ts app/ws/handlers app/ws/shared
bun test app/ws/routes.test.ts app/ws/handlers/compatibilityHandlers.test.ts app/ws/handlers/canvasHandlers.test.ts app/hooks/useCanvasRuntime.test.ts
```

## 8. 완료 기준

이 작업이 끝났다고 말하려면 아래가 확인돼야 한다.

1. `app/ws/routes.ts` 가 존재한다.
2. `app/ws/methods.ts` 는 제거되었거나 더 이상 구현 허브가 아니다.
3. RPC 메서드가 도메인 단위 handler 파일로 분리돼 있다.
4. `filePatcher.ts` 는 `compatibilityHandlers.ts` 를 통해서만 주로 접근된다.
5. canvas / workspace / appState / compatibility / history 소유권이 코드상 구분된다.
6. 중복 변환 로직이 shared helper 또는 codec 으로 줄어들었다.

## 9. 비목표

이번 리팩터링에서 바로 하지 않는 것:

1. shared runtime 제거
2. runtime contract 재설계 전체
3. web / desktop transport 완전 분리
4. parser / render path 전체 리라이트
5. AI CLI surface 구현 자체

이 문서의 목적은 transport 전쟁이 아니라, `shared runtime 중심 구조로 책임을 다시 정렬하는 것` 이다.

## 10. 한 줄 결론

이 리팩터링은 `WS 를 없애는 작업` 이 아니라, `shared runtime 을 중심으로 RuntimeWS 주변의 허브화와 중복 계층을 감량하는 작업` 이다.
