# Contract: Migration and Compatibility

## 목적

phase 기반 전환 중 공개 API 호환성과 내부 canonical 전환 규칙을 고정한다.

## Phase Rules

### Phase 1: Normalization Layer

- public alias 유지
- parser에서 alias + legacy props 기반 canonical object 생성
- explicit capability precedence와 legacy inference를 capability metadata에 반영
- capability metadata를 editability/render routing에 주입

### Phase 2: Alias Thinning

- `Sticky`, `Node`를 thin alias로 유지
- `Shape`는 general-purpose alias 유지
- `Image`는 `content:media` alias 유지

### Phase 3: Capability-first Editing

- style whitelist를 capability 기반으로 전환
- create/patch command payload를 canonical schema 기준으로 전환
- legacy tag fallback 사용량을 단계적으로 제거

## Compatibility Rules

1. 기존 alias 기반 문서는 breaking change 없이 로드/렌더/저장 가능해야 한다.
2. legacy 문서는 upfront migration 없이 parser inference를 통해 계속 편집 가능해야 한다.
3. 전체 저장 포맷 일괄 마이그레이션은 본 범위에 포함하지 않는다.
4. arbitrary TSX component는 native editable object로 자동 편입하지 않는다.

## Exit Criteria

- capability 기반 rule이 alias 기반 rule을 대체할 수 있을 만큼 회귀 테스트가 확보되어야 한다.
- content contract 강한 객체의 동작 회귀가 없어야 한다.
- legacy inference 경로와 explicit capability 경로가 동일 canonical gate를 통과해야 한다.

## Failure Contract

- phase 전환 기준 미충족: `MIGRATION_GATE_FAILED`
- backward compatibility 회귀: `LEGACY_COMPAT_REGRESSION`
- legacy inference 실패: `LEGACY_INFERENCE_FAILED`
