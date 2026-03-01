# Phase 0 Research: Washi Tape Object

## Decision 1: 공개 API 모델은 Factory Function + Discriminated Union 채택

- Decision: `pattern`, `edge`, `texture`, `text`, `at`를 팩토리 헬퍼 기반 유니온 타입으로 제공하고, `preset`은 sugar로 유지한다.
- Rationale: preset + custom(svg/image/solid) 요구를 동시에 충족하면서 타입 안정성과 직렬화 가능성을 같이 확보한다.
- Alternatives considered:
  - 개별 props 분리(`svgSrc`, `imageSrc` 등): 상호배타 조합이 늘어 유지보수 복잡도 증가.
  - Compound Component: 선언형은 좋지만 parser/직렬화 규약이 과도하게 복잡해짐.
  - Preset only: 브랜드 맞춤 요구 미충족.

## Decision 2: 코어 host 노드는 `graph-washi-tape`, 앱 노드 타입은 `washi-tape`

- Decision: `libs/core`에서 `WashiTape` 컴포넌트를 추가하고 host intrinsic으로 `graph-washi-tape`를 사용한다. 앱 파서(`app/app/page.tsx`)는 이를 React Flow node type `washi-tape`로 매핑한다.
- Rationale: 기존 `graph-sticker -> sticker` 매핑 패턴과 동일한 구조를 사용하면 회귀 위험이 낮고 기존 파이프라인과 자연스럽게 통합된다.
- Alternatives considered:
  - `graph-sticker` 재사용: 두 도메인(sticker vs washi)의 의미 경계가 흐려져 계약과 테스트가 불명확해짐.
  - 앱 전용 가상 타입: core export 경로와 단일 소스 오브 트루스가 분리됨.

## Decision 3: 배치 입력(`segment/polar/attach`)은 정규화 유틸에서 endpoint geometry로 통합

- Decision: `app/utils/washiTapeGeometry.ts`(신규)에서 세 가지 입력 모드를 공통 geometry로 정규화하고 렌더러는 정규화 결과만 소비한다.
- Rationale: 렌더러/UI/RPC/export에서 동일 계산 규칙을 공유해 일관성 및 테스트 용이성을 높인다.
- Alternatives considered:
  - 컴포넌트 내부 즉석 계산: 경로별 계산이 분산되어 회귀 가능성이 높아진다.
  - 입력 모드별 개별 렌더 분기: 중복이 커지고 attach 수정 시 영향 범위가 커진다.

## Decision 4: 패턴 안정성은 allowlist sanitize + fallback preset 조합으로 보장

- Decision: SVG/inline 패턴은 allowlist sanitize를 거쳐 렌더링하고, invalid/불완전 입력은 기본 preset으로 대체한다.
- Rationale: 스펙의 “세션 중단 없는 안전 fallback”을 충족하면서 SVG 기반 확장성도 유지한다.
- Alternatives considered:
  - sanitize 없이 직접 렌더: 보안/안정성 리스크가 높다.
  - invalid 입력 시 렌더 스킵: 사용자 피드백이 약하고 결과 예측 가능성이 떨어진다.

## Decision 5: deterministic jitter는 기존 sticker 해시 패턴을 재사용하되 범위는 와시 규칙으로 제한

- Decision: seed/id 기반 해시 접근을 재사용해 `angle` 미지정 시 결정적 jitter를 적용한다(요구 범위: `-5~+5`, `0` 제외).
- Rationale: 문서 재열기 시 동일 각도 재현을 보장하면서 랜덤성 인지 비용을 줄인다.
- Alternatives considered:
  - 진짜 난수 기반 각도: reload마다 결과가 달라져 회귀 및 UX 불안정.
  - jitter 미적용: 시각적 다양성이 줄고 스펙 충족 실패.

## Decision 6: 내보내기 일관성은 코어 host props 보존 회귀 테스트로 관리

- Decision: PNG/JPEG/SVG/PDF 모두에서 `graph-washi-tape` props가 유지되는지 `libs/core` 단위 회귀 테스트 + `app/utils/pdfGolden.test.ts` 확장으로 검증한다.
- Rationale: export 경로별 drift를 조기에 탐지할 수 있고 기존 sticker 검증 패턴을 재활용할 수 있다.
- Alternatives considered:
  - 수동 시각 확인만 수행: 회귀를 자동으로 잡기 어렵다.
  - 특정 포맷만 테스트: 포맷별 불일치 리스크가 남는다.

## Decision 7: WS 편집 계약(node.create/update)에 `washi-tape` 타입을 명시적으로 추가

- Decision: `app/ws/methods.ts`의 `node.type` 허용 목록과 `app/ws/filePatcher.ts`의 JSX 생성 분기에 `washi-tape`를 추가한다.
- Rationale: UI 삽입/편집과 원본 TSX 동기화 경로를 동일 계약으로 보장한다.
- Alternatives considered:
  - WS 경로 미지원: 실시간 편집/양방향 동기화에서 타입 불일치 발생.
  - 임시 string passthrough: 타입 안정성과 테스트 품질이 낮아진다.

## Decision 8: v1 상호작용 범위는 비편집 정책 유지

- Decision: 삽입/선택/다중선택/포커스 이동까지만 지원하고 resize/rotate handle 등 직접 편집 UI는 제외한다.
- Rationale: 스펙 범위와 일정 위험을 통제하면서 핵심 가치(빠른 강조 + 일관된 출력)에 집중한다.
- Alternatives considered:
  - 초기부터 직접 편집 제공: 설계/테스트 범위가 급격히 확대되어 핵심 목표 달성이 지연된다.

## Clarification Resolution Status

- `plan.md`의 Technical Context에서 남아 있는 `NEEDS CLARIFICATION` 항목 없음.
- 구현 전 추가 확인이 필요한 항목은 `/speckit.clarify`가 아닌 `/speckit.tasks`에서 작업 단위로 세분화 가능.
