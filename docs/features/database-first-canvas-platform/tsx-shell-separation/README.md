# TSX Shell Separation

작성일: 2026-03-23  
상태: Draft  
범위: `database-first-canvas-platform` 개선 작업  
목표: workspace-local canonical DB를 기준 저장소로 삼고, 남아 있는 TSX shell runtime 경로를 분리한다.
참조: `TASKS.md`, `IMPLEMENT_PLAN.md`

## 1. 현재 문제 상황

코드베이스에는 두 개의 경로가 동시에 존재한다.

- canonical DB 기반 경로
  - `libs/shared/src/lib/canonical-persistence/*`
  - `libs/shared/src/lib/canonical-query/*`
  - `libs/shared/src/lib/canonical-mutation/*`
  - `app/features/editing/actionRoutingBridge/*`
  - `app/processes/canvas-runtime/bindings/*`
- legacy TSX shell 경로
  - `libs/shared/src/lib/workspace-shell.ts`
  - `app/app/api/documents/route.ts`
  - `libs/cli/src/server/http.ts`
  - `app/ws/server.ts`
  - `app/features/editor/pages/CanvasEditorPage.tsx`
  - `app/hooks/useFileSync.ts`

이 상태에서 다음 문제가 발생한다.

1. 새 캔버스를 생성하면 여전히 `untitled-*.graph.tsx` 문서가 만들어진다.
2. workspace document list가 canonical DB가 아니라 파일 시스템의 `.tsx` 스캔 결과를 기준으로 동작한다.
3. editor render 진입이 `filePath -> /api/render` 중심이라 canonical document identity와 분리된다.
4. WebSocket file sync가 `.tsx` watcher를 기준으로 움직여 canonical mutation/query 경계와 충돌한다.
5. 같은 문서를 서로 다른 key로 바라보면 `setGraph()`가 반복 호출되고, 그 결과 `GraphCanvas`의 layout reset이 연속으로 발생할 수 있다.

즉 현재 문제는 “DB-first 합의가 없었다”가 아니라, “DB-first foundation은 존재하지만 사용자 진입 shell이 아직 TSX-first에 묶여 있다”는 점이다.

## 2. 왜 지금 분리해야 하는가

workspace-local canonical DB를 문서의 기준 저장소로 삼기로 이미 합의했고, 관련 foundation도 구현되어 있다.

하지만 런타임 shell이 아직 TSX를 canonical document source처럼 취급하면 다음 문제가 계속 남는다.

- 새 문서 생성과 실제 canonical document lifecycle이 분리된다.
- editor/runtime/query/mutation 경계가 file path에 끌려다닌다.
- app-global workspace/session state와 document authoring model이 서로 다른 저장 원칙을 가진다.
- TSX watcher와 canonical mutation이 동시에 존재하면서 상태 동기화가 불안정해진다.

따라서 이번 개선의 목적은 “TSX를 즉시 전부 삭제한다”가 아니라, “TSX shell이 더 이상 canonical 경로를 대표하지 못하게 분리한다”는 것이다.

## 3. 개선 방향

핵심 방향은 아래와 같다.

### 3.1 문서 canonical source를 workspace-local DB로 고정

- 새 문서 생성
- 문서 목록 조회
- 최근 문서/활성 문서 복원
- editor render 입력

위 흐름은 file path가 아니라 canonical document identity를 기준으로 움직여야 한다.

### 3.2 TSX는 compatibility layer로 강등

TSX는 당장 제거 대상이 아니라 compatibility/import/export 경로로 낮춘다.

- legacy document import
- transitional render source materialization
- 일부 dev/debug tooling

이 범위 밖에서는 TSX를 문서의 기준 저장소로 취급하지 않는다.

### 3.3 shell 경계를 재정의

현재 `workspace-shell.ts`는 사실상 “workspace + documents + file system”를 함께 소유한다.

개선 후에는 이를 분리한다.

- workspace shell
  - workspace registration, probe, reconnect, browser reveal
- document shell
  - canonical document list/create/open
- compatibility file shell
  - legacy TSX discovery/materialization only

### 3.4 editor/runtime는 canonical document key를 사용

`CanvasEditorPage`, `useFileSync`, `/api/render`, WS sync는 모두 같은 문서 key를 봐야 한다.

최종적으로는 다음 방향으로 수렴해야 한다.

- `documentId` 또는 canonical document reference가 primary key
- `filePath`는 optional compatibility metadata

## 4. 이번 개선에서 다루는 범위

실행 순서(계약):  
1) canonical document shell 기반 생성/조회 정착  
2) route/host 경로 재사용 정렬  
3) editor/runtime key 수렴  
4) TSX watcher compatibility 경계 분리  
5) chat scope-off

이번 작업은 아래를 우선 대상으로 한다.

1. 새 문서 생성 경로를 canonical DB 기준으로 전환
2. workspace document list를 canonical query 기준으로 전환
3. editor 진입/restore key를 canonical document 기준으로 전환
4. TSX-only watcher와 file scan 경로를 canonical shell 뒤로 숨기거나 compatibility layer로 분리
5. TSX shell 잔존 경로를 식별하고 runtime critical path에서 제거
6. 더 이상 사용하지 않는 chat 기능을 이번 개선 범위에서 스펙오프하고, 후속 제거 대상으로 명시

## 5. 비범위

이번 작업에서 바로 하지 않는 것:

1. repository 전체에서 `.tsx` 문자열을 일괄 제거
2. chat/prompt-builder/standalone CLI tooling의 TSX 입력까지 한 번에 재설계
3. import/export UX를 동시에 완성
4. plugin runtime asset packaging 전체를 canonical document model로 즉시 통합

주의:

- chat 기능 자체는 이번 개선에서 더 이상 제품 기능으로 취급하지 않는다.
- 다만 코드 제거는 TSX shell 분리의 핵심 경로를 안정화한 뒤, 별도 정리 단계에서 수행한다.

## 6. 성공 기준

다음이 만족되면 이 개선은 성공이다.

1. 새 캔버스 생성이 더 이상 `untitled-*.graph.tsx`를 canonical 문서처럼 만들지 않는다.
2. workspace detail의 document list가 file system scan이 아니라 canonical query 결과를 기준으로 나온다.
3. editor 진입 후 동일 문서가 반복 re-render/reset 되지 않는다.
4. `GraphCanvas`의 layout reset은 실제 새 canonical graph 로드 시점에만 발생한다.
5. TSX는 있어도 compatibility path로만 남고, primary authoring/runtime shell에서는 기준 소스가 아니다.
