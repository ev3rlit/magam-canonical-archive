---
title: ADR-0001 WashiTape API Design
date: 2026-02-26
status: accepted
authors:
  - platform-team
tags:
  - adr
  - washi-tape
  - api
  - react
aliases:
  - WashiTape API ADR
  - 와시테이프 API 설계
---

# ADR-0001: WashiTape API Design

## Context

WashiTape 기능은 다음 요구를 동시에 만족해야 한다.

- 간단한 프리셋 사용성
- SVG/Image/Solid 기반 커스텀 패턴 확장성
- 문서 저장/재로드/export 재현성
- 타입 안정성 및 AI 코드 생성 친화성
- v1 범위 제한(Inspector 없음, 캔버스 직접 편집 없음)

초기 대안으로 슬롯형 하위 컴포넌트(`WashiTape.Pattern`)와 render-prop 기반 완전 커스텀을 검토했으나, 직렬화/안정성/복잡도 측면에서 v1에 부담이 컸다.

또한 팀 대화에서 다음 방향들을 함께 검토했다.

- URL 전용 props
- 개별 props 분리 방식
- Namespace 객체 props
- Compound Component
- Render-prop/Headless
- Preset-only
- Factory Helper + Discriminated Union

## Decision

v1은 **Factory Function + Discriminated Union** 기반의 단일 컴포넌트 API를 채택한다.

1. 컴포넌트는 `WashiTape` 하나만 제공한다.
2. `children`은 순수 콘텐츠 전용(`ReactNode`)으로 제한한다.
3. 기하 입력은 `at` prop 단일 진입점으로 받고 endpoint(`from`,`to`)를 기본 공개 API로 채택한다.
4. `x,y,length,angle`은 입력 편의를 위한 보조 방식으로만 제공하며 내부적으로 endpoint로 정규화한다.
5. 시각 설정은 `pattern`, `edge`, `texture`, `text` props로 전달한다.
6. `pattern`은 `preset | solid | svg | image`의 discriminated union을 사용한다.
7. DX와 타입 안전성을 위해 factory helper API(`preset`, `solid`, `svg`, `image`, `segment`, `polar`, `attach`, `torn`, `smooth`, `texture`, `definePattern`)를 제공한다.
8. `preset` prop은 `pattern={preset(name)}`의 sugar로 취급한다.
9. polar 입력에서 `angle` 미설정 시 `seed` 기반 결정적 지터를 적용한다.
10. `PresetName`은 수기 union이 아니라 `PRESET_NAMES as const`에서 파생해 값 목록과 타입을 단일 소스로 유지한다.
11. SVG 패턴 밀도는 원본 에셋의 고유 밀도(viewBox 기준)를 기본 유지하며, v1에서 강제 정규화하지 않는다.

## Decision Details

### Implementation Notes (2026-03-01)

- 캔버스 툴바에 와시 프리셋 카탈로그 버튼을 배치하고, 선택 노드 프리셋 변경을 연결했다.
- QuickOpen(`Ctrl/Cmd+T`)에 파일+명령 통합 검색을 적용하고 와시 전용 명령(전체 선택/다음 포커스/프리셋 적용)을 추가했다.
- v1 범위 결정에 따라 와시 "삽입" 전용 단축키는 도입하지 않았다.
- `attach` 배치는 `anchorResolver`와 연계되어 타깃 이동 시 재계산되며, parser 후처리에서 geometry를 재정규화한다.
- WS AST patcher는 객체형 props를 expression으로 직렬화해 `WashiTape` 생성/수정을 안정적으로 지원한다.

### API Principles

- 저장 가능한 데이터 구조를 우선한다(직렬화 가능성 우선).
- 동일 정보를 여러 방식으로 허용하되 우선순위를 고정한다.
  - `pattern` > `preset` > default preset
- geometry는 `at` prop을 단일 진입점으로 사용하고 endpoint(`from/to`)를 SSOT로 고정한다.
- 프리셋 목록은 `PRESET_NAMES` 상수 배열을 SSOT로 사용한다.
- SVG 패턴은 intrinsic density를 유지해 와시 테이프의 유기적 밀도 변화를 보존한다.
- 함수형 children/render-prop은 v1에서 제외한다.

