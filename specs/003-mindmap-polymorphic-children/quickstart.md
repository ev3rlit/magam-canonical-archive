# Quickstart: MindMap Polymorphic Children

## 목적

`003-mindmap-polymorphic-children` 기능을 로컬에서 구현/검증하기 위한 최소 실행 절차.

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-feature-mindmap-polymorphic-children
git checkout codex/mindmap-polymorphic-children
bun install
```

## 2) 구현 순서

1. parser topology 정책 적용 (`app/app/page.tsx`)
   - MindMap child `from` 필수 검증
   - nested MindMap 금지 에러
   - MindMap 참여 판별을 type 기반에서 `from` 기반으로 전환
2. `from` 통합 처리 헬퍼 도입 (`app/app/page.tsx`)
   - `parseFromProp`, `createEdgeFromProp`, endpoint parsing 재사용화
   - `edgeLabel/edgeClassName` 경로 정리(호환 포함)
3. group/layout 연결 정합성 보강
   - MindMap 참여 노드 전부 `groupId` 부여
   - id 스코프 해석(`resolveNodeId`)을 참여 노드 전반에 적용
4. 비동기 재레이아웃 트리거 (`app/components/GraphCanvas.tsx`)
   - size signature 비교 + debounce/cooldown/max-attempt guard
   - 기존 초기 1회 레이아웃 경로와 충돌 없이 병행
5. 레이아웃 유틸/가드 보강
   - `app/utils/layoutUtils.ts`: 측정/시그니처 helper
   - `app/hooks/useLayout.ts`: 중복 실행 방지 re-entry guard
6. 편집 경로 회귀 대응
   - `app/ws/filePatcher.ts`, `app/ws/methods.ts`의 `from` string/object round-trip 보장
   - 필요 시 `libs/core/src/components/*`의 `from` 타입 계약 확장

## 3) 체크포인트

- Checkpoint A: mixed component MindMap fixture가 파싱/렌더 성공하고 모든 참여 노드에 edge가 연결됨
- Checkpoint B: `from` 누락/중첩 MindMap fixture가 deterministic 에러를 UI에 표시
- Checkpoint C: async 콘텐츠 크기 변경 후 bounded auto re-layout 수행
- Checkpoint D: sibling MindMap 2개 이상 장면에서 그룹 분리 + 전역 배치 회귀 없음
- Checkpoint E: `from={{ node, edge }}` 편집 저장/재열기/재편집 round-trip 성공

## 4) 테스트

```bash
# parser / page pipeline
bun test app/app/page.test.tsx

# layout helpers and behaviors
bun test app/utils/layoutUtils.test.ts app/components/GraphCanvas.test.tsx app/hooks/useLayout.test.ts

# ws edit contracts
bun test app/ws/filePatcher.test.ts app/ws/methods.test.ts

# core renderer regression (from typing/validation bypass)
bun test libs/core/src/__tests__/renderer.spec.tsx
```

## 4-1) 자동 재레이아웃 검증 명령/결과 (2026-03-02)

```bash
bun test app/utils/layoutUtils.test.ts app/components/GraphCanvas.test.tsx app/hooks/useLayout.test.ts
```

- 결과: `11 pass, 0 fail`
- 검증 포인트:
  - `layoutUtils`: quantized signature/measurement helper 동작
  - `GraphCanvas.relayout`: debounce/cooldown/max-attempt guard 판정
  - `useLayout`: re-entry guard helper 동작

## 4-2) 회귀 실행 결과 (2026-03-02)

- `bun test app/app/page.test.tsx` -> `9 pass, 0 fail`
- `bun test app/ws/filePatcher.test.ts app/ws/methods.test.ts` -> `22 pass, 0 fail`
- `bun test app/utils/layoutUtils.test.ts app/components/GraphCanvas.test.tsx app/hooks/useLayout.test.ts` -> `11 pass, 0 fail`
- `bun test libs/core/src/__tests__/renderer.spec.tsx` -> `15 pass, 0 fail`

## 5) 수동 검증

1. mixed MindMap 샘플(`Node/Sticky/Shape/Sequence`)을 열고 모든 child edge를 확인한다.
2. MindMap child에서 `from`을 제거해 에러 오버레이 노출을 확인한다.
3. MindMap 안에 MindMap을 중첩해 unsupported 에러를 확인한다.
4. 이미지/마크다운 콘텐츠가 늦게 확장되는 노드에서 자동 재레이아웃 반영을 확인한다.
5. Canvas에 sibling MindMap 2개를 두고 그룹 간 간섭 없이 배치되는지 확인한다.

## 6) 완료 기준

- `from` 기반 다형성 MindMap 참여가 타입과 무관하게 동작
- invalid topology가 fail-fast로 표면화
- auto re-layout이 bounded policy 내에서 동작
- Canvas-only / 기존 편집 경로 회귀 없음
