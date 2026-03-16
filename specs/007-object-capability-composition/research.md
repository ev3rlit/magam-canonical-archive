# Phase 0 Research: Object Capability Composition

## Decision 1: canonical object는 runtime canonical schema로 먼저 도입한다

- Decision: 1단계에서는 persistence 포맷 전체를 바꾸지 않고, parse/render/edit/patch 경로에서만 `CanonicalObject`를 내부 표준으로 사용한다.
- Rationale: README의 비목표와 spec의 compatibility 요구를 만족하면서 capability-first rule로 전환할 수 있다.
- Alternatives considered:
  - 저장 포맷까지 즉시 canonical schema로 전환: 변경 범위와 회귀 위험이 과도하다.
  - 기존 tag별 분기 유지: capability 재사용성과 내부 모델 축소 목표를 달성하기 어렵다.

## Decision 2: semantic role은 최소 안정 canonical 집합으로 시작한다

- Decision: canonical 저장 모델의 `semanticRole`은 `topic`, `shape`, `sticky-note`, `image`, `sticker`, `sequence`의 최소 안정 집합으로 시작한다.
- Rationale: clarified spec이 원하는 것은 role 확장이 아니라 canonical model 축소이며, 대부분의 의미 차이는 content kind나 capability로 표현 가능하다.
- Alternatives considered:
  - 공개 alias 수준으로 세분화된 role 유지: canonical 모델 수가 다시 증가한다.
  - 지나치게 평평한 generic role로 축소: `Sticky`, `Image`, `Sequence`의 의미 경계가 흐려진다.

## Decision 3: legacy 문서는 alias와 props로 capability를 자동 추론한다

- Decision: explicit capability metadata가 없는 legacy 문서는 parser가 alias와 legacy props를 보고 canonical capability set을 추론한다.
- Rationale: upfront migration 없이도 기존 문서를 열고 편집하고 저장할 수 있어야 한다.
- Alternatives considered:
  - legacy 문서를 read-only로 처리: feature의 실사용 가치가 낮아진다.
  - 첫 저장 시 강제 migration: 현재 범위의 비목표와 충돌한다.

## Decision 4: precedence는 explicit capability > inferred legacy props > alias preset defaults 순서로 적용한다

- Decision: 명시적 user capability가 최우선이고, explicit metadata가 없을 때는 legacy props inference를 사용하며, alias preset default는 여전히 비어 있는 값만 채운다.
- Rationale: authoring sugar를 유지하면서도 사용자 의도를 가장 정확히 보존한다.
- Alternatives considered:
  - preset 우선: explicit override가 예측 불가능해진다.
  - 충돌을 무조건 오류 처리: 기존 alias ergonomics를 지나치게 약화한다.

## Decision 5: `Sticky`는 semantic alias이며 일부 기본 capability 제거로 자동 강등되지 않는다

- Decision: `Sticky` alias로 작성된 객체는 일부 sticky-default capability가 제거되어도 canonical `semanticRole`을 `sticky-note`로 유지한다.
- Rationale: clarified spec에서 `Sticky`는 authoring preset family이며, 일부 defaults 제거가 곧 의미 상실을 뜻하지는 않는다.
- Alternatives considered:
  - capability가 줄면 일반 object로 강등: explicit alias 의미가 저장 시점마다 흔들린다.
  - capability 제거를 invalid로 처리: 사용자가 defaults를 제어할 수 있는 범위를 너무 좁힌다.

## Decision 6: content-kind 불일치는 자동 보정하지 않고 명시적으로 거부한다

- Decision: declared `content.kind`와 맞지 않는 필드 조합은 normalization 또는 validation 단계에서 명시적으로 reject하고 위반 필드를 진단한다.
- Rationale: `Image`/`Markdown`/`Sequence`의 strong content contract를 보존하려면 조용한 무시나 추측 기반 보정은 부적절하다.
- Alternatives considered:
  - 조용한 무시: 오류가 숨어서 편집 신뢰도를 떨어뜨린다.
  - 자동 보정/변환: 잘못된 의미 추론을 일으킬 가능성이 높다.

## Decision 7: capability 선언은 allow-list registry로 제한한다

- Decision: object가 가질 수 있는 capability key와 payload는 registry 기반 allow-list로 검증한다.
- Rationale: prop soup를 막고 editability/serializer/patcher surface를 좁게 유지할 수 있다.
- Alternatives considered:
  - 자유 형태 prop 허용: 검증과 회귀 관리가 불가능해진다.
  - alias별 하드코딩 allow-list 유지: 새 기능 추가 때마다 중복이 누적된다.

## Decision 8: renderer/editability/patcher는 capability-first로 전환하되 legacy fallback을 단계적으로 축소한다

- Decision: Phase 1~2에서는 canonical capability/content metadata를 우선 사용하고, 아직 정규화되지 않은 경로에 한해 legacy fallback을 제한적으로 유지한다.
- Rationale: 점진 전환이 공개 API 호환성과 회귀 리스크를 동시에 관리하기 쉽다.
- Alternatives considered:
  - 즉시 tag 분기 제거: 초기 실패 시 영향 범위가 크다.
  - dual path 장기 유지: 기술 부채가 고착된다.

## Decision 9: validation은 TypeScript 타입과 runtime validator를 병행한다

- Decision: 컴파일 타임에는 capability/content 타입을 강제하고, 런타임에는 alias input과 legacy input에 대해 validator를 적용한다.
- Rationale: 외부/legacy 입력 안정성을 확보하면서도 개발 단계에서 빠르게 오류를 발견할 수 있다.
- Alternatives considered:
  - 타입만 사용: runtime 안전성이 부족하다.
  - runtime만 사용: 개발 생산성과 지역적 추론이 나빠진다.

## Decision 10: 남은 장기 분류 이슈는 후속 ADR 또는 analyze 단계에서 다룬다

- Decision: `Markdown` alias 독립 유지 범위, `Sticker`의 capability 흡수 여부, `Sequence`의 장기 분류 축은 현재 구현 블로커가 아니므로 후속 ADR 또는 analyze에서 다룬다.
- Rationale: clarified spec과 plan 수준에서는 기본 정책만으로도 구현 범위를 안전하게 고정할 수 있다.
- Alternatives considered:
  - 지금 모두 확정: 근거 없는 조기 고정이 된다.
  - 완전 미정으로 방치: 후속 task 분해에서 해석 불일치가 발생할 수 있다.

## Clarification Resolution Status

- `/speckit.clarify` completed with 5 accepted answers.
- 반영된 핵심 정책:
  - role granularity: 최소 안정 canonical role 집합
  - legacy compatibility: alias + legacy props 기반 capability inference
  - precedence: explicit user capability 우선, alias preset은 누락값만 보완
  - sticky semantics: 일부 기본 capability 제거 후에도 `sticky-note` 유지
  - content validation: content-kind mismatch는 명시적 오류와 진단으로 처리
- Deferred:
  - `Markdown` alias 독립 유지 범위
  - `Sticker` capability 흡수 여부
  - `Sequence` 장기 분류 축
