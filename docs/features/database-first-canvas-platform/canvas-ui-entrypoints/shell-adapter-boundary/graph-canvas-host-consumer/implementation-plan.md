# Graph Canvas Host Consumer 구현 계획서

## 1. 문서 목적

이 문서는 `GraphCanvas.tsx`를 toolbar/menu wiring owner가 아니라 host consumer로 축소한 adoption 내용을 정리한다.

- 기준 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/graph-canvas-host-consumer/README.md`
- 상위 문서: `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/shell-adapter-boundary/README.md`
- 직접 binding: `app/processes/canvas-runtime/bindings/graphCanvasHost.ts`

## 2. 이전 문제

이전 `GraphCanvas.tsx`는 아래를 함께 소유했다.

1. toolbar overlay contribution 생성
2. pane/node context menu action object 조립
3. pane/node context menu context shape 생성
4. feature surface별 `surfaceId`/`surface` payload 부착

이 구조에서는 후속 surface lane이 `GraphCanvas.tsx`를 계속 기본 수정 경로로 삼을 수밖에 없었다.

## 3. 현재 목표

1. `GraphCanvas.tsx`는 host event와 runtime state만 제공한다.
2. surface wiring은 `graphCanvasHost.ts` helper가 조립한다.
3. 후속 feature는 `GraphCanvas.tsx` 대신 자기 contribution 파일과 runtime binding을 중심으로 작업한다.

## 4. 핵심 결정

### 결정 1. context menu action 묶음은 binding이 만든다

`copyImageToClipboard`, `renameNode`, `createMindMapChild`, `createMindMapSibling` 같은 menu action wiring은 host binding helper가 조립한다.

### 결정 2. pane/node context는 binding helper로 생성한다

`GraphCanvas.tsx`는 우클릭 이벤트 좌표와 선택 상태를 넘기기만 하고, `ContextMenuContext` shape 자체는 binding이 만든다.

### 결정 3. toolbar overlay contribution도 host binding이 만든다

toolbar mount는 host가 하되, overlay contribution object 생성 책임은 binding으로 내린다.

## 5. 실제 모듈 배치

1. `app/processes/canvas-runtime/bindings/graphCanvasHost.ts`
2. `app/components/GraphCanvas.tsx`

## 6. Adoption 단계

### 단계 1. context menu action 조립 위임

- host가 필요 dependency를 모은다.
- binding이 `ContextMenuActionsContext`를 반환한다.

### 단계 2. pane/node context shape 생성 위임

- node menu용 selected ids normalization
- pane menu용 empty-surface context

### 단계 3. toolbar contribution 생성 위임

- host는 `FloatingToolbar` mount를 요청한다.
- overlay contribution의 세부 shape는 binding이 만든다.

## 7. 완료 정의

1. `GraphCanvas.tsx`가 새 surface wiring 분기의 기본 owner가 아니다.
2. toolbar/menu host wiring 변경은 우선 `graphCanvasHost.ts`에서 일어난다.
3. 후속 feature lane이 `GraphCanvas.tsx`를 건드려야 하는 경우가 줄어든다.
