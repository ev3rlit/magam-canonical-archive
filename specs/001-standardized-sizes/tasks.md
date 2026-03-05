# Tasks: Standardized Size Language

**Input**: Design documents from `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/specs/001-standardized-sizes/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: `SC-001`, `SC-003`, `SC-004`, `quickstart.md` 검증 절차가 명시되어 있으므로 회귀/계약 테스트 작업을 포함한다.

**Organization**: 사용자 스토리별 독립 구현/검증이 가능하도록 단계별로 분리한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일이며 선행 의존이 없어 병렬 실행 가능
- **[Story]**: 사용자 스토리 라벨 (`[US1]`, `[US2]`, `[US3]`)
- 모든 작업은 명시적 파일 경로를 포함한다

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 공용 사이즈 계약 도입 전 파일 구조와 테스트 스캐폴딩 준비.

- [x] T001 Create size module skeleton (`types/scale/index`) in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/lib/size/types.ts`, `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/lib/size/scales.ts`, and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/lib/size/index.ts`
- [x] T002 [P] Create app-side size runtime skeleton in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeResolver.ts` and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeWarnings.ts`
- [x] T003 [P] Add resolver test scaffold in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeResolver.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리가 공통으로 사용하는 타입/해석/경고 기반을 확정.

**⚠️ CRITICAL**: 이 단계 완료 전에는 어떤 사용자 스토리 구현도 시작하지 않는다.

- [x] T004 Implement extensible token registry + union input types (`SizeTokenRegistry`, `SizeToken`, `SizeRatio`, `ObjectSizeInput`, `MarkdownSizeInput`) in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/lib/size/types.ts`
- [x] T005 [P] Implement Tailwind 3.4.3 baseline tables and category defaults (`typography/space/object2d`) in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/lib/size/scales.ts`
- [x] T006 [P] Implement runtime resolver entry points (`resolveSize`, `normalizeObjectSizeInput`, `resolveObject2D`, `resolveMarkdownSize`) in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeResolver.ts`
- [x] T007 Implement unified warning emitter codes (`UNSUPPORTED_TOKEN`, `UNSUPPORTED_RATIO`, `CONFLICTING_SIZE_INPUT`, `UNSUPPORTED_LEGACY_SIZE_API`) in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeWarnings.ts` and wire it from `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeResolver.ts`
- [x] T008 [P] Export shared size contracts for downstream use in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/lib/size/index.ts` and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/index.ts`
- [x] T009 Add foundational resolver tests for deterministic fallback and invalid-input normalization in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeResolver.test.ts`

**Checkpoint**: 공용 사이즈 계약/해석/경고 인프라 준비 완료.

---

## Phase 3: User Story 1 - 핵심 노드에서 의미 기반 사이즈 사용 (Priority: P1) 🎯 MVP

**Goal**: Text/Sticky/Shape에서 token-first + number-compatible 단일 사이즈 인터페이스를 제공한다.

**Independent Test**: `fontSize="xs~xl"` 및 `size`의 `number|token|object` 입력이 Text/Sticky/Shape에서 동일 규칙으로 해석되고 legacy width/height는 warning+ignore 된다.

### Tests for User Story 1

- [x] T010 [P] [US1] Add renderer contract tests for Text/Sticky/Shape size prop serialization in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/__tests__/renderer.spec.tsx`
- [x] T011 [P] [US1] Add parser regression tests for Text/Sticky/Shape size payload preservation and legacy width/height warning+ignore in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/features/render/parseRenderGraph.test.ts`
- [x] T012 [P] [US1] Add node sizing regression tests for Sticky/Shape token+number+widthHeight+ratio handling in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/StickyNode.test.tsx` and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/ShapeNode.test.tsx`

### Implementation for User Story 1