### Conversation Decision Trail

1. `preset` 단일 진입의 단순성은 유지한다.
2. 커스텀 요구(SVG/Image/Solid)를 수용하기 위해 패턴 타입 확장이 필요하다.
3. `children`은 콘텐츠 전용으로 고정해 의미를 분리한다(패턴/콘텐츠 혼합 금지).
4. 사용자 의미와 일치하도록 “시작점/도착점”을 기본 API로 채택한다.
5. `x,y,length,angle`은 입력 편의를 위해 지원하되 저장 시 endpoint로 정규화한다.
6. 선언형 사용성과 타입 안전성을 동시에 확보하기 위해 helper 기반 생성 방식을 채택한다.
7. 최종적으로 `Factory Function + Discriminated Union`을 v1 표준으로 확정한다.

### Supported Inputs

- `pattern={preset('stripe-mint')}`
- `pattern={solid('#FFE08A')}`
- `pattern={svg({ src })}`
- `pattern={svg({ markup })}`
- `pattern={image('/path/to/pattern.png', { scale, repeat })}`
- `at={segment({ x: 120, y: 80 }, { x: 360, y: 120 })}`
- `at={attach({ target: 'card-1', placement: 'top' })}`
- `at={polar(120, 80, 260, -6)}`

### Safety

- SVG markup은 sanitize + whitelist 적용
- invalid pattern은 기본 preset fallback

## Alternatives Considered

### A. URL-only Props (`patternSrc`, `patternKind`)

- 장점: 구현 단순, 온보딩 쉬움
- 단점: 표현력 부족, SVG inline/메타 정보 전달 어려움
- 결론: 확장성 부족으로 제외

### B. Split Props (`preset`, `svgSrc`, `imageSrc`, ...)

- 장점: 직관적 네이밍
- 단점: 상호배타 규칙 증가, 조합이 복잡해짐
- 결론: API 일관성 저하 우려로 제외

### C. Namespace Object Props Only

- 장점: 구조적이고 선언적
- 단점: 객체 리터럴 노이즈 증가, DX 저하
- 결론: helper 보완 없는 단독 채택은 제외

### D. Geometry by Center + Length (`x,y,length,angle`) Only

- 장점: 빠른 입력과 계산 단순성
- 단점: “어디서부터 어디까지 붙이는지” 사용자 의미 표현이 약함
- 결론: 기본 모델로는 제외, 보조 입력으로만 채택

### E. Compound Components (`WashiTape.Pattern`, `WashiTape.Content`)

- 장점: React 선언형 표현력 우수
- 단점: parser/직렬화 규약 복잡도 큼
- 결론: v2 후보로 보류

### F. Render-prop / Headless (`children={(p)=>...}`)

- 장점: 완전 커스텀 가능
- 단점: 직렬화/협업 재현성/보안 리스크
- 결론: v1 제외

### G. Preset-only

- 장점: 출시 속도 빠름
- 단점: SVG/Image/Solid 커스텀 요구 미충족
- 결론: 요구사항 미충족

### H. Factory Function + Discriminated Union (Selected)

- 장점: 타입 안전성, 직렬화 안정성, 확장성, AI 코드 생성 친화성의 균형
- 단점: helper/타입 정의 초기 설계 비용
- 결론: 최종 채택

## Consequences

### Positive

- 사용성: 단일 컴포넌트로 진입 장벽 낮음
- 안정성: 직렬화 가능한 API로 저장/export 예측 가능
- 확장성: factory helper 추가만으로 패턴 확장 가능
- 타입성: discriminated union + helper로 오입력 감소, 타입 세이프티 강화

### Negative

- v1에서 완전 커스텀 자유도 제한
- Inspector/직접 편집 부재로 일부 UX 제약

## Follow-up

1. v2 검토 항목
- Inspector 지원
- 캔버스 직접 편집(이동/회전/리사이즈)
- compound component 또는 headless 확장

2. 기술 과제
- SVG sanitize 정책 정교화
- pattern asset 캐시 전략
- export 시각 일치율 자동 리포트
