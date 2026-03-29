---
title: ADR-0012 Workspace-Scoped Database and Canvas-First App Shell
date: 2026-03-29
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - workspace
  - canvas
  - storage
  - shell
aliases:
  - Workspace DB and Canvas-First Shell ADR
  - Canvas-First Workspace Shell ADR
  - workspace scoped database ADR
---

# ADR-0012: Adopt Workspace-Scoped Database and Canvas-First App Shell

## Context

Magam은 `workspace`와 `canvas`를 모두 제품 핵심 단위로 다뤄야 한다.  
하지만 두 단위는 같은 책임을 가지지 않는다.

- workspace는 저장, 권한, 검색, 백업, 자산 ownership의 경계로 필요하다.
- canvas는 사용자가 실제로 열고 편집하고 전환하는 작업 단위다.

이 둘을 같은 레벨의 UI 전면 개념으로 다루면 몇 가지 긴장이 생긴다.

1. 앱 시작 시 `workspace page`를 먼저 전면에 두면 실제 작업 재개까지 navigation cost가 커진다.
2. 사용자는 대개 "어느 workspace를 관리할까"보다 "어느 canvas를 다시 열까"를 먼저 원한다.
3. per-canvas DB를 택하면 cross-canvas search, reference, indexing, asset sharing이 분절된다.
4. 반대로 workspace를 완전히 숨기면 local ownership과 storage boundary가 흐려진다.

따라서 우리는 `workspace`를 storage boundary로 유지하면서도, 사용자 experience는 `canvas-first`로 재정렬할 필요가 있다.

이 ADR에서 고정하는 기준 문장은 아래와 같다.

- `workspace = storage boundary`
- `canvas = editing boundary`
- `workspace page = secondary management surface`

## Decision Drivers

- local ownership clarity
- low-friction entry into active work
- cross-canvas indexing and search locality
- simple mental model
- future extensibility without multi-DB fragmentation

## Decision

Magam은 `workspace-scoped database`와 `canvas-first app shell`을 채택한다.

구체적으로는 다음을 결정한다.

1. database file is scoped to workspace
2. default app entrypoint is the last active canvas editor
3. canvas-to-canvas navigation lives inside the editor sidebar
4. workspace management is secondary, not the primary landing page
5. first-run persistence starts on an ephemeral in-memory backend and promotes to a file-backed backend on the first persisted action

## Decision Details

### Storage Boundary

- DB 파일은 canvas마다 따로 두지 않는다.
- 하나의 workspace가 하나의 저장 경계를 가진다.
- canvas, search/index, asset metadata, plugin/runtime metadata는 workspace 범위 안에서 관리한다.

### Persistence Topology

- first-run에서는 `ephemeral in-memory postgres-compatible backend`가 active storage backend가 된다.
- 첫 저장 또는 첫 canvas 추가 시 `durable file-backed postgres backend`를 만들고 active backend를 그쪽으로 promote한다.
- promote 이후 canonical source of truth는 file-backed backend 하나만 남는다.
- `in-memory DB -> file DB`를 직렬 write path로 겹치는 구조는 채택하지 않는다.

### App Shell

- returning user의 기본 시작점은 마지막 active canvas editor다.
- `workspace page`는 add, switch, reconnect, remove 같은 관리 작업의 보조 surface로 남긴다.
- first-run 또는 recovery 상황이 아니라면 workspace page를 매번 먼저 거치지 않는다.
- persisted session이 없으면 `memory-backed blank workspace + blank canvas` editor로 바로 진입한다.

### Navigation Model

- editor sidebar는 active workspace의 canvas navigator가 된다.
- canvas 전환은 full home redirect가 아니라 editor context 안의 이동으로 처리한다.
- 새 canvas 생성도 editor shell 안에서 수행하고, 생성 직후 해당 canvas로 진입한다.

## Alternatives Considered

### A. Canvas-Scoped DB + Canvas-First Shell

- 장점: 단일 canvas artifact 모델이 직관적일 수 있다.
- 장점: export/import 단위가 단순해 보일 수 있다.
- 단점: cross-canvas search, reference, shared indexing, asset ownership이 분절된다.
- 단점: 여러 canvas를 하나의 logical workspace로 운영할 때 DB와 index 관리가 파편화된다.
- 결론: 비채택

### B. Workspace Page as Default Landing + Workspace-Scoped DB

- 장점: workspace identity와 관리 affordance를 강하게 드러낼 수 있다.
- 장점: multi-workspace 전환과 상태 점검에는 직관적일 수 있다.
- 단점: 실제 작업 진입이 느려진다.
- 단점: canvas가 1급 작업 단위라는 제품 mental model이 약해진다.
- 결론: 비채택

### C. Workspace-Scoped DB + Canvas-First Shell (Selected)

- 장점: storage/search boundary는 workspace에 유지하면서도 작업 진입은 canvas로 단순화할 수 있다.
- 장점: cross-canvas indexing, search, reference locality를 유지한다.
- 장점: local ownership과 editor-first UX를 동시에 확보한다.
- 장점: first-run에서는 file creation을 미루고도 이후 durable backend로 자연스럽게 promote할 수 있다.
- 결론: 최종 채택

## Consequences

### Positive

- 사용자 flow가 단순해진다.
- search와 indexing boundary가 더 강해진다.
- workspace ownership과 canvas editing ownership이 더 명확해진다.
- 새 canvas 생성과 canvas 간 이동이 editor 중심 흐름으로 정렬된다.

### Negative

- workspace abstraction이 사용자 눈앞에서는 덜 보이게 된다.
- sidebar가 더 중요한 navigation surface가 되므로 복잡도 관리가 필요하다.
- restore 실패, missing workspace, empty workspace의 fallback rule을 명확히 정의해야 한다.
- backend promotion 시 snapshot copy 또는 event replay 전략을 명확히 정해야 한다.

## Follow-up

1. `docs/features/m2/canvas-first-workspace-shell/README.md`에서 PRD 기준을 고정한다.
2. `docs/features/m2/canvas-first-workspace-shell/implementation-plan.md`에서 launch, navigation, recovery 실행 순서를 고정한다.
3. 구현 검증에서는 최소 아래 시나리오를 확인한다.
   - last workspace + canvas restore success
   - missing last canvas fallback
   - missing workspace path recovery
   - create canvas then immediate open
   - switch canvas inside editor shell

## Related Decisions

- ADR-0005: database-first canvas platform의 상위 저장 방향을 정의한다.
