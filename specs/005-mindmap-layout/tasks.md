# Tasks: Dense MindMap Layout

**Input**: `/Users/danghamo/Documents/gituhb/magam-feature-new-layout/specs/005-mindmap-layout/` 아래 설계 문서  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 이 기능은 `plan.md`와 `quickstart.md`에서 parser/store/hook/strategy 회귀 테스트와 benchmark 검증을 명시하므로 테스트 작업을 포함한다.

**Organization**: 작업은 사용자 스토리별로 묶어서 각 스토리를 독립적으로 구현하고 검증할 수 있게 구성한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일을 다루며 선행 의존성이 없는 병렬 가능 작업
- **[Story]**: 해당 작업이 속한 사용자 스토리 (`[US1]`, `[US2]`, `[US3]`)
- 모든 작업은 정확한 파일 경로를 포함한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dense layout 검증에 공통으로 쓰는 fixture와 metric 기반을 준비한다.

- [x] T001 Create dense layout benchmark fixture catalog in `app/utils/strategies/fixtures/compactPlacementFixtures.ts`
- [x] T002 [P] Create occupied-area, sibling-span, sibling-gap, and overlap metric helpers in `app/utils/strategies/fixtures/compactPlacementFixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리보다 먼저 끝나야 하는 공개 surface와 런타임 파이프라인 정합성을 맞춘다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 어떤 사용자 스토리 구현도 시작하지 않는다.

- [x] T003 Align the stable `compact` public prop contract and default `spacing=50` in `libs/core/src/components/MindMap.tsx`
- [x] T004 [P] Preserve `layout="compact"` and omitted spacing defaults in `app/features/render/parseRenderGraph.ts`
- [x] T005 [P] Align `MindMapGroup` and graph-level layout metadata for stable compact routing in `app/store/graph.ts`
- [x] T006 [P] Update dense layout strategy contracts and compact routing surfaces in `app/utils/strategies/types.ts`, `app/utils/strategies/registry.ts`, and `app/utils/strategies/index.ts`
- [x] T007 [P] Add compact surface regression coverage in `app/features/render/parseRenderGraph.test.ts`, `app/store/graph.test.ts`, and `app/hooks/useLayout.test.ts`

**Checkpoint**: `compact`가 parser -> store -> useLayout -> registry까지 안정형 dense 경로로 연결되어야 한다.

---

## Phase 3: User Story 1 - 조밀하고 읽기 쉬운 마인드맵 (Priority: P1) 🎯 MVP

**Goal**: mixed-size 및 multi-root MindMap에서도 topology를 보존한 채 겹침 없이 더 조밀한 `compact` 배치를 만든다.

**Independent Test**: mixed-size 및 multi-root benchmark fixture를 `compact`로 렌더링했을 때 overlap이 0이고, `tree` 대비 occupied area가 감소하며, 각 root subtree와 root cluster가 compact하게 유지되고, 반복 실행 위치가 1px 이내로 유지되면 된다.

### Tests for User Story 1

- [x] T008 [P] [US1] Add mixed-size and multi-root dense layout fixture assertions in `app/utils/strategies/compactPlacement.test.ts`
- [x] T009 [P] [US1] Add deterministic repeat-run integration coverage for `compact` in `app/hooks/useLayout.test.ts`

### Implementation for User Story 1

- [x] T010 [US1] Implement recursive subtree placement primitives and top-level root cluster placement in `app/utils/strategies/compactPlacement.ts`
- [x] T011 [US1] Refactor measured hierarchy and multi-root subtree profile helpers in `app/utils/strategies/flextreeUtils.ts`
- [x] T012 [US1] Rebuild dense coordinate synthesis in `app/utils/strategies/compactTreeStrategy.ts`
- [x] T013 [US1] Integrate stable `compact` group positioning and default spacing behavior in `app/hooks/useLayout.ts`

**Checkpoint**: User Story 1이 끝나면 `compact`는 현재 기준선보다 더 조밀하고 겹침 없는 기본 dense layout을 제공해야 하며, multi-root 그룹도 같은 규칙으로 compact하게 정리해야 한다.

---

## Phase 4: User Story 2 - 형제가 많은 가지도 조밀하게 유지됨 (Priority: P2)

**Goal**: 형제가 많은 가지가 단일 긴 수직열로 붕괴하지 않도록 adaptive sibling placement를 적용한다.

**Independent Test**: sibling-heavy benchmark fixture에서 최대 sibling cluster 수직 span이 기준선보다 줄고, 같은 `compact` 규칙 안에서 연속적으로 fan-out이 커지면 된다.

### Tests for User Story 2

- [x] T014 [P] [US2] Add sibling-heavy benchmark fixtures and span assertions in `app/utils/strategies/fixtures/compactPlacementFixtures.ts` and `app/utils/strategies/compactPlacement.test.ts`
- [x] T015 [P] [US2] Add sibling-heavy `compact` integration regression in `app/hooks/useLayout.test.ts`

### Implementation for User Story 2

- [x] T016 [US2] Extend adaptive sibling fan-out and cluster composition rules in `app/utils/strategies/compactPlacement.ts`
- [x] T017 [US2] Thread sibling placement frame metadata through `app/utils/strategies/compactTreeStrategy.ts`

**Checkpoint**: User Story 2가 끝나면 형제가 많은 부모도 눈에 띄는 모드 전환 없이 읽기 쉬운 2차원 cluster로 배치되어야 한다.

---

## Phase 5: User Story 3 - 깊은 서브트리가 주변 공간을 낭비하지 않음 (Priority: P3)

**Goal**: contour/profile 압축과 guarded relayout으로 깊은 서브트리 공백과 렌더 후 크기 변화 문제를 줄인다.

**Independent Test**: deep-vs-shallow fixture에서 평균 sibling horizontal gap이 줄고, delayed-size fixture가 2회 이내 auto-relayout으로 수렴하며, 한 그룹 relayout이 다른 그룹 내부 배치에 영향을 주지 않으면 된다.

### Tests for User Story 3

- [x] T018 [P] [US3] Add deep-vs-shallow gap fixtures and compression assertions in `app/utils/strategies/fixtures/compactPlacementFixtures.ts` and `app/utils/strategies/compactPlacement.test.ts`
- [x] T019 [P] [US3] Add guarded relayout and multi-group isolation regressions in `app/components/GraphCanvas.test.tsx`, `app/hooks/useLayout.test.ts`, and `app/utils/layoutUtils.test.ts`

### Implementation for User Story 3

- [x] T020 [US3] Add contour/profile-based subtree clearance compression in `app/utils/strategies/compactPlacement.ts`
- [x] T021 [US3] Update quantized measurement signature helpers in `app/utils/layoutUtils.ts`
- [x] T022 [US3] Enforce 120ms debounce, 2px quantization, max 2 retries, and group-isolated relayout flow in `app/components/GraphCanvas.relayout.ts`, `app/components/GraphCanvas.tsx`, and `app/hooks/useLayout.ts`

**Checkpoint**: User Story 3이 끝나면 깊은 가지 때문에 생기던 공백과 post-render jitter가 억제되고, multi-MindMap relayout이 그룹별로 독립 동작해야 한다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전 사용자 스토리에 걸친 benchmark 검증과 문서 정리를 마무리한다.

- [x] T023 [P] Refresh benchmark verification notes in `specs/005-mindmap-layout/quickstart.md` and `docs/features/newlayout/README.md`
- [x] T024 [P] Add final dense benchmark regression coverage in `app/utils/strategies/compactPlacement.test.ts`
- [x] T025 Validate the full regression and benchmark flow against `specs/005-mindmap-layout/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 바로 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 시작, 모든 사용자 스토리를 block함
- **Phase 3 (US1)**: Phase 2 완료 후 시작, MVP
- **Phase 4 (US2)**: US1의 dense compact base 위에서 진행
- **Phase 5 (US3)**: US2의 sibling placement 파이프라인을 확장해 contour compression과 relayout을 추가
- **Phase 6 (Polish)**: 원하는 사용자 스토리가 모두 끝난 뒤 수행

