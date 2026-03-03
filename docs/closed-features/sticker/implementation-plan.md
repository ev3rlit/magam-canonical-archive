# Sticker V2 실행 계획 (Children-first Die-cut Wrapper)

## 요약
기존 Sticker를 `kind` 기반 콘텐츠 컴포넌트에서 **다이컷 아웃라인 Wrapper**로 재정의한다.  
핵심은 `children` 렌더 결과를 감싸는 공통 shell이며, Inspector는 스타일만 편집한다.  
이번 변경은 **브레이킹 변경**으로 처리하고, 마이그레이션/레거시 호환은 범위에서 제외한다.

## 확정된 의사결정
- 컷라인 전략: **Hybrid**
  - 텍스트 중심(children이 text/lucide만)일 때 glyph 기반 다이컷
  - 이미지/마크다운/복합 children 포함 시 shell 기반 다이컷
- node data 모델: **Parsed AST**
- Inspector 범위: **Style-only**
- V2 공식 children 지원: **Core 4종**
  - `text`, `lucide-icon`, `graph-image`, `graph-markdown`
- outline shape: **Auto only**
- 미지원 children 처리: 렌더에서 무시 + 경고 로그

## Public API / 타입 변경
1. `libs/core/src/components/Sticker.tsx`
- 제거: `kind`, `text`, `emoji`, `src`, `alt`, `bgColor`, `textColor`, `fontSize`, `fontWeight`
- 유지: `id`, `x/y`, `anchor/position/gap/align`, `outlineWidth`, `outlineColor`, `shadow`, `padding`, `rotation`, `className`, `children`
- 검증 규칙 유지: `id` 필수, 위치(`x/y` 또는 anchor 계열) 필수

2. `app/utils/childComposition.ts`
- `RenderableChild` 확장:
  - 기존: `text`, `lucide-icon`
  - 추가: `image`, `markdown`
- 스티커용 파싱 함수 추가(또는 옵션 확장):
  - `parseStickerChildren(rendererChildren, fallbackChildren)`

3. `app/utils/stickerDefaults.ts`
- 스타일 정규화 전용 타입으로 축소
- `kind` 의존 기본값 제거
- `outlineWidth` 상한/하한 clamp 유지

## 구현 단계 (결정 완료 버전)

## Phase 1. Core Sticker API 전환
- `StickerProps`를 children-first로 정리
- `graph-sticker` host에 children 전달
- 테스트 갱신:
  - `libs/core/src/__tests__/sticker.spec.tsx`를 children 시나리오 중심으로 재작성

완료 조건:
- core 레벨에서 `kind` 참조 제거
- host node가 children를 포함해 생성됨

## Phase 2. Parser 전환 (`app/app/page.tsx`)
- `graph-sticker` 분기 재작성
- `extractNodeContent` 패턴과 동일하게 children 파싱
- sticker node data를 다음으로 생성:
  - `children`: parsed sticker children
  - `label`: text children 합성 문자열
  - `style`: outline/shadow/padding/rotation
  - anchor/position/gap/align 유지

완료 조건:
- `graph-sticker`에서 children 손실 없음
- node data에 `kind/text/emoji/src` 저장 로직 제거

## Phase 3. Runtime StickerNode 재구성
- `app/components/nodes/StickerNode.tsx`에서 `kind` 분기 제거
- 렌더를 2계층으로 분리:
  - `StickerShell`: 다이컷 outline/shadow/padding/rotation
  - `StickerContent`: parsed children 렌더
- Hybrid 컷라인 적용:
  - text/lucide only: text contour 모드 (`WebkitTextStroke + textShadow`)
  - image/markdown 포함: shell 모드(clip-path/border/shadow)
- 기존 local error boundary 유지
- 이미지 실패 fallback 유지

완료 조건:
- 단일 StickerNode가 4종 children 조합을 렌더
- 스티커 1개 기준 프리즈 재현 없음

## Phase 4. Inspector 단순화
- `app/components/ui/StickerInspector.tsx`
- 제거: `kind`, `text/emoji/src` 편집 UI
- 유지: `outlineWidth`, `outlineColor`, `shadow`, `padding`, `rotation`
- 프리셋 버튼은 스타일 preset만 적용

완료 조건:
- Inspector가 콘텐츠 타입을 강제하지 않음
- 스타일 조정만 담당

## Phase 5. 문서/예제 정렬
- `docs/features/sticker/README.md`를 V2 API로 갱신
- `examples/sticker.tsx`, `examples/sticker_single.tsx`를 children-first 예제로 변경
- 최소 예제 3개 제공:
  - text only
  - emoji + text
  - markdown 또는 image 포함

완료 조건:
- 문서/예제에 `kind` 기반 사용 예시 0건

## 테스트 계획

## 단위 테스트
1. `libs/core/src/__tests__/sticker.spec.tsx`
- children 전달, 위치 검증, anchor 검증

2. `app/utils/childComposition.test.ts`
- sticker children 파싱:
  - text/lucide
  - markdown
  - image
  - unsupported child drop + warning

3. `app/utils/stickerDefaults.test.ts`
- style normalization/clamp 검증

## 통합 테스트
1. parser 결과 검증 (`app/app/page.tsx` 경로)
- `graph-sticker` -> node data(`children`, `label`, `style`) 매핑 검증

2. node 렌더 검증
- `StickerNode`가 4종 children 렌더
- image load error fallback
- hybrid mode 전환 조건 검증

## 수동 검증
1. `examples/sticker_single.tsx`에서 렌더/선택/이동/회전
2. 복합 children 스티커(emoji+text, markdown, image) 렌더 확인
3. PNG/JPG/SVG/PDF export 시 outline 유지 확인
4. 미지원 children 입력 시 앱 멈춤 없이 경고 로그만 출력

## 수용 기준
- `kind` 중심 로직이 core/parser/runtime/inspector에서 제거됨
- Sticker는 children만으로 의미 있는 스티커를 구성할 수 있음
- Inspector는 스타일 편집만 수행
- 단일 스티커/복합 스티커에서 프리즈 재현 없음
- 문서/예제가 V2 계약과 100% 일치

## 가정/기본값
- 브레이킹 변경을 허용하며, 레거시 호환/마이그레이션은 수행하지 않음
- 미지원 children은 렌더하지 않고 warning 처리
- `shape` 옵션은 도입하지 않고 `auto` 동작만 제공