- [x] T013 [P] [US1] Update Text public prop contract to `fontSize?: number | SizeToken` in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/components/Text.tsx`
- [x] T014 [P] [US1] Update Sticky/Shape public prop contracts to `size?: ObjectSizeInput` and keep legacy width/height as unsupported runtime inputs in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/components/Sticky.tsx` and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/components/Shape.tsx`
- [x] T015 [US1] Update parse pipeline to preserve `fontSize`/`size` raw inputs and emit `UNSUPPORTED_LEGACY_SIZE_API` warnings in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/features/render/parseRenderGraph.ts`
- [x] T016 [US1] Apply shared typography resolver for Text token/number font sizes in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/TextNode.tsx`
- [x] T017 [US1] Apply shared object2d resolver for Sticky/Shape size union with shape-type default ratios (`rectangle=landscape`, `circle/triangle=square`) in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/StickyNode.tsx` and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/ShapeNode.tsx`
- [x] T018 [US1] Keep Shape label typography compatibility after size unification (`labelFontSize` fallback path) in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/ShapeNode.tsx` and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/features/render/parseRenderGraph.ts`

**Checkpoint**: User Story 1이 독립적으로 동작하며 MVP 데모 가능.

---

## Phase 4: User Story 2 - Markdown 단일 size 인터페이스로 1D/2D 제어 (Priority: P2)

**Goal**: Markdown `size` 하나로 primitive 입력은 1D, object 입력은 2D로 해석한다.

**Independent Test**: `size="s"`/`size={16}`는 텍스트 밀도만 바꾸고, `size={{ token:'m', ratio:'portrait' }}` 및 `size={{ widthHeight:'l' }}`는 2D 프레임으로 해석된다.

### Tests for User Story 2

- [x] T019 [P] [US2] Add Markdown dual-mode tests for primitive 1D and object 2D resolution in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/MarkdownNode.test.tsx`
- [x] T020 [P] [US2] Add parser regression tests for Markdown `size` union payload preservation in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/features/render/parseRenderGraph.test.ts`

### Implementation for User Story 2

- [x] T021 [P] [US2] Extend Markdown public prop contract to `size?: MarkdownSizeInput` in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/libs/core/src/components/Markdown.tsx`
- [x] T022 [US2] Preserve Markdown raw `size` input in parse mapping path in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/features/render/parseRenderGraph.ts`
- [x] T023 [US2] Implement MarkdownNode dual-mode resolution (primitive=1D typography, object=2D object size) in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/MarkdownNode.tsx`
- [x] T024 [US2] Apply resolved Markdown 2D width/height frame styles without regressing prose rendering in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/MarkdownNode.tsx`

**Checkpoint**: User Story 2가 독립적으로 동작하며 US1과 병행 유지 가능.

---

## Phase 5: User Story 3 - 범위/경고/fallback 동작 예측 가능성 보장 (Priority: P3)

**Goal**: 미지원 입력과 범위 제외 컴포넌트에서 warning+fallback/ignore 정책을 환경 동일하게 유지한다.

**Independent Test**: 미지원 token/ratio/충돌 입력은 항상 warning+fallback 되고, Sequence size 토큰은 미지원 유지, Sticker는 콘텐츠 기반 크기 정책을 유지한다.

### Tests for User Story 3

- [x] T025 [P] [US3] Add warning and fallback tests for unsupported token/ratio and conflicting 2D input in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeResolver.test.ts`
- [x] T026 [P] [US3] Add non-goal regression tests for Sequence size-token exclusion and Sticker content-driven sizing in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/app/page.test.tsx` and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/renderableContent.test.tsx`

### Implementation for User Story 3

- [x] T027 [US3] Enforce Sequence size-token unsupported path and Sticker size non-target behavior in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/features/render/parseRenderGraph.ts`, `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/SequenceDiagramNode.tsx`, and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/components/nodes/StickerNode.tsx`
- [x] T028 [US3] Route parser/node invalid-size logs through shared warning emitter for identical dev/prod behavior in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/features/render/parseRenderGraph.ts` and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeWarnings.ts`
- [x] T029 [US3] Harden category fallback defaults (`typography=m`, `space=m`, `object2d={token:'m',ratio:'landscape'}`) in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeResolver.ts` and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeResolver.test.ts`
- [x] T030 [P] [US3] Define fixed AI Agent size fixture catalog (60 cases) for contract conformance in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/specs/001-standardized-sizes/checklists/agent-size-fixtures.md`
- [x] T031 [US3] Add fixture-driven parser regression test to enforce single size contract (`fontSize`/`size`) for in-scope components in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/features/render/parseRenderGraph.test.ts`
- [x] T032 [P] [US3] Add resolver determinism regression test (same input repeated 10 times => identical output) in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/app/utils/sizeResolver.test.ts`

**Checkpoint**: 모든 경고/범위/호환 정책이 문서 계약과 일치한다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 문서 일치성 및 최종 검증 로그 정리.

- [x] T033 [P] Update product guide with finalized API examples, ratio rules, and non-goals in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/docs/features/standardized-sizes/README.md`
- [x] T034 [P] Sync contracts/data-model with implemented runtime signatures and warning codes in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/specs/001-standardized-sizes/contracts/size-component-props-contract.md`, `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/specs/001-standardized-sizes/contracts/size-resolution-runtime-contract.md`, and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/specs/001-standardized-sizes/data-model.md`
- [x] T035 Run quickstart verification command set and record real execution results in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/specs/001-standardized-sizes/quickstart.md`
- [x] T036 [P] Update Magam skill guide to reflect token-first standardized size usage examples and out-of-scope rules in `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/.claude/skills/magam/SKILL.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능.
- **Phase 2 (Foundational)**: Phase 1 완료 후 시작, 모든 사용자 스토리를 블로킹.
- **Phase 3 (US1)**: Phase 2 완료 후 시작, MVP 기준선.
- **Phase 4 (US2)**: Phase 2 완료 후 시작, US1과 병렬 가능(단 `parseRenderGraph.ts` 충돌 주의).
- **Phase 5 (US3)**: Phase 2 완료 후 시작, US1/US2와 병렬 가능(공유 경고 경로 조정 필요).
- **Phase 6 (Polish)**: 목표 스토리 완료 후 시작.

