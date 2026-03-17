# Research: Workspace `className` Runtime

## Decision 1: Workspace styling path remains isolated, but safelist bootstrap coexists during rollout

- Decision: Workspace `className` 해석은 dedicated runtime path로 이동하되, 기존 safelist 생성 및 dev bootstrap 경로(`app-dev.ts`, safelist generator, tailwind config)는 전환 기간 동안 유지한다.
- Rationale: 즉시 피드백 가치를 확보하면서도 `7932903` 기반 안정화 경로를 깨지 않는 것이 릴리스 리스크를 가장 낮춘다.
- Alternatives considered:
  - Runtime path 전면 전환: bootstrap 회귀 위험이 큼.
  - Safelist-only 유지: className 지원 확장성과 진단 품질이 제한됨.

## Decision 2: V1 support is class-category first, not node-family first

- Decision: v1 지원 축은 "어떤 node family인가"보다 "어떤 class category인가"로 정한다.
- Rationale: 사용자 요구가 object 이름보다 style 결과에 집중되어 있고, category 기준이 확장/진단/테스트 경계를 더 명확히 만든다.
- Alternatives considered:
  - Node-family whitelist 우선: 신규 object 확장 때 유지보수 비용이 큼.
  - 무제한 category 허용: 예측 가능성과 품질 확보가 어려움.

## Decision 3: Eligible object rule is based on current styling/size prop surfaces

- Decision: eligible object는 현재 styling 또는 size 관련 props/className surface를 이미 제공하는 오브젝트로 정의한다.
- Rationale: 기존 지원 표면을 재사용하면 behavior-safe rollout이 가능하고, spec FR-004/FR-016과 직접 정렬된다.
- Alternatives considered:
  - 모든 object 일괄 eligible: 적용/진단 오류가 급증할 위험.
  - object type 이름 고정 목록: spec의 category 중심 방향과 충돌.

## Decision 4: V1 priority class categories are fixed

- Decision: v1 우선 category는 최소한 다음 4개를 고정한다.
  - size
  - basic visual styling
  - shadow/elevation
  - outline/emphasis (sticker-outline-like emphasis 포함)
- Rationale: 사용자 체감이 큰 범위를 우선 보장하고, 미지원 category는 진단으로 처리하는 편이 출시 가능성이 높다.
- Alternatives considered:
  - arbitrary value/variant 우선: 안정성보다 범위를 앞세우게 됨.
  - 단일 category만 우선 지원: 초기 가치가 낮아짐.

## Decision 5: Unsupported input stays observable and structured

- Decision: unsupported object/category/token 입력은 구조화된 진단으로 노출하고, mixed input은 partial apply를 기본 동작으로 한다.
- Rationale: silent failure를 피하면서도 사용 가능한 입력까지 막지 않는다.
- Alternatives considered:
  - silent ignore: 디버깅 불가능.
  - any-unsupported hard fail: 사용자 작업 흐름 방해.

## Decision 6: Session freshness uses last-write-wins semantics

- Decision: 같은 object에 대한 연속 update는 최신 입력만 유효하며 stale update는 진단을 남기고 무시한다.
- Rationale: 편집기 상호작용 기대치와 SC-002를 만족한다.
- Alternatives considered:
  - strict queue replay: 복잡도 증가 대비 가치 낮음.
  - 강한 debounce: 최신 피드백 지연 위험.

## Assumptions captured for planning

- 기존 editor state/file sync 흐름은 그대로 사용한다.
- 앱 전역 스타일링 체계 교체는 범위 밖이다.
- bootstrap 공존 검증은 문서 메모가 아니라 구현/테스트 작업으로 다룬다.
