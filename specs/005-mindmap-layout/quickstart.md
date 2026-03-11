# Quickstart: Dense MindMap Layout

## 목적

`005-mindmap-layout` 기능을 구현하고 검증하기 위한 최소 실행 절차를 정리한다.

## 작업 문서 링크

- 스펙: `specs/005-mindmap-layout/spec.md`
- 플랜: `specs/005-mindmap-layout/plan.md`
- 리서치: `specs/005-mindmap-layout/research.md`
- 데이터 모델: `specs/005-mindmap-layout/data-model.md`
- 공개 계약: `specs/005-mindmap-layout/contracts/mindmap-layout-prop-contract.md`
- 런타임 계약: `specs/005-mindmap-layout/contracts/mindmap-layout-runtime-contract.md`

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-feature-new-layout
git checkout 005-mindmap-layout
bun install
```

## 2) 구현 순서

1. 공개 surface와 parser/store alignment 정리
   - `libs/core/src/components/MindMap.tsx`
   - `app/features/render/parseRenderGraph.ts`
   - `app/store/graph.ts`
   - 목표: `compact`를 신규 안정형 dense layout 경로로 고정
2. compact strategy 코어 재구성
   - `app/utils/strategies/compactTreeStrategy.ts`
   - `app/utils/strategies/flextreeUtils.ts`
   - `app/utils/strategies/types.ts`
   - 목표: measured node footprint를 입력으로 받는 재귀 compact tree/forest 기본기 정리
3. adaptive sibling placement + contour compression 구현
   - `app/utils/strategies/compactPlacement.ts` (신규)
   - `app/utils/strategies/compactTreeStrategy.ts`
   - 목표: 형제 과다와 깊은 subtree 공백을 같은 규칙으로 해결
4. useLayout 통합 및 guarded relayout 추가
   - `app/hooks/useLayout.ts`
   - `app/components/GraphCanvas.tsx`
   - 필요 시 `app/store/graph.ts`
   - 목표: 실제 크기 변화 후 2회 이내 안정 수렴
5. benchmark fixture와 회귀 테스트 추가
   - `app/utils/strategies/compactPlacement.test.ts` (신규)
   - `app/features/render/parseRenderGraph.test.ts`
   - `app/hooks/useLayout.test.ts`
   - `app/store/graph.test.ts`
   - 필요 시 fixture helper 추가

## 3) 체크포인트

- Checkpoint A: `layout="compact"`가 parser/store/useLayout/registry 전체에서 안정형 dense path로 연결됨
- Checkpoint B: sibling-heavy fixture에서 단일 긴 수직열이 완화됨
- Checkpoint C: deep-vs-shallow fixture에서 mean sibling gap이 기준선보다 감소함
- Checkpoint D: mixed-size 및 multi-root fixture에서 최종 overlap이 0건이고 root cluster도 compact하게 유지됨
- Checkpoint E: post-render size change fixture가 2회 이내 relayout으로 수렴함
- Checkpoint F: 동일 fixture 반복 실행 결과가 1px 이내 오차로 유지됨

## 4) 테스트

```bash
# parser / store surface
bun test app/features/render/parseRenderGraph.test.ts app/store/graph.test.ts

# layout hook integration
bun test app/hooks/useLayout.test.ts app/components/GraphCanvas.test.tsx

# dense strategy unit tests
bun test app/utils/strategies/compactPlacement.test.ts

# feature regression gate
bun test \
  app/features/render/parseRenderGraph.test.ts \
  app/store/graph.test.ts \
  app/hooks/useLayout.test.ts \
  app/components/GraphCanvas.test.tsx \
  app/utils/layoutUtils.test.ts \
  app/utils/strategies/compactPlacement.test.ts

# type safety gate
bunx tsc --noEmit
```

`bun test` 전체 실행은 현재 dense layout 범위 밖의 e2e/runtime suite까지 함께 포함하므로,
이 기능의 완료 판정은 위 focused regression gate와 type safety gate를 기준으로 본다.

## 5) 수동 검증 시나리오

1. 형제가 많은 MindMap fixture를 렌더링해, 기존 `tree` 대비 수직열 붕괴가 줄어드는지 확인한다.
2. 깊은 subtree와 얕은 subtree가 공존하는 fixture를 렌더링해, shallow sibling이 과도하게 멀어지지 않는지 확인한다.
3. 하나의 그룹 안에 여러 루트가 있는 fixture를 렌더링해, 각 루트 subtree와 루트 간 배치가 모두 compact하게 유지되는지 확인한다.
4. Sticky, Markdown, Shape가 섞인 mixed-size fixture에서 overlap이 없는지 확인한다.
5. 이미지/Markdown 등 늦게 크기가 확정되는 fixture를 렌더링해, 최종 상태가 겹침 없이 수렴하는지 확인한다.
6. 동일 fixture를 여러 번 다시 렌더링해 node position이 안정적으로 유지되는지 확인한다.

## 6) 정량 검증 기준

- SC-001: 최종 overlap 0건
- SC-002: `tree` 대비 occupied area 20% 이상 감소, `bidirectional` 대비 10% 이상 감소
- SC-003: 최대 sibling cluster 수직 span 30% 이상 감소
- SC-004: 평균 sibling horizontal gap 25% 이상 감소
- SC-005: 콘텐츠 크기 안정화 후 2회 이내 자동 보정 수렴
- SC-006: 반복 실행 위치 오차 1px 이하

## 7) 현재 자동 검증 범위

- `app/utils/strategies/compactPlacement.test.ts`
  - mixed-size deterministic layout
  - multi-root compact forest + overlap 0
  - sibling-heavy vertical span reduction
  - deep-vs-shallow contour compression
- `app/hooks/useLayout.test.ts`
  - compact group spacing fallback
  - repeat-run determinism at the integration layer
  - sibling placement frame metadata propagation
  - sibling-heavy compact regression at the hook integration layer
- `app/components/GraphCanvas.test.tsx`
  - group-isolated relayout guard
  - 120ms debounce / 2px quantization / max 2 retries policy
- `app/features/render/parseRenderGraph.test.ts`, `app/store/graph.test.ts`
  - `compact` surface preservation
  - omitted spacing default `50`
  - multi-root group metadata preservation
