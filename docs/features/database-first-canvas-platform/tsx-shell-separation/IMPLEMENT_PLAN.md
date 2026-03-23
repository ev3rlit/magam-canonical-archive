# TSX Shell Separation Implementation Plan

작성일: 2026-03-23  
상태: Draft  
전제: workspace-local canonical DB가 문서 canonical source다.
참조: `README.md`, `TASKS.md`

## 1. 목표

남아 있는 TSX-first shell 경로를 runtime critical path에서 제거하고, workspace/document shell을 canonical DB 기준으로 재정렬한다.

이번 작업에서는 더 이상 사용되지 않는 chat 기능도 제품 범위에서 제외한다.

- chat은 앞으로 primary shell/runtime 설계의 제약 조건이 아니다.
- TSX shell 분리 작업은 chat compatibility를 보존하는 방향이 아니라, chat 제거를 허용하는 방향으로 진행한다.

## 2. 현재 런타임 충돌 지점

현재 우선 정리 대상은 아래다.

- `libs/shared/src/lib/workspace-shell.ts`
  - `.tsx` 스캔과 새 문서 생성이 canonical document shell 역할을 대신하고 있다.
- `app/app/api/documents/route.ts`
  - canonical query/create가 아니라 TSX shell helper를 사용한다.
- `libs/cli/src/server/http.ts`
  - file list/tree/document validation이 `**/*.tsx`와 `.tsx` 확장자 가정에 묶여 있다.
- `app/ws/server.ts`
  - watcher가 `.tsx` 변경만 publish한다.
- `app/features/editor/pages/CanvasEditorPage.tsx`
  - `/api/render`와 `currentFile` 중심으로 editor graph를 다시 구성한다.
- `app/hooks/useFileSync.ts`
  - file path subscribe를 primary sync surface로 사용한다.

## 3. 구현 단계

### Phase 1. Canonical document shell contract 고정

1. workspace-level canonical DB에서 문서 목록과 새 문서 생성을 수행하는 shared service를 만든다.
2. 이 service는 `workspace-shell.ts`와 분리된 별도 canonical document shell module로 둔다.
3. 입력/출력은 `documentId`, `workspaceId`, optional `filePath` metadata 기준으로 정리한다.

예상 산출물:

- `libs/shared/src/lib/canonical-document-shell/*`
- shared contract types

### Phase 2. Web/Desktop route 교체

1. `app/app/api/documents/route.ts`를 canonical document shell로 교체한다.
2. `libs/cli/src/server/http.ts`의 `/documents` 관련 경로도 같은 shared shell을 사용하게 맞춘다.
3. workspace detail/document list가 더 이상 TSX 스캔 결과를 기준으로 삼지 않게 한다.

핵심 원칙:

- route layer는 file scan/business rule을 직접 소유하지 않는다.
- web/desktop 모두 같은 canonical document shell을 재사용한다.

### Phase 3. Editor key 전환

1. `CanvasEditorPage`의 current document key를 canonical document reference 기준으로 재정의한다.
2. `setGraph()`를 유발하는 입력 경로가 같은 문서를 서로 다른 key로 보지 않게 정리한다.
3. 새 문서 생성 직후 open/restore/load가 같은 canonical key를 사용하게 한다.

여기서 확인할 것:

- `currentFile` 명명 자체가 더 이상 맞는지
- `sourceVersions`가 file path 맵으로 남아도 되는지
- `graphId` 재생성 조건이 과도하게 자주 발생하지 않는지

### Phase 4. TSX sync 경로 강등

1. `app/ws/server.ts`의 `.tsx` watcher를 canonical mutation/event stream 뒤로 내린다.
2. `useFileSync.ts`는 file subscribe 중심이 아니라 canonical mutation/query lifecycle 중심으로 이동시킨다.
3. TSX watcher는 legacy import/materialization용 compatibility 경로로만 남긴다.

### Phase 5. Compatibility boundary 명시

1. 남겨둘 TSX 경로와 제거할 TSX 경로를 분리한다.
2. compatibility 목적의 TSX usage는 코드상에서 이름과 책임을 명확히 드러낸다.
3. primary runtime에서 TSX를 canonical source처럼 다루는 코드는 제거한다.

### Phase 6. Chat scope-off and removal plan

1. 현재 renderer/desktop/backend에서 chat이 연결된 경로를 식별한다.
2. TSX shell 분리의 핵심 경로와 무관한 chat 의존은 적극적으로 제거한다.
3. 남아 있는 chat 모듈은 deprecated boundary로 격리하거나 후속 제거 작업으로 넘긴다.

우선 제거 후보:

- `app/features/host/rpc/*` 의 chat method surface
- `libs/cli/src/chat/*`
- `libs/cli/src/server/http.ts` 의 chat endpoints
- editor shell에서 chat panel을 여는 경로

## 4. 검증 계획

### 필수 회귀

1. workspace 생성 후 새 캔버스 생성
2. workspace detail에서 document list 표시
3. 새 캔버스 진입 직후 layout reset loop 미발생
4. editor 재진입 시 같은 canonical document 복원
5. web/desktop parity 유지

### 코드 레벨 검증

- new document route/unit tests
- canonical document shell tests
- editor restore/render key tests
- GraphCanvas layout reset regression tests
- desktop backend route parity tests

## 5. 리스크

### 5.1 file-path 중심 상태와 canonical document key의 혼재

현재 store와 editor는 `currentFile`, `sourceVersions`, `draftDocuments`처럼 file path 중심 state를 많이 갖고 있다.

이 부분을 한 번에 다 바꾸려 하면 범위가 커진다.  
따라서 단계적으로 바꾸되, primary key만 먼저 canonical document reference로 옮기는 전략이 필요하다.

### 5.2 render pipeline의 TSX 전제

현재 `/api/render`, transpiler, WS patcher 일부는 TSX를 직접 전제로 한다.

즉 이번 작업은 “문서 canonical source 전환”과 “render source materialization 전환”을 구분해서 다뤄야 한다.

### 5.3 compatibility layer의 무의식적 재침투

TSX compatibility helper를 남겨두더라도, 새 코드가 다시 그것을 primary shell처럼 부르면 같은 문제가 반복된다.

따라서 naming, module boundary, tests로 재침투를 막아야 한다.

### 5.4 chat 제거와 shell 분리의 충돌 가능성

chat endpoint와 backend lifecycle이 아직 동일 서버에 묶여 있으므로, 제거 순서를 잘못 잡으면 desktop/web parity 검증이 흔들릴 수 있다.

따라서 이번 개선에서는

- 먼저 chat을 제품 scope에서 제외하고
- shell critical path에서 chat 의존을 끊고
- 그 다음 endpoint/surface를 정리하는 순서가 필요하다.

## 6. 완료 기준

다음이 충족되면 완료로 본다.

1. 새 캔버스 생성이 canonical document shell을 통해 이루어진다.
2. workspace detail 문서 목록이 canonical query 기준으로 나온다.
3. editor가 canonical document key 기준으로 문서를 연다.
4. TSX shell은 primary runtime path에서 제거되거나 compatibility layer로 명확히 격리된다.
5. chat 기능은 더 이상 제품 shell의 전제 기능이 아니며, core runtime path가 chat 없이도 완결된다.
6. 새 그래프 load 시점 외의 layout reset loop가 재현되지 않는다.