### User Story Dependencies

- **US1 (P1)**: Foundational 완료 후 바로 시작 가능, 다른 스토리 의존성 없음
- **US2 (P2)**: US1의 compact placement 기반이 필요
- **US3 (P3)**: US2의 compact placement 확장과 relayout guard alignment가 필요

### Within Each User Story

- 테스트 작업을 먼저 추가해 fixture와 회귀 기준을 고정한다.
- placement/metric helper 다음에 strategy implementation을 진행한다.
- strategy integration 다음에 hook/GraphCanvas 수준 검증을 마친다.

### Parallel Opportunities

- Phase 1의 `T001`, `T002`는 서로 다른 새 파일이라 병렬 가능
- Phase 2의 `T004`, `T005`, `T006`, `T007`은 `T003` 이후 병렬 가능
- US1의 `T008`, `T009`는 병렬 가능
- US2의 `T014`, `T015`는 병렬 가능
- US3의 `T018`, `T019`는 병렬 가능
- Polish의 `T023`, `T024`는 병렬 가능

---

## Parallel Example: User Story 1

```bash
Task: "T008 [US1] Add mixed-size dense layout fixture assertions in app/utils/strategies/compactPlacement.test.ts"
Task: "T009 [US1] Add deterministic repeat-run integration coverage for compact in app/hooks/useLayout.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T014 [US2] Add sibling-heavy benchmark fixtures and span assertions in app/utils/strategies/fixtures/denseMindMapFixtures.ts and app/utils/strategies/compactPlacement.test.ts"
Task: "T015 [US2] Add sibling-heavy compact integration regression in app/hooks/useLayout.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T018 [US3] Add deep-vs-shallow gap fixtures and compression assertions in app/utils/strategies/fixtures/denseMindMapFixtures.ts and app/utils/strategies/compactPlacement.test.ts"
Task: "T019 [US3] Add guarded relayout and multi-group isolation regressions in app/components/GraphCanvas.test.tsx, app/hooks/useLayout.test.ts, and app/utils/layoutUtils.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1과 Phase 2를 끝내고 `compact` surface를 안정화한다.
2. User Story 1을 구현해 mixed-size dense layout의 비겹침, 면적 감소, 결정성을 먼저 확보한다.
3. quickstart 기준으로 US1만 독립 검증한 뒤 데모 가능한 MVP로 본다.

### Incremental Delivery

1. Setup + Foundational 완료 후 `compact` routing을 고정한다.
2. US1을 추가해 dense base layout을 완성한다.
3. US2를 추가해 sibling-heavy case를 개선한다.
4. US3를 추가해 deep-subtree compression과 guarded relayout을 마무리한다.
5. 마지막으로 benchmark regression과 문서를 정리한다.

### Parallel Team Strategy

1. 한 명은 Phase 1~2의 surface alignment를 끝낸다.
2. 이후 전략 작업자는 `app/utils/strategies/*`, 통합 작업자는 `app/hooks/useLayout.ts`와 `app/components/GraphCanvas*.ts*`, 회귀 작업자는 각 테스트 파일을 나눠 병행한다.
3. 각 사용자 스토리는 독립 검증 기준을 통과한 뒤 다음 스토리로 넘어간다.

---

## Notes

- 전체 작업 수: 25
- US1 작업 수: 6
- US2 작업 수: 4
- US3 작업 수: 5
- 병렬 가능 작업 수: 12
- spec-kit 자동화는 현재 git branch 이름과 feature 디렉터리 이름이 같아야 안정적으로 동작한다.
