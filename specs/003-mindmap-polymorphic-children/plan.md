# Implementation Plan: MindMap Polymorphic Children

**Branch**: `003-mindmap-polymorphic-children` | **Date**: 2026-03-02 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children/specs/003-mindmap-polymorphic-children/spec.md`
**Input**: Feature specification from `/specs/003-mindmap-polymorphic-children/spec.md` and `docs/features/mindmap-polymorphic-children/README.md`

## Summary

MindMap 계층 참여 기준을 `graph-node` 타입 결합에서 `from` 선언 기반으로 전환한다. 핵심은 (1) `from` 단일 prop으로 관계+엣지 시각 통합, (2) MindMap 자식의 `from` 누락 및 중첩 MindMap을 파싱 에러로 명확히 차단, (3) 비동기 콘텐츠 크기 변화에 대한 자동 재레이아웃 트리거를 추가해 최종 배치 안정성을 보장하는 것이다. 다중 sibling MindMap은 기존처럼 지원하고, 그룹 분리 레이아웃(`groupId`) 파이프라인을 그대로 활용한다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x workspace runtime  
**Primary Dependencies**: React Flow 11, Next.js app runtime, ELK (`elkjs`), Zustand graph store, `@magam/core` host components  
**Storage**: TSX source-based graph AST + client runtime state (Zustand), 신규 DB 없음  
**Testing**: `bun test` (app/unit/ws), parser regression tests, layout trigger regression tests  
**Target Platform**: 브라우저 기반 Magam canvas editor + Bun local tooling  
**Project Type**: 모노레포(Next.js app + core renderer library + ws patch workflow)  
**Performance Goals**: MindMap 자동 레이아웃이 초기 렌더 후 안정화 시점까지 500ms 내 1회 이상 반영되고, 자동 재레이아웃이 그래프당 설정 한도 내(기본 3회)로 제한  
**Constraints**: MindMap 자식 `from` 필수, nested MindMap 금지, multiple sibling MindMap 허용, Canvas-only 모드 동작 회귀 금지, 자동 재레이아웃 무한 루프 금지  
**Scale/Scope**: `app/app/page.tsx` parser, `app/components/GraphCanvas.tsx` trigger logic, `app/hooks/useLayout.ts` re-entry guard, `app/utils/layoutUtils.ts` signature helper, core component prop typing, ws patch/update 경로까지 포함

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: 정책 충돌 지점(`from` 강제 vs 기존 root 관습, nested MindMap 허용 여부)을 먼저 명시하고 README 합의값을 스펙으로 고정했다.
- **II. Simplicity First**: 레이아웃 엔진 교체 없이 기존 `groupId + useLayout` 파이프라인 확장으로 해결한다.
- **III. Surgical Changes**: 변경 범위를 parser, layout trigger, core prop 타입, ws patch 경계로 제한한다.
- **IV. Goal-Driven Execution**: 성공 기준을 topology 에러 결정성 + mixed-node layout + bounded auto-reflow로 측정 가능하게 정의했다.
- **Technical Constraints**: Bun 워크플로우, monorepo alias, core reconciler model, Zustand 단일 스토어 원칙 준수.

결과: **PASS**

### Post-Phase-1 Re-check

- `research.md`에서 모든 기술 선택과 미확정 사항을 결정.
- `data-model.md`에서 입력 계약/파싱 산출/재레이아웃 상태 모델 정의 완료.
- `contracts/`에서 host parser 경계와 ws 편집 경계 계약 명시.
- `quickstart.md`에서 구현 순서와 검증 절차를 실행 가능한 커맨드로 고정.

결과: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/003-mindmap-polymorphic-children/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mindmap-polymorphic-host-node-contract.md
│   └── mindmap-polymorphic-rpc-contract.md
└── tasks.md              # /speckit.tasks 단계에서 생성
```

### Source Code (repository root)

```text
app/
├── app/page.tsx
├── components/
│   └── GraphCanvas.tsx
├── hooks/
│   └── useLayout.ts
├── utils/
│   ├── layoutUtils.ts
│   └── elkUtils.ts
└── ws/
    ├── filePatcher.ts
    └── methods.ts

libs/core/src/components/
├── MindMap.tsx
├── Node.tsx
├── Shape.tsx
├── Sticky.tsx
├── Sequence.tsx
├── Sticker.tsx
└── WashiTape.tsx
```

**Structure Decision**: 기존 모노레포 구조를 유지하고 `core component props -> app parser -> graph layout trigger -> ws patch` 순서로 수직 통합 확장한다. 신규 서비스/새 저장소/별도 상태 계층은 도입하지 않는다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
