---
title: ADR-0008 Shared Shell One-Time Adoption via Runtime Bindings
date: 2026-03-18
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - canvas
  - bindings
  - shell
  - maintenance
aliases:
  - Shared Shell Binding Adoption ADR
  - GraphCanvas Host Boundary ADR
  - one-time shell adoption ADR
---

# ADR-0008: Convert Shared Shell Files to One-Time Runtime Binding Consumers

## Context

ADR-0007이 `processes/canvas-runtime` composition root와 fixed slot contribution 구조를 열었지만, 그것만으로는 shared shell hot spot이 사라지지 않는다.

실제 병목은 여전히 다음 파일에 남아 있었다.

- `app/components/GraphCanvas.tsx`
- `app/components/FloatingToolbar.tsx`
- `app/hooks/useContextMenu.ts`
- `app/components/editor/WorkspaceClient.tsx`

이 파일들은 각자 다음을 직접 소유하고 있었다.

- host-level event branching
- presenter state resolution
- pane/node registry resolution
- action dispatch orchestration

이 구조를 그대로 두면 runtime composition root를 도입해도 후속 feature는 다시 shared shell file을 건드리게 된다.

즉, composition root와 함께 shared shell을 "binding consumer"로 한 번만 마이그레이션하는 결정이 필요했다.

## Decision Drivers

- shared shell file을 feature branching owner가 아니라 consumer 역할로 축소할 것
- 후속 surface lane이 shared shell file을 기본 수정 경로로 삼지 않게 할 것
- host/presenter/registry/dispatch 책임을 별도 binding 파일로 분리할 것
- behavior regression 없이 one-time adoption으로 끝낼 것

## Decision

shared shell file을 runtime binding consumer로 한 번만 마이그레이션한다.

구체적으로는 다음을 채택한다.

1. `GraphCanvas.tsx`는 `graphCanvasHost` binding consumer가 된다.
2. `FloatingToolbar.tsx`는 `toolbarPresenter` binding consumer가 된다.
3. `useContextMenu.ts`는 `contextMenu` binding consumer가 된다.
4. `WorkspaceClient.tsx`는 `actionDispatch` binding consumer가 된다.

이후 새 surface 기능은 기본적으로 binding 파일이나 contribution 파일을 통해 붙이고, shared shell file을 직접 feature owner로 사용하지 않는다.

## Decision Details

### Binding Ownership

- `graphCanvasHost.ts`
  - host-level context-menu action assembly
  - pane/node context open input 구성
  - toolbar slot contribution assembly
- `toolbarPresenter.ts`
  - toolbar state resolution
  - create/preset menu open/close orchestration
- `contextMenu.ts`
  - pane/node surface kind, anchor id, registry resolution
- `actionDispatch.ts`
  - compat surface -> action routing envelope normalization
  - optimistic lifecycle / rollback orchestration

### Shared Shell Role Reduction

마이그레이션 이후 shared shell file의 목표 역할은 아래와 같다.

- `GraphCanvas.tsx`: host
- `FloatingToolbar.tsx`: presenter
- `useContextMenu.ts`: overlay lifecycle consumer
- `WorkspaceClient.tsx`: dispatch consumer

중요한 점은 이 파일들이 더 이상 surface-specific inventory나 routing policy의 owner가 아니라는 것이다.

### One-Time Adoption Rule

이 변경은 반복적 구조 변경이 아니라 one-time adoption으로 본다.

즉, shared shell file은 지금 한 번 크게 수정하되, 이후 feature onboarding은 binding 추가 또는 contribution 채우기 쪽으로 진행한다.

## Alternatives Considered

### A. composition root만 도입하고 shared shell file은 그대로 둔다

- 장점: 초기 diff가 작다.
- 단점: 후속 feature가 여전히 `GraphCanvas.tsx` 등을 건드린다.
- 결론: 비채택

### B. shared shell을 더 작은 컴포넌트로 쪼개지만 binding layer는 두지 않는다

- 장점: 파일 길이는 줄 수 있다.
- 단점: ownership과 dependency direction 문제는 여전히 남는다.
- 결론: 비채택

### C. runtime bindings로 shared shell을 one-time adoption 한다 (채택)

- 장점: host/presenter/registry/dispatch 책임이 명시적인 경계로 분리된다.
- 장점: 후속 feature가 shared shell file보다 자기 owner 파일을 우선 수정하게 된다.
- 결론: 최종 채택

## Consequences

### Positive

- shared shell file은 구조적으로 더 얇아지고 역할이 선명해진다.
- `GraphCanvas.tsx`의 surface-specific branching이 줄어든다.
- `WorkspaceClient.tsx`의 dispatch wiring이 재사용 가능한 binding으로 옮겨간다.
- pane/node context menu inventory ownership이 hook 밖으로 이동한다.

### Negative

- binding 파일 수가 늘어나면서 초기에 따라가야 할 파일이 증가한다.
- contract가 잘못 설계되면 binding layer가 우회적인 indirection처럼 느껴질 수 있다.
- shared shell과 binding의 경계를 review로 계속 지켜야 한다.

## Follow-up

1. 후속 slice가 shared shell file을 기본 수정 경로로 다시 삼지 않는지 review에서 확인한다.
2. binding adoption regression은 GraphCanvas/FloatingToolbar/useContextMenu/WorkspaceClient test로 유지한다.
3. keyboard hot spot처럼 아직 남은 shared shell branching도 같은 원칙으로 분리한다.

## Related Decisions

- ADR-0007: runtime composition root와 fixed slot structure를 정의한다.
- ADR-0009: keyboard handling도 동일한 boundary 원칙으로 분리하는 결정을 기록한다.