### User Story Dependencies

- **US1 (P1)**: 다른 사용자 스토리에 의존하지 않음.
- **US2 (P2)**: Foundational resolver/contract에만 의존, US1과 독립 검증 가능.
- **US3 (P3)**: Foundational warning/fallback 계약에 의존, US1/US2와 독립 검증 가능.

### Within Each User Story

- 테스트 작성/갱신 후 구현 진행.
- core contract -> parser mapping -> node renderer 순으로 적용.
- warning/fallback 정책은 마지막 통합 시점까지 동일 코드 경로로 유지.

### Parallel Opportunities

- Setup: `T002`, `T003`
- Foundational: `T005`, `T006`, `T008`
- US1: `T010`, `T011`, `T012`, `T013`, `T014`
- US2: `T019`, `T020`, `T021`
- US3: `T025`, `T026`, `T030`, `T032`
- Polish: `T033`, `T034`, `T036`

---

## Parallel Example: User Story 1

```bash
Task: "Add renderer contract tests for Text/Sticky/Shape size prop serialization in libs/core/src/__tests__/renderer.spec.tsx"
Task: "Add parser regression tests for Text/Sticky/Shape size payload preservation in app/features/render/parseRenderGraph.test.ts"
Task: "Add node sizing regression tests for Sticky/Shape token+number+widthHeight+ratio handling in app/components/nodes/StickyNode.test.tsx and app/components/nodes/ShapeNode.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Add Markdown dual-mode tests for primitive 1D and object 2D resolution in app/components/nodes/MarkdownNode.test.tsx"
Task: "Add parser regression tests for Markdown size union payload preservation in app/features/render/parseRenderGraph.test.ts"
Task: "Extend Markdown public prop contract to size?: MarkdownSizeInput in libs/core/src/components/Markdown.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "Add warning and fallback tests for unsupported token/ratio and conflicting 2D input in app/utils/sizeResolver.test.ts"
Task: "Add non-goal regression tests for Sequence size-token exclusion and Sticker content-driven sizing in app/app/page.test.tsx and app/components/nodes/renderableContent.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 완료
2. Phase 2 완료 (공용 resolver/contract 고정)
3. Phase 3 완료 (US1)
4. US1 독립 검증 수행 후 데모/배포 판단

### Incremental Delivery

1. Setup + Foundational으로 공용 기반 확정
2. US1 배포: Text/Sticky/Shape token-first 도입
3. US2 배포: Markdown dual-mode 통합
4. US3 배포: 경고/fallback/범위 정책 고정
5. Polish: 문서/검증 로그 정리

### Parallel Team Strategy

1. 팀 전체가 Phase 1-2를 함께 마무리
2. 이후 병렬 분담:
   - Engineer A: US1 (core + parser + Text/Sticky/Shape nodes)
   - Engineer B: US2 (Markdown contract + parser + node)
   - Engineer C: US3 (warning/fallback + non-goal coverage)
3. 공유 파일(`parseRenderGraph.ts`, `sizeResolver.ts`) 병합 순서를 사전 합의

---

## Notes

- `[P]` 표시는 선행 의존성이 해소된 이후에만 병렬 안전하다.
- 모든 사용자 스토리는 독립 테스트 기준을 만족해야 완료로 본다.
- 범위 제외(Sequence size token, Sticker size token)는 기능으로서 명시적으로 검증한다.
