# Implementation Plan: Dense MindMap Layout

**Branch**: `005-mindmap-layout` | **Date**: 2026-03-11 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-new-layout/specs/005-mindmap-layout/spec.md`
**Input**: 기능 명세 `/specs/005-mindmap-layout/spec.md` 및 `docs/features/newlayout/README.md` 구현 전략 정리

## Summary

기존 실험용 `compact` 경로를 신규 안정형 dense MindMap 레이아웃으로 정리한다. 내부 그룹 배치는 `d3-flextree` 기반 compact tree를 중심으로 재구성하되, 모든 부모에서 동일한 형제 합성 규칙을 적용하고 contour/profile 압축으로 깊은 서브트리 공백을 줄인다. 멀티 루트 그룹은 각 루트 서브트리를 먼저 배치한 뒤, 루트들 사이에도 같은 compact 합성 규칙을 적용한다. 공개 surface(`MindMap.layout`, parser/store/layout registry)는 `compact`를 기준으로 통일하고, 다중 MindMap 전역 배치는 기존 ELK 기반 메타 레이아웃을 유지한다. 렌더 후 실제 노드 크기 변화는 측정 기반 guarded relayout으로 수렴시켜 최종 상태의 비겹침과 결정성을 보장한다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18.3.x, Bun 1.x workspace runtime  
**Primary Dependencies**: Next.js 15 app runtime, React Flow 11, Zustand graph store, `d3-flextree`, `d3-hierarchy`, `elkjs`, `@magam/core` host components  
**Storage**: TSX source에서 파생된 render graph + client runtime state(Zustand), 신규 DB 없음  
**Testing**: `bun test`, parser/store/hook/component 회귀 테스트, 신규 strategy 단위 테스트, benchmark fixture 기반 수동 검증  
**Target Platform**: 브라우저 기반 Magam editor/viewer + Bun workspace runtime  
**Project Type**: 모노레포 웹 애플리케이션(Next.js app + core renderer 라이브러리)  
**Performance Goals**: 승인된 fixture에서 최종 노드 겹침 0건, 100-node benchmark 내부 레이아웃 120ms 이하(개발 환경 기준), 자동 재배치 2회 이내 수렴  
**Constraints**: 사용자 작성 MindMap topology 보존, 신규 visible mode switch 금지, 기존 `compact` surface 재사용, 다중 루트 그룹도 동일 compact 규칙으로 처리, 다중 MindMap 전역 배치는 현행 ELK 파이프라인 유지, Bun/Zustand/React Reconciler 제약 준수  
**Scale/Scope**: `libs/core/src/components/MindMap.tsx`, `app/features/render/parseRenderGraph.ts`, `app/store/graph.ts`, `app/hooks/useLayout.ts`, `app/components/GraphCanvas.tsx`, `app/utils/strategies/*`, 관련 parser/store/hook/strategy 테스트 및 benchmark fixture

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: 스펙에서 핵심 모호점이었던 topology 변경 여부와 multi-mode 전환 여부를 먼저 제거했다. 설계는 `compact` 단일 surface와 topology 보존을 전제로 한다.
- **II. Simplicity First**: 새 레이아웃 이름과 별도 state system을 추가하지 않고, 기존 `compact` path를 안정형 dense layout으로 정리한다. 전역 그룹 배치와 parser/store 골격도 재사용한다.
- **III. Surgical Changes**: 변경은 `MindMap` 공개 타입, parser/store layout type, `CompactTreeStrategy` 계열, relayout guard, benchmark 테스트 경로에 한정한다. unrelated diagram components와 기존 ELK tree/bidirectional 경로는 유지한다.
- **IV. Goal-Driven Execution**: 스펙의 SC-001~SC-006을 fixture 기반 정량 지표로 연결하고, 각 구현 단계마다 strategy tests + parser/hook regression + benchmark 확인을 배치한다.
- **Technical Constraints**: Bun 명령 사용, Zustand 단일 스토어 유지, React Reconciler non-DOM 제약 준수, 불필요한 신규 구성요소 추가 금지.

결과: **PASS**

### Post-Phase-1 Re-check

- `research.md`에서 공개 layout 식별자, single-rule sibling placement, contour compression, relayout guard 수치를 결정했다.
- `data-model.md`에서 layout profile, subtree profile, relayout guard state, benchmark snapshot 모델을 정의했다.
- `contracts/`에서 공개 MindMap layout prop 계약과 parser/store/useLayout runtime 계약을 명시했다.
- `quickstart.md`에서 구현 순서, 체크포인트, 정량 검증 명령을 고정했다.

결과: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/005-mindmap-layout/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mindmap-layout-prop-contract.md
│   └── mindmap-layout-runtime-contract.md
└── tasks.md              # /speckit.tasks 단계에서 생성
```

### Source Code (repository root)

```text
libs/core/src/components/
└── MindMap.tsx

app/
├── components/
│   └── GraphCanvas.tsx
├── features/render/
│   ├── parseRenderGraph.ts
│   └── parseRenderGraph.test.ts
├── hooks/
│   ├── useLayout.ts
│   └── useLayout.test.ts
├── store/
│   ├── graph.ts
│   └── graph.test.ts
└── utils/strategies/
    ├── compactTreeStrategy.ts
    ├── flextreeUtils.ts
    ├── registry.ts
    ├── types.ts
    ├── compactPlacement.ts          # 신규
    ├── compactPlacement.test.ts     # 신규
    └── fixtures/                    # 신규 benchmark fixture helpers
```

**Structure Decision**: 기존 `MindMap -> parseRenderGraph -> graph store -> useLayout -> strategy registry` 수직 경로를 유지한다. 내부 그룹 레이아웃 구현만 `compact` 중심으로 재구성하고, global group positioning은 현행 `useLayout`/`globalLayoutResolver` 파이프라인을 유지한다. 신규 알고리즘 보조 코드는 `app/utils/strategies/` 내부의 한정된 helper로 분리한다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
