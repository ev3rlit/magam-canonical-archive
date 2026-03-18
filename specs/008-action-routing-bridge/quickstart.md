# Quickstart: Action Routing Bridge

## 목적

`008-action-routing-bridge` 기능의 구현/검증 기준을 빠르게 재실행하기 위한 최소 절차.

## 작업 문서 링크

- 스펙: `specs/008-action-routing-bridge/spec.md`
- 플랜: `specs/008-action-routing-bridge/plan.md`
- 리서치: `specs/008-action-routing-bridge/research.md`
- 데이터 모델: `specs/008-action-routing-bridge/data-model.md`
- 계약:
  - `specs/008-action-routing-bridge/contracts/intent-catalog-contract.md`
  - `specs/008-action-routing-bridge/contracts/bridge-request-response-contract.md`
  - `specs/008-action-routing-bridge/contracts/normalization-gating-contract.md`
  - `specs/008-action-routing-bridge/contracts/dispatch-orchestration-contract.md`
  - `specs/008-action-routing-bridge/contracts/optimistic-lifecycle-contract.md`
  - `specs/008-action-routing-bridge/contracts/surface-adoption-contract.md`

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-feature-dbfcp-selection-floating-menu
bun install
```

## 2) 구현 순서

1. bridge request/response contract와 intent catalog 타입 추가
2. payload normalization 및 semantic/capability gating 경로 구현
3. 단일/복합 dispatch recipe와 실패 처리 로직 구현
4. optimistic apply/commit/reject 이벤트 발행 및 token 추적 연결
5. 4개 surface를 bridge dispatch API로 전환하고 direct write path 제거
6. ws 재검증 및 오류 계약을 bridge 오류 코드와 동기화

## 3) 구현 체크포인트

- Checkpoint A: `surface + intent` 조합이 intent catalog에서 단일 recipe로 조회된다.
- Checkpoint B: canonical id/reference 해석 실패는 명시적 `NORMALIZATION_FAILED`로 반환된다.
- Checkpoint C: semantic/capability 게이팅이 alias 분기 없이 동작한다.
- Checkpoint D: 복합 intent 실패 시 `reject` 이벤트와 rollback token이 누락 없이 기록된다.
- Checkpoint E: 4개 surface에 direct mutation 호출 경로가 남아있지 않다.

## 4) 테스트

```bash
# bridge catalog/normalization/orchestration 계약 테스트(신규)
bun test app/features/editing/actionRoutingBridge.test.ts app/features/editing/actionGating.test.ts

# ws validation and error contract regression
bun test app/ws/filePatcher.test.ts app/ws/methods.test.ts

# entrypoint surface adoption regression
bun test app/components/GraphCanvas.test.tsx app/components/editor/WorkspaceClient.test.tsx app/store/graph.test.ts

# lightweight import smoke
bunx tsc --noEmit
```

## 5) 수동 검증 시나리오

1. toolbar에서 create intent 실행 시 bridge 경유로 생성되는지 확인한다.
2. selection floating menu style update에서 capability 위반 payload가 명시적 오류로 노출되는지 확인한다.
3. node context menu add-child 복합 흐름 실패 시 reject/rollback 이벤트가 생성되는지 확인한다.
4. pane context menu create와 node rename이 동일 bridge contract를 사용하는지 확인한다.
5. 네 surface에서 direct mutation executor 호출 흔적이 없는지 점검한다.

## 6) 정량 검증 기준

- SC-001: 4개 entrypoint write intent 100% bridge 경유
- SC-002: P1 intent 매핑 정확도 95% 이상
- SC-003: silent failure 0건
- SC-004: rollback 이벤트 누락 0%
- SC-005: 기존 contract 유지 상태에서 신규 intent 1건 이상 확장 가능

## 7) 실행 노트

- 2026-03-18 기준 구현/회귀 검증 완료:
  - `bun test app/features/editing/actionRoutingBridge.test.ts app/features/editing/actionGating.test.ts app/store/graph.test.ts app/components/editor/WorkspaceClient.test.tsx`
  - `bun test app/ws/filePatcher.test.ts app/ws/methods.test.ts app/components/GraphCanvas.test.tsx`
  - `bunx tsc --noEmit`
- selection 해석 로직과 overlay 위치 계산은 이 feature 범위에 포함되지 않는다.
