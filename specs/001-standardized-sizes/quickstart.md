# Quickstart: Standardized Size Language

## 목적

`001-standardized-sizes` 기능을 로컬에서 구현/검증하기 위한 최소 실행 절차.

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-feature-standardized-sizes
git checkout 001-standardized-sizes
bun install
```

## 2) 구현 순서

1. 공용 size 타입/레지스트리/해석기 도입
   - `SizeToken`, `SizeRatio`, `ObjectSizeInput`, `MarkdownSizeInput`
   - 카테고리 기본값 및 warning+fallback 계약 고정
2. core 공개 컴포넌트 props 확장
   - Text: `fontSize` token 지원
   - Sticky/Shape: `size` union 입력 도입 (`number | token | object`)
   - Markdown: `size` single-entry로 1D/2D 지원
   - Sequence/Stickers 범위 제외 정책 유지
3. parser 전달 계약 반영 (`parseRenderGraph.ts`)
   - 원본 입력 보존
   - 노드 data payload에 통일된 size 입력 전달
4. app 노드 렌더러 반영
   - TextNode/StickyNode/ShapeNode/MarkdownNode에서 공용 resolver 사용
   - className 사이즈 유틸 의존 최소화(token-first)
5. 예외 처리 및 fallback 경로 반영
   - 미지원 token/ratio, 충돌 입력, legacy API 입력 warning 정책 구현
6. 테스트 보강
   - token/number/ratio/충돌 입력/범위 제외 정책 회귀 케이스 추가

## 3) 체크포인트

- Checkpoint A: `xs~xl` 토큰이 Text/Sticky/Shape/Markdown에서 일관되게 동작
- Checkpoint B: `Sticky/Shape size={number}`가 primitive token과 동일 규칙으로 해석
- Checkpoint C: Markdown `size` 단일 값(1D) / object(2D) 분기 동작 검증
- Checkpoint D: `landscape|portrait|square` 외 ratio 입력 시 warning + `landscape` fallback 검증
- Checkpoint E: 충돌 2D 입력 invalid + category default fallback 검증
- Checkpoint F: Sequence size 토큰 미지원, Sticker content-driven 유지 검증

## 4) 테스트

```bash
# standardized-size 핵심 회귀 묶음
bun test \
  app/utils/sizeResolver.test.ts \
  app/features/render/parseRenderGraph.test.ts \
  app/components/nodes/StickyNode.test.tsx \
  app/components/nodes/ShapeNode.test.tsx \
  app/components/nodes/MarkdownNode.test.tsx \
  app/app/page.test.tsx \
  app/components/nodes/renderableContent.test.tsx \
  libs/core/src/__tests__/renderer.spec.tsx
```

## 5) 수동 검증

1. Text에 `fontSize="xs|...|xl"` 및 `fontSize={number}`를 적용해 위계 변화 확인
2. Sticky/Shape에 `size="m"`, `size={160}`, `size={{ widthHeight: 'l' }}`, `size={{ width: 'l', height: 160 }}` 확인
3. Markdown에 `size="s"`(1D)와 `size={{ token: 'm', ratio: 'portrait' }}`(2D) 확인
4. 미지원 token/ratio 및 충돌 입력 주입 시 warning+fallback 확인
5. Sequence와 Sticker가 본 기능 범위 제외 정책을 유지하는지 확인

## 6) 완료 기준

- FR-001~FR-017 수용 기준을 모두 만족
- SC-001~SC-005 검증 항목을 충족하는 테스트/문서 근거가 확보
- 경고 정책(미지원 token/ratio/legacy/충돌)이 개발/운영 환경에서 동일하게 동작

## 7) 실제 실행 결과 (2026-03-05)

- 실행 커맨드: `bun test app/utils/sizeResolver.test.ts app/features/render/parseRenderGraph.test.ts app/components/nodes/StickyNode.test.tsx app/components/nodes/ShapeNode.test.tsx app/components/nodes/MarkdownNode.test.tsx app/app/page.test.tsx app/components/nodes/renderableContent.test.tsx libs/core/src/__tests__/renderer.spec.tsx`
- 결과: `61 pass / 0 fail`
- 핵심 확인:
  - `Sticky/Shape size={number}` 경로 통과
  - `landscape|portrait|square` ratio 규칙/경고 경로 통과
  - Sequence/Stickers size 비대상 warning+ignore 경로 통과
  - 60개 fixture 기반 parser 회귀 통과
