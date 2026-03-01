---
title: ADR-0002 Shared Material System for Sticky and WashiTape
date: 2026-03-01
status: proposed
authors:
  - platform-team
tags:
  - adr
  - sticky
  - washi-tape
  - material-system
  - api
aliases:
  - Shared Paper Material ADR
  - Sticky 소재 시스템 ADR
---

# ADR-0002: Shared Material System for Sticky and WashiTape

## Context

현재 WashiTape는 `preset/svg/image/solid` 기반 패턴 헬퍼를 가지고 있고, Sticky에도 노트/크래프트 포스트잇 같은 소재 표현 요구가 증가하고 있다.

이때 컴포넌트별로 동일 이름의 헬퍼(`preset`, `svg`, `image`, `solid`)를 따로 만들면 다음 문제가 발생한다.

- import surface 충돌 및 혼란 (`stickyPreset` vs `washiPreset` 식 파생 네이밍 필요)
- 타입/프리셋 레지스트리 중복
- 신규 컴포넌트 추가 시 동일 로직 반복
- 조합 자유도(예: 테이프 질감을 Sticky에 적용) 저하

핵심 인식은 다음과 같다.

- `preset/svg/image/solid` 헬퍼는 특정 컴포넌트 로직이 아니라 **소재(Paper Material) 데이터 생성기**다.
- 따라서 헬퍼와 소재 타입은 컴포넌트가 아니라 소재 시스템에 귀속되어야 한다.

## Decision

소재 시스템을 `@magam/core`의 공유 모듈로 분리하고, Sticky/WashiTape가 동일한 `PaperMaterial`을 소비하도록 표준화한다.

1. 공용 소재 타입 도입
- `pattern?: PaperMaterial`을 Sticky/WashiTape 공통 계약으로 사용한다.

2. 헬퍼 공용화
- `preset()`, `svg()`, `image()`, `solid()`는 한 벌만 제공한다.
- 헬퍼는 “어떤 컴포넌트에 쓰이는지”를 모른다.

3. 프리셋 레지스트리 통합
- 프리셋 ID를 단일 레지스트리에서 관리한다.
- ID prefix로 도메인을 구분한다.
  - Sticky 계열: `postit-*`, `note-*`
  - Washi 계열: `washi-*`
  - 공통 계열: `paper-*`

4. 컴포넌트 호환성 정책
- 기본 정책은 교차 적용 허용(창의적 조합 우선).
- 특정 프리셋 제한이 필요하면 타입 강제가 아니라 런타임 메타(`compatibleWith`) + 경고로 처리한다.

## Target Shape

```text
@magam/core
├── material/
│   ├── types.ts           # PaperMaterial, MaterialPresetId, optional compatibility meta
│   ├── presets.ts         # PRESET_REGISTRY (single source of truth)
│   └── helpers.ts         # preset(), svg(), image(), solid()
├── components/
│   ├── Sticky.tsx         # pattern?: PaperMaterial
│   └── WashiTape.tsx      # pattern?: PaperMaterial
└── index.ts               # component + material helper re-export
```

사용 예시:

```tsx
import { Sticky, WashiTape, preset, svg, solid } from '@magam/core';

<Sticky id="m" pattern={preset('postit-paper')} />
<WashiTape id="w" pattern={preset('washi-stripe')} />
<WashiTape id="w2" pattern={svg({ markup: '<svg>...</svg>' })} />
```

통합 레지스트리 예시:

```ts
const PRESET_REGISTRY = {
  // Sticky
  'postit-paper': { label: '기본 포스트잇' },
  'note-lined': { label: '줄 노트' },
  'paper-kraft': { label: '크래프트지' },
  // Washi
  'washi-stripe': { label: '줄무늬 테이프' },
  'washi-dot': { label: '도트 테이프' },
  'washi-floral': { label: '플로럴 테이프' },
  // Shared
  'paper-tracing': { label: '트레이싱지' },
  'paper-color': { label: '색지' },
} as const;
```

## Rationale

1. import 충돌 제거
- 헬퍼가 한 벌이므로 네이밍 충돌 자체가 없다.

2. 조합 자유도 확보
- 소재는 컴포넌트 독립 데이터이므로 교차 적용이 자연스럽다.

3. 확장 비용 최소화
- Envelope/FilmStrip 등 신규 컴포넌트 추가 시 소재 API 재설계 없이 `pattern` 계약만 재사용하면 된다.

4. 단순성 우선 원칙 부합
- 컴포넌트별 헬퍼 분리는 기능 중복과 표면적만 늘린다.

## Alternatives Considered

### A. 컴포넌트별 헬퍼 분리 (`stickyPreset`, `washiPreset`)
- 장점: 컴포넌트 의도는 명확함
- 단점: 중복/네이밍 노이즈/확장 비용 증가
- 결론: 비채택

### B. 타입 레벨 컴포넌트 호환 강제
- 장점: misuse를 사전 차단
- 단점: 조합 자유도 저하, 타입 복잡도 급증
- 결론: 비채택 (필요 시 런타임 경고 채택)

## Consequences

### Positive
- 소재 표현 API 일관성 상승
- 타입/헬퍼/레지스트리 중복 제거
- Sticky 소재 확장(노트, 크래프트 포스트잇) 구현 경로 명확화

### Negative
- 초기 마이그레이션 시 기존 Washi 전용 타입 경계 재정리 필요
- 레지스트리 통합 시 naming convention 관리 필요

## Follow-up

1. `material/` 모듈 스캐폴딩 및 기존 Washi 헬퍼 이관
2. Sticky `pattern?: PaperMaterial` 수용
3. 프리셋 레지스트리 통합 및 ID prefix 정책 문서화
4. 필요 시 `compatibleWith` 메타와 런타임 경고 추가
