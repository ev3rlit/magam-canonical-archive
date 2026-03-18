---
title: ADR-0007 Canvas Runtime Composition Root and Fixed Slots
date: 2026-03-18
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - canvas
  - runtime
  - composition
  - dependency-direction
aliases:
  - Canvas Runtime Composition Root ADR
  - Fixed Slot Contributions ADR
  - canvas runtime fixed slots ADR
---

# ADR-0007: Adopt Canvas Runtime Composition Root and Fixed Slot Contributions

## Context

`canvas-ui-entrypoints` 작업을 진행하면서 shared shell hot spot이 네 군데에 집중돼 있었다.

- `app/components/GraphCanvas.tsx`
- `app/components/FloatingToolbar.tsx`
- `app/hooks/useContextMenu.ts`
- `app/components/editor/WorkspaceClient.tsx`

이 파일들은 서로 다른 surface의 open/close, anchor, callback, intent wiring을 한데 들고 있었다. 그 결과 후속 surface slice를 병렬로 나눠도 결국 shared shell 파일을 먼저 수정해야 했고, owner 경계가 흐려졌다.

특히 다음 문제가 구조적으로 반복됐다.

1. feature contribution이 중앙 shared shell 파일을 통해서만 앱에 연결된다.
2. feature lane을 나눠도 merge hotspot이 줄지 않는다.
3. 각 surface가 자기 inventory나 action set을 소유하지 못하고 shell file branching으로 새 기능을 붙인다.

우리는 후속 `canvas-toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu` 작업이 자기 파일 중심으로 진행되도록 ownership을 재배치해야 했다.

## Decision Drivers

- shared shell file의 merge hotspot을 줄일 것
- feature ownership을 surface별 contribution 파일로 옮길 것
- dependency direction을 `processes -> features contributions` 형태로 명확히 할 것
- 중앙 registry 하나를 계속 같이 편집하지 않게 할 것
- 후속 lane이 자기 inventory/model만 주로 수정하게 만들 것

## Decision

`app/processes/canvas-runtime`를 새 composition root로 도입하고, surface contribution은 고정 slot 경로를 통해 조립한다.

구체적으로는 다음을 채택한다.

1. `app/processes/canvas-runtime/types.ts`가 runtime contribution, slot, binding contract를 소유한다.
2. `app/processes/canvas-runtime/createCanvasRuntime.ts`가 built-in surface contribution을 하나의 runtime object로 조립한다.
3. built-in slot은 고정 경로 contribution을 소비한다.
4. 각 surface는 중앙 register 대신 자기 `contribution.ts`만 채운다.

고정 경로는 다음과 같다.

- `app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.ts`
- `app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.ts`
- `app/features/canvas-ui-entrypoints/pane-context-menu/contribution.ts`
- `app/features/canvas-ui-entrypoints/node-context-menu/contribution.ts`

## Decision Details

### Composition Root Ownership

`processes/canvas-runtime`는 아래 책임만 소유한다.

- contribution contract
- built-in slot wiring
- shared shell binding contract
- runtime assembly

feature inventory와 feature-specific logic는 이 레이어에 넣지 않는다.

### Fixed Slot Strategy

중앙 `registerBuiltInCanvasFeatures.ts` 같은 단일 registry 파일을 두지 않는다.

대신 runtime은 미리 정해진 고정 경로만 import한다. 이 방식은 이후 parallel lane이 중앙 파일을 다시 수정하지 않도록 강제한다.

### Placeholder Contribution

후속 lane 전까지도 runtime assembly가 안전하게 동작하도록 placeholder contribution export를 둔다.

- toolbar, selection-floating-menu는 명시적 no-op placeholder
- pane/node context menu는 기존 inventory를 유지하는 placeholder

이렇게 해서 새 runtime 구조를 먼저 열되, 기존 pane/node menu behavior는 깨지지 않게 한다.

## Alternatives Considered

### A. 기존 shared shell file에 surface wiring을 계속 추가한다

- 장점: 초기 구현이 빠르다.
- 단점: merge hotspot이 계속 커진다.
- 단점: feature ownership이 shared shell 내부 branching에 남는다.
- 결론: 비채택

### B. 중앙 register 파일 하나로 contribution을 모두 수집한다

- 장점: runtime assembly가 보기에는 단순하다.
- 단점: 후속 lane이 다시 같은 register 파일을 함께 편집하게 된다.
- 결론: 비채택

### C. `processes/canvas-runtime` + fixed slot contributions (채택)

- 장점: composition root와 feature owner 경계가 분리된다.
- 장점: surface lane이 자기 contribution 파일 중심으로 작업할 수 있다.
- 장점: shared shell 파일의 구조 변경을 one-time adoption으로 제한할 수 있다.
- 결론: 최종 채택

## Consequences

### Positive

- 후속 surface slice는 `GraphCanvas.tsx` 등 shared shell file보다 자기 `contribution.ts`와 feature-owned 파일을 주로 수정한다.
- runtime assembly 책임이 `processes/canvas-runtime`로 명확하게 이동한다.
- fixed slot 구조 덕분에 중앙 registry 재수정이 줄어든다.
- pane/node inventory, selection menu, toolbar section 같은 surface contribution이 독립 owner를 가진다.

### Negative

- placeholder contribution과 built-in slot 파일이 추가돼 초기 구조가 늘어난다.
- `processes/canvas-runtime`가 잘못 관리되면 또 다른 giant module이 될 수 있다.
- runtime contract 변경이 여러 surface lane에 파급될 수 있다.

## Follow-up

1. 후속 surface slice 문서는 자기 `contribution.ts`를 첫 산출물로 요구해야 한다.
2. shared shell file에서 direct surface branching이 다시 늘어나지 않도록 review rule을 유지한다.
3. runtime slot contract regression은 테스트로 계속 고정한다.

## Related Decisions

- ADR-0005: database-first canvas platform의 상위 방향을 정의한다.
- ADR-0008: shared shell file을 runtime binding consumer로 바꾸는 one-time adoption 결정을 기록한다.
- ADR-0009: keyboard hot spot도 같은 boundary 원칙으로 분리하는 후속 결정을 기록한다.
