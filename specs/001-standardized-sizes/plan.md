# Implementation Plan: Standardized Size Language

**Branch**: `001-standardized-sizes` | **Date**: 2026-03-05 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/specs/001-standardized-sizes/spec.md`
**Input**: Feature specification from `/specs/001-standardized-sizes/spec.md` and `/Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes/docs/features/standardized-sizes/README.md`

## Summary

Magam 노드 사이즈 체계를 `number` 중심에서 `token-first + number-compatible` 모델로 표준화한다. 핵심 구현은 (1) `xs~xl` 토큰 레지스트리와 단일 해석 경로 도입, (2) 컴포넌트 계약을 `fontSize`/`size` 단일 진입점으로 통일, (3) Markdown 1D/2D dual-mode 해석, (4) 2D ratio 계약(`landscape | portrait | square`)과 미지원 입력 warning+fallback 정책 고정이다. 동시에 Sequence size 토큰화는 범위에서 제외하고, Sticker는 콘텐츠 기반 크기를 유지한다.

## Technical Context

**Language/Version**: TypeScript 5.9.2, React 18.3.x, Bun 1.x workspace runtime  
**Primary Dependencies**: `@magam/core` host components, React Flow 11, Zustand, Tailwind CSS 3.4.3, `tailwind-merge`, `clsx`  
**Storage**: TSX source AST + runtime graph state(Zustand), 신규 DB 없음  
**Testing**: `bun test` (nodes/parser/core), 필요 시 `bun run build`로 타입/번들 검증  
**Target Platform**: 브라우저 기반 Magam canvas editor + Bun local tooling
**Project Type**: monorepo web app + renderer library (`app` + `libs/core`)  
**Performance Goals**: size token 해석 O(1) lookup 유지, 기존 렌더 경로 대비 체감 지연 증가 없음, SC 기준(정렬 일관/호환 회귀 없음) 충족  
**Constraints**: ratio enum 고정(`landscape|portrait|square`), 미지원 token/ratio는 warning+fallback, 충돌 입력 invalid 처리, Sequence size 토큰 v1 제외, Sticker 2D size 토큰 제외  
**Scale/Scope**: `libs/core/src/components/*` 공개 props, `app/features/render/parseRenderGraph.ts`, `app/components/nodes/{Text,Sticky,Shape,Markdown}` 렌더 경로, 관련 테스트 및 문서

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: clarify 세션으로 fallback/legacy/충돌/숫자 호환/ratio 집합을 확정했고 스펙에 반영했다.
- **II. Simplicity First**: 기존 파서/노드 렌더 경로를 유지하고, 공용 size resolver 계층을 추가하는 최소 변경 전략을 채택한다.
- **III. Surgical Changes**: 변경 범위를 size 계약 관련 파일(components, parser, node renderers, tests, docs)로 제한한다.
- **IV. Goal-Driven Execution**: FR/SC를 warning+fallback, ratio 유효값, numeric 호환, 범위 제외 정책으로 테스트 가능하게 정의했다.
- **Technical Constraints**: Bun 명령 체계, monorepo alias, core component model(react reconciler), Zustand 단일 스토어 원칙 준수.

결과: **PASS**

### Post-Phase-1 Re-check

- `research.md`에서 size 계약/ratio/fallback/범위 정책 결정을 확정했다.
- `data-model.md`에서 입력 union, 정규화 모델, 해석 결과 모델, 경고 이벤트 모델을 정의했다.
- `contracts/`에서 공개 컴포넌트 계약 및 런타임 해석 계약을 분리해 명세했다.
- `quickstart.md`에서 구현 순서와 테스트 절차를 실행 가능한 단계로 고정했다.

결과: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/001-standardized-sizes/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── size-component-props-contract.md
│   └── size-resolution-runtime-contract.md
└── tasks.md              # /speckit.tasks 단계에서 생성
```

### Source Code (repository root)

```text
libs/core/src/
├── components/
│   ├── Text.tsx
│   ├── Sticky.tsx
│   ├── Shape.tsx
│   ├── Markdown.tsx
│   └── Sequence.tsx
├── lib/
│   └── (new) size/       # token registry + input type + resolver (planned)
└── index.ts

app/
├── features/render/
│   └── parseRenderGraph.ts
├── components/nodes/
│   ├── TextNode.tsx
│   ├── StickyNode.tsx
│   ├── ShapeNode.tsx
│   ├── MarkdownNode.tsx
│   └── SequenceDiagramNode.tsx
├── utils/
│   └── (new) sizeResolver.ts (planned, if app-side resolution needed)
└── app/page.test.tsx

app/components/nodes/
├── StickyNode.test.tsx
└── (new) size token tests (planned)
```

**Structure Decision**: 기존 monorepo 구조를 유지하며 `core 공개 props -> parser 전달/보존 -> app resolver -> node renderer` 수직 경로를 확장한다. 신규 저장소/상태계층/서비스는 도입하지 않는다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 없음 | N/A | N/A |
