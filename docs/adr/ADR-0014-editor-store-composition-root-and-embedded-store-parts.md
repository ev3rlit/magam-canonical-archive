---
title: ADR-0014 Editor Store Composition Root and Embedded Store Parts
date: 2026-03-31
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - editor
  - store
  - zustand
  - composition
aliases:
  - Editor store composition ADR
  - Embedded store parts ADR
  - Go-style editor store embedding ADR
---

# ADR-0014: Adopt a Composition Root and Embedded Store Parts for the Canvas Editor Store

## Context

현재 `editor/src/core/editor/model/editor-store.ts`는 canvas editor의 전역 store이지만, 실제로는 하나의 책임에 머물지 못하고 있다.

- state shape와 initial state를 정의한다.
- history snapshot과 mutation commit 규칙을 소유한다.
- object create, duplicate, group, ungroup, delete 같은 scene command를 수행한다.
- selection, marquee, transform 같은 interaction state를 다룬다.
- panel, context menu, focus request, body editor session 같은 UI overlay 상태를 함께 관리한다.
- body document draft/commit 같은 object-level authoring 흐름도 포함한다.

이 구조는 몇 가지 문제를 만든다.

1. 한 파일을 읽어야만 state, UI, scene mutation, editing behavior를 함께 이해할 수 있다.
2. body editor나 selection 같은 작은 변화도 store 전체 맥락을 다시 읽게 만든다.
3. 같은 파일 안에 순수 명령 함수와 zustand wiring이 섞여 change safety가 낮아진다.
4. `EditorStore` 전체 능력을 임의로 참조하기 쉬워 dependency boundary가 흐려진다.
5. `RULE.md`가 요구하는 "한 가지 책임", "작은 능력 인터페이스", "명시적 의존성"과도 긴장 관계가 생긴다.

Magam의 canvas-first MVP에서는 editor store도 제품 핵심 경계 중 하나다. 따라서 store를 단순히 "상태 모음"으로 유지하기보다, state ownership과 command ownership을 더 작고 명확한 단위로 정렬할 필요가 있다.

## Decision Drivers

- single responsibility at file and module level
- explicit dependency direction inside editor state code
- smaller promptable boundaries for human and agent work
- safer incremental refactoring of a live editor store
- Go-like capability-focused design instead of framework-heavy abstraction
- preserving one flat store surface for the editor UI

## Decision

Magam은 canvas editor store를 `composition root + embedded store parts` 구조로 재편한다.

구체적으로는 다음을 결정한다.

1. `editor-store.ts`는 최종 zustand store 조립 루트로만 유지한다.
2. state definition, history, selectors, UI actions, scene actions, body editor actions, 순수 command helper를 별도 파일로 분리한다.
3. 각 action module은 `EditorStore` 전체를 직접 소유하지 않고, 필요한 능력만 담은 좁은 `env` 또는 capability contract를 입력으로 받는다.
4. 최종 store surface는 기존처럼 하나의 평평한 객체를 유지하되, 내부 구현은 여러 작은 part를 object spread로 합성한다.
5. Go의 struct embedding과 유사한 개발 감각을 채택하되, TypeScript에서는 inheritance나 광범위한 interface 계층 대신 `intersection type + factory composition`으로 표현한다.

## Decision Details

### Composition Root Ownership

`editor-store.ts`는 아래 책임만 가진다.

- `EditorStore` 최종 타입 조립
- zustand `create(...)` 호출
- 공통 실행 환경 생성
- 초기 state와 action part 합성

이 파일은 더 이상 scene command 세부 로직, body editor commit 세부 로직, clipboard clone 세부 로직의 주 소유자가 아니다.

### Embedded Store Parts

store는 역할별 part를 평평하게 합쳐서 구성한다.

- `state`
- `history`
- `panel actions`
- `selection actions`
- `scene actions`
- `body editor actions`
- `overlay actions`
- `selectors`
- `pure command helpers`

TypeScript에서는 다음 형태를 기본 구조로 삼는다.

```ts
type EditorStore =
  EditorState &
  PanelActions &
  SelectionActions &
  SceneActions &
  BodyEditorActions &
  OverlayActions &
  HistoryActions;

export const useEditorStore = create<EditorStore>((set, get) => {
  const env = createEditorStoreEnv(set, get);

  return {
    ...createInitialEditorState(),
    ...createPanelActions(env),
    ...createSelectionActions(env),
    ...createSceneActions(env),
    ...createBodyEditorActions(env),
    ...createOverlayActions(env),
    ...createHistoryActions(env),
  };
});
```

이 구조는 최종 소비자에게는 하나의 flat store를 유지하면서도, 내부 구현은 작은 책임 단위로 나눈다.

### Capability-Oriented Environment

각 part는 거대한 `EditorStore` 전체를 임의로 읽고 쓰지 않는다. 대신 필요한 능력만 드러나는 좁은 contract를 입력으로 받는다.

예시 능력은 다음을 포함할 수 있다.

- `StateReader`
- `StateWriter`
- `CanvasCommitter`
- `ObjectIdFactory`
- `FocusRequestIdSource`

중요한 점은 다음과 같다.

- interface는 구현 추상화가 아니라 필요한 능력만 표현해야 한다.
- 하나의 구현체만 있고 대체 가능성이 낮더라도, part 경계를 좁히는 데 직접 가치가 있으면 허용한다.
- `EditorStoreService`, `EditorStoreRepository` 같은 넓은 추상 경계는 도입하지 않는다.

