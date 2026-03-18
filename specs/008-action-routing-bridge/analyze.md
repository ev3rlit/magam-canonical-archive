# Specification Analysis Report: Action Routing Bridge

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| A1 | Coverage Gap | MEDIUM | `specs/008-action-routing-bridge/spec.md` (FR-011), `specs/008-action-routing-bridge/tasks.md` (T028) | FR-011은 pending state 소유를 `ui-runtime-state`로 고정하지만, 태스크는 `WorkspaceClient.tsx` 연결 중심으로만 정의되어 runtime-state 경계가 약하다. | runtime-state 책임 모듈(또는 adapter) 단위 태스크를 추가해 소유 경계를 명시하고 검증 태스크를 보강한다. |
| A2 | Inconsistency | LOW | `specs/008-action-routing-bridge/plan.md` (Source Code), `specs/008-action-routing-bridge/tasks.md` (T014, T017) | plan의 source tree에는 `app/hooks/useContextMenu.ts`, `app/features/editing/actionGating.test.ts`가 나타나지 않지만 tasks에서 수정/생성 대상으로 사용한다. | plan source tree를 tasks 범위와 일치하도록 갱신하거나 tasks 경로를 축소한다. |
| A3 | Underspecification | MEDIUM | `specs/008-action-routing-bridge/spec.md` (FR-015), `specs/008-action-routing-bridge/tasks.md` | FR-015(bridge contract 호환 유지 + mapping 확장 가능성)에 대응하는 전용 회귀/계약 테스트 태스크가 명시적으로 없다. | 신규 intent 추가 시 기존 contract를 깨지 않는지 검증하는 contract regression 태스크를 추가한다. |

## Coverage Summary

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| `single-bridge-dispatch-for-all-surfaces` | Yes | T012, T013, T014, T015 | 4개 surface bridge 경유 통합 |
| `request-contract-fields` | Yes | T004, T012 | request type + dispatch 진입점 |
| `response-contract-fields` | Yes | T004, T012 | response type + 반환 경로 |
| `payload-normalization` | Yes | T007, T019 | canonical id/relation 정규화 |
| `semantic-capability-gating` | Yes | T008, T020, T022 | alias 기반 게이팅 제거 포함 |
| `explicit-diagnostic-errors` | Yes | T003, T021 | bridge/ws 오류 코드 정렬 |
| `orchestrate-object-and-canvas-create` | Yes | T006, T012, T015 | create 복합 recipe |
| `orchestrate-add-child-flow` | Yes | T006, T012, T015 | relation 포함 복합 recipe |
| `separate-runtime-only-intents` | Yes | T005, T006, T012 | catalog + recipe 타입으로 분리 |
| `emit-optimistic-lifecycle-events` | Yes | T026, T027 | apply/commit/reject 이벤트 |
| `runtime-state-ownership-separation` | Partial | T028 | runtime-state 경계 보강 필요 (A1) |
| `intent-scoped-rollback-diagnostics` | Yes | T025, T029 | rollback 실패 진단 포함 |
| `resolved-context-as-trust-boundary` | Yes | T004, T012, T020 | context 기반 gating |
| `remove-direct-mutation-paths` | Yes | T013, T014, T015, T030 | 검출 테스트 포함 |
| `extend-via-mapping-without-breaking-contract` | Partial | T005, T006 | 회귀 테스트 보강 필요 (A3) |
| `exclude-canonical-schema-definition` | Yes | T031, T032 | 범위 점검/문서 정합성으로 보호 |
| `exclude-selection-and-overlay-positioning` | Yes | T031, T032 | 비범위 점검 태스크로 보호 |

## Constitution Alignment Issues

- CRITICAL 위반 없음.
- contract-first, dependency-linear, silent failure 금지 원칙은 spec/plan/tasks 전반에서 일관된다.

## Unmapped Tasks

- T001, T002, T009: 기반 테스트 인프라 태스크로 직접 요구사항 매핑 없이 공통 검증 기반을 제공한다.
- T031, T032: 문서/검증 폴리시 태스크로 여러 요구사항을 교차 지원한다.

## Metrics

- Total Requirements: 17
- Total Tasks: 32
- Coverage % (requirements with at least Partial): 100%
- Full Coverage % (requirements with explicit Yes): 88.2% (15/17)
- Ambiguity Count: 0
- Duplication Count: 0
- Critical Issues Count: 0

## Next Actions

- CRITICAL 이슈가 없어 `/speckit.implement`로 진행 가능하다.
- 다만 A1, A3는 구현 초반에 반영하는 것을 권장한다.
- 권장 명령:
  - `manual edit`: `specs/008-action-routing-bridge/tasks.md`에 runtime-state 경계 및 contract compatibility regression 태스크 추가
  - `manual edit`: `specs/008-action-routing-bridge/plan.md` source tree를 tasks 경로와 정렬
