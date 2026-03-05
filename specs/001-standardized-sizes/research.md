# Phase 0 Research: Standardized Size Language

## Decision 1: 공용 size resolver를 단일 경로로 고정

- Decision: 토큰 해석과 fallback 정책은 카테고리 기반 공용 resolver로 처리하고, 컴포넌트 내부 개별 매핑을 금지한다.
- Rationale: 컴포넌트별 하드코딩이 재도입되면 토큰 일관성과 유지보수성이 깨진다.
- Alternatives considered:
  - 컴포넌트별 로컬 매핑 유지: 빠르지만 drift/회귀 위험이 높다.
  - className 유틸 기반 사이즈 우선: 타입 안전성과 계약 일관성이 낮다.

## Decision 2: 단일 prop 계약 + union 입력 모델 채택

- Decision: Text는 `fontSize`, Sticky/Shape/Markdown은 `size` 단일 진입점으로 통일한다.
- Rationale: API surface를 단순화하고, 토큰/숫자 혼용을 타입 수준에서 제어하기 쉽다.
- Alternatives considered:
  - 컴포넌트별 개별 prop 유지(`width/height`, `fontSize` 혼재): 사용자 학습 비용이 높다.
  - helper 강제 API 도입: 호출부 장황화와 거부감이 증가한다.

## Decision 3: Markdown은 단일 size로 1D/2D dual-mode 지원

- Decision: Markdown `size`에서 단일 값 입력은 1D 스케일, object 입력은 2D 스케일로 해석한다.
- Rationale: Markdown 사용 빈도가 높고, 텍스트 밀도와 블록 크기를 하나의 언어로 제어할 필요가 있다.
- Alternatives considered:
  - Markdown에 `fontSize`와 `size`를 분리: 계약이 이원화되어 복잡도가 증가한다.
  - Markdown 2D 미지원: 작성 시나리오 요구를 충족하지 못한다.

## Decision 4: 2D ratio 계약을 enum으로 고정

- Decision: ratio 허용값을 `landscape | portrait | square`로 고정하고, 미지원 ratio는 warning + `landscape` fallback 처리한다.
- Rationale: 명시적 enum은 타입 안정성과 테스트 가능성을 높인다.
- Alternatives considered:
  - 임의 문자열 ratio 허용: 런타임 분기/예외 케이스가 급증한다.
  - ratio 미지정 시 에러 중단: 호환성과 편집 연속성이 떨어진다.

## Decision 5: 미지원 token/충돌 입력 처리 정책 통일

- Decision: 미지원 token/ratio 및 충돌 2D 입력은 warning을 남기고 정의된 fallback으로 해석한다.
- Rationale: 개발/운영 동일 동작을 보장해 디버깅과 사용자 기대를 맞춘다.
- Alternatives considered:
  - 개발환경 throw, 운영 warn 분기: 환경별 결과 차이로 회귀 추적이 어려워진다.
  - 자동 병합 우선순위 처리: 충돌 상황의 의도 해석이 모호해진다.

## Decision 6: 숫자 호환 범위는 명시적으로 확장

- Decision: `fontSize={number}`, `Markdown size={number}`, `Sticky/Shape size={number}`, 구조화된 `width/height` 숫자 입력을 모두 지원한다.
- Rationale: 기존 자산 호환을 유지하면서 토큰 전환을 점진적으로 유도할 수 있다.
- Alternatives considered:
  - Sticky/Shape primitive number 미지원: 사용자 요구와 충돌한다.
  - 숫자 입력 전면 제거: 실사용 회귀와 전환 비용이 급증한다.

## Decision 7: 범위 제외 정책 고정 (Sequence, Sticker)

- Decision: v1에서 Sequence size 토큰화는 제외하고, Sticker는 콘텐츠 기반 자동 크기 정책을 유지한다.
- Rationale: 정책 일관성과 구현 복잡도 제어를 위해 명시적 non-goal을 유지해야 한다.
- Alternatives considered:
  - Sequence까지 동시 확장: 현재 스코프 대비 작업량/회귀 위험이 과도하다.
  - Sticker 2D 토큰 강제: 도메인 특성(다이컷 아웃라인)과 충돌한다.

## Decision 8: 기본 수치 기준은 Tailwind 3.4.3 anchor로 고정

- Decision: `m=16px` 중심의 `xs~xl` 표(typography/line-height/space/object2d)를 기준값으로 사용한다.
- Rationale: 팀 내 공통 참조점이 있어야 토큰 의미가 일관되게 유지된다.
- Alternatives considered:
  - 컴포넌트별 개별 수치 기준: 토큰 의미가 분리되어 디자인 리듬이 깨진다.
  - absolute unit만 사용(rem/px 변환 미정): 문서/테스트 기준이 불명확해진다.

## Clarification Resolution Status

- fallback 정책: **카테고리 기본값 fallback**으로 확정.
- legacy experimental API 처리: **warning + ignore**로 확정.
- 2D 충돌 입력 처리: **invalid + warning + fallback**으로 확정.
- 숫자 호환 범위: **Text/Markdown/Sticky/Shape + structured 2D numeric 허용**으로 확정.
- ratio 계약: **`landscape | portrait | square` 고정 + 미지원 ratio fallback**으로 확정.
- 남은 NEEDS CLARIFICATION 항목 없음. Phase 1 설계 산출물 작성 가능.