### Pure Commands vs Wiring

다음 종류의 로직은 zustand wiring에서 분리한다.

- selection normalization
- clipboard snapshot 생성
- object draft 생성
- duplicate/remove/group/ungroup 계산
- transform frame 계산과 selection transform 적용
- object patch sanitization

이 함수들은 가능한 한 순수 함수로 유지하고, action module은 이를 호출해 state transition만 조립한다.

### Target Directory Structure

`editor/src/core/editor/model/` 아래에 다음 구조를 기본 방향으로 둔다.

```text
editor-store.ts
editor-store/
  state.ts
  store-types.ts
  env.ts
  history.ts
  selectors.ts
  panel-actions.ts
  selection-actions.ts
  scene-actions.ts
  body-editor-actions.ts
  overlay-actions.ts
  object-commands.ts
  selection-commands.ts
```

이 구조의 목적은 깊은 계층을 만드는 것이 아니라, 함께 바뀌는 이유를 기준으로 파일 경계를 고정하는 것이다.

### Migration Shape

이 결정은 일괄 재작성보다 점진적 분리를 전제로 한다.

권장 순서는 다음과 같다.

1. `state`, `store-types`, `selectors`를 먼저 분리한다.
2. 순수 helper를 `object-commands`, `selection-commands`로 이동한다.
3. `body-editor-actions`와 `overlay-actions`를 분리한다.
4. 마지막에 `scene-actions`와 `history`를 조립 루트에서 떼어낸다.

이 순서는 editor behavior regression 위험을 낮추고, 각 단계마다 검증 범위를 좁게 유지한다.

## Alternatives Considered

### A. Keep a Single `editor-store.ts`

- 장점: 파일 이동 비용이 없다.
- 장점: 초기 탐색 시 진입점이 하나다.
- 단점: 책임이 계속 누적되고, 작업 단위가 커질수록 change safety가 떨어진다.
- 단점: 작은 수정도 store 전체 맥락을 다시 읽게 만든다.
- 결론: 비채택

### B. Adopt a Framework-Heavy Slice Architecture

- 장점: 외형상 기능별 분리가 빨라 보일 수 있다.
- 장점: 대규모 zustand 예제와 비슷한 형태를 따라갈 수 있다.
- 단점: repo의 `RULE.md`가 선호하는 단순하고 명시적인 구조보다 프레임워크 패턴이 앞서게 된다.
- 단점: slice 간 공유 규칙이 숨어서 dependency direction이 오히려 흐려질 수 있다.
- 결론: 비채택

### C. Introduce Broad Service/Repository Interfaces Around the Store

- 장점: 테스트 대역을 만들기 쉬워 보일 수 있다.
- 단점: 구현체 하나를 감싸는 무의미한 추상화가 되기 쉽다.
- 단점: store 내부 로직을 계층화만 하고 실제 책임 분리는 이루지 못할 가능성이 크다.
- 결론: 비채택

### D. Composition Root + Embedded Store Parts with Narrow Capabilities (Selected)

- 장점: 최종 store surface는 유지하면서 내부 책임을 작게 나눌 수 있다.
- 장점: Go-style embedding에 가까운 단순한 조립 구조를 TypeScript에서 무리 없이 구현할 수 있다.
- 장점: part별 ownership과 검증 범위가 분명해진다.
- 단점: 초기에 타입 정리와 파일 이동 비용이 든다.
- 단점: part 간 공통 helper와 env 설계를 느슨하게 잡으면 다시 거대 store로 회귀할 수 있다.
- 결론: 최종 채택

## Consequences

### Positive

- `editor-store.ts`의 역할이 조립으로 축소된다.
- body editor, scene mutation, selection, overlay가 각자 작은 변경 단위로 분리된다.
- 순수 명령 함수와 zustand wiring이 분리되어 테스트와 코드 읽기가 쉬워진다.
- human/agent 모두 더 적은 파일만 읽고 안전하게 작업할 수 있다.
- Go식 capability embedding 감각을 유지하면서 TypeScript 코드베이스 규칙과도 정렬된다.

### Negative

- 초기 리팩터링 동안 import 경로와 타입 정의가 다소 증가한다.
- 잘못 설계하면 `env`가 사실상 거대한 god object가 될 수 있다.
- action part naming과 ownership이 명확하지 않으면 경계가 다시 흐려질 수 있다.
- 한동안은 기존 단일 파일 구조와 새 분리 구조가 혼재할 수 있다.

## Follow-up

1. `editor-store.ts`는 첫 단계에서 composition root 형태로만 축소한다.
2. `EditorStore` action 묶음 타입과 `EditorStoreEnv` 계약을 먼저 도입한다.
3. 순수 helper를 먼저 추출하고, 그 다음 body editor/overlay action을 분리한다.
4. scene mutation과 history commit path는 마지막에 분리하되, 기존 undo/redo behavior regression을 반드시 확인한다.
5. 새 action part는 `EditorStore` 전체가 아니라 필요한 capability만 입력받는 규칙을 유지한다.

## Related Decisions

- ADR-0005: database-first canvas platform의 전반적 source-of-truth 방향을 정의한다.
- ADR-0012: canvas-first shell과 workspace 경계를 정의한다.
- ADR-0013: object-level inline editing과 body editor의 전역 store ownership 범위를 정리하는 상위 편집 모델을 정의한다.
