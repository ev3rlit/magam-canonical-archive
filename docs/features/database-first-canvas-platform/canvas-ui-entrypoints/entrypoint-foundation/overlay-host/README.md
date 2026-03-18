# Overlay Host

## 개요

이 sub-slice는 canvas overlay의 공통 host를 담당한다.

## 범위

- overlay stacking
- portal layering
- positioning shell
- outside click / escape dismiss
- focus lifecycle

## 비범위

- selection 해석
- mutation dispatch
- surface별 버튼/메뉴 구성

## 완료 기준

- toolbar, floating menu, pane menu, node menu가 같은 overlay host 규칙을 재사용한다.

## 구현 계획

### Step 1. Host contract 고정

- overlay 종류를 `toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu` 슬롯으로 먼저 고정한다.
- host public surface는 `open`, `close`, `replace`, anchor, layer priority, dismiss reason, focus return target 정도로 제한한다.
- 후속 surface는 portal이나 DOM layering을 직접 소유하지 않고 host contribution contract만 제공한다.
- 권장 mount point는 `app/components/GraphCanvas.tsx`의 canvas shell 근처로 두고, `app/components/editor/WorkspaceClient.tsx`의 전역 dialog/search/tab menu는 이번 범위에서 제외한다.

### Step 2. Existing overlay behavior 흡수

- `app/components/ContextMenu.tsx`에 있는 portal, viewport clamp, outside click, Escape dismiss, 첫 actionable focus 규칙을 host primitive로 승격한다.
- `app/hooks/useContextMenu.ts`는 pane/node menu item 계산과 open state adapter 중심으로 축소한다.
- `app/components/GraphCanvas.tsx`에서 이미 떠 있는 bubble overlay, drag feedback, toast와의 z-index 관계를 먼저 고정한다.
- canvas 바깥 전역 overlay 패턴은 참고만 하고, v1 host는 canvas entrypoint overlay에만 집중한다.

### Step 3. Positioning / stacking 규칙 구현

- pane/node menu는 pointer anchor 기준, selection floating menu는 selection bounds 또는 anchor rect 기준, toolbar는 viewport 고정 슬롯 기준으로 배치한다.
- host가 viewport boundary clamp, safe margin, 필요 시 방향 전환(flip)을 공통 처리한다.
- 다중 overlay 동시 노출 시 우선순위는 host가 소유하고, surface는 자신의 레이어 우선순위를 선언만 한다.
- reopen 또는 target 변경 시 기존 overlay를 닫을지 교체할지 규칙을 host contract로 고정한다.

### Step 4. Dismiss / focus lifecycle 고정

- outside pointer, Escape, selection change, viewport teardown 같은 dismiss 원인을 명시적인 reason으로 다룬다.
- open 시 첫 actionable element 또는 지정 focus target으로 이동하고, close 시 trigger 또는 selection owner로 복귀한다.
- nested overlay가 필요해질 경우를 대비해 dismiss bubbling과 close ordering을 host가 소유한다.
- surface별 enable/disable 판단은 host가 아니라 `selection-context-resolver`, `action-routing-bridge`, `ui-runtime-state`가 계속 소유한다.

### Step 5. Surface 연결과 검증

- `canvas-toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu`가 host slot만 소비하도록 연결한다.
- pane menu와 node menu는 같은 dismiss/focus 규칙을 공유하고, selection floating menu는 anchor 이동에 따라 재배치돼야 한다.
- bubble overlay, drag feedback, toast와 시각적/z-index 충돌이 없어야 한다.
- 후속 surface 구현이 직접 `createPortal`과 전역 document listener를 중복 소유하지 않는 상태까지 정리한다.

## 예상 구현 접점

- `app/components/GraphCanvas.tsx`: canvas-level host mount와 overlay layer order
- `app/components/ContextMenu.tsx`: 기존 menu shell에서 host primitive로 추출할 동작
- `app/hooks/useContextMenu.ts`: pane/node menu contribution state adapter
- `app/components/editor/WorkspaceClient.tsx`: canvas 밖 전역 overlay와 경계 확인용 참고 지점

## 구현 상태

- `app/features/overlay-host/`에 host state, lifecycle, positioning, provider, slot registry를 추가했다.
- `app/components/GraphCanvas.tsx`는 canvas shell에서 `OverlayHostProvider`를 mount하고 toolbar를 host contribution으로 연다.
- `app/components/ContextMenu.tsx`는 더 이상 직접 `createPortal`이나 전역 document listener를 소유하지 않고, host가 렌더하는 menu surface primitive로 축소됐다.
- `app/hooks/useContextMenu.ts`는 pane/node menu item 계산과 open/replace/selection-change dismiss adapter 역할만 남는다.
- `selection-floating-menu`의 실제 consumer 구현은 후속 slice지만, `selection-bounds` anchor와 재배치 helper는 host contract에 포함됐다.

## 검증 메모

- `bun test app/features/overlay-host/state.test.ts app/features/overlay-host/positioning.test.ts app/features/overlay-host/lifecycle.test.ts app/features/overlay-host/context.test.tsx app/hooks/useContextMenu.test.ts app/components/GraphCanvas.test.tsx app/components/GraphCanvas.viewport.test.ts app/components/editor/WorkspaceClient.test.tsx`
  - 결과: `65 pass`, `0 fail`
- `bunx tsc --noEmit`
  - 결과: 통과
