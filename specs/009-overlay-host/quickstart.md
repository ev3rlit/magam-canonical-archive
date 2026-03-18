# Quickstart: Overlay Host

## 목적

`009-overlay-host` 기능의 설계 산출물을 기준으로 구현 준비와 검증 절차를 재실행하기 위한 최소 가이드.

## 작업 문서 링크

- 스펙: `specs/009-overlay-host/spec.md`
- 플랜: `specs/009-overlay-host/plan.md`
- 리서치: `specs/009-overlay-host/research.md`
- 데이터 모델: `specs/009-overlay-host/data-model.md`
- 계약:
  - `specs/009-overlay-host/contracts/overlay-host-contract.md`
  - `specs/009-overlay-host/contracts/overlay-positioning-contract.md`
  - `specs/009-overlay-host/contracts/overlay-dismiss-focus-contract.md`
  - `specs/009-overlay-host/contracts/overlay-integration-boundary-contract.md`

## 1) 준비

```bash
cd /Users/danghamo/Documents/gituhb/magam-feature-dbfcp-overlay-host
bun install
```

## 2) 구현 순서 (요약)

1. overlay host contract/slot state 모델 추가
2. positioning shell(anchor, clamp, flip, stacking) 구현
3. dismiss reason + focus lifecycle 공통화
4. 기존 `ContextMenu` 동작을 host primitive로 흡수
5. `useContextMenu`를 menu item 계산 + open adapter 역할로 축소
6. canvas 4개 surface를 host slot contribution 방식으로 연결

## 3) 구현 상태

- `app/features/overlay-host/` 아래에 host state, commands, lifecycle, positioning, provider, slot registry를 추가했다.
- `app/components/GraphCanvas.tsx`는 `OverlayHostProvider`를 mount하고 toolbar를 host contribution으로 등록한다.
- `app/components/ContextMenu.tsx`는 portal/listener 소유를 제거하고 host가 렌더하는 menu surface primitive가 됐다.
- `app/hooks/useContextMenu.ts`는 item 계산 + open/replace/selection-change dismiss adapter만 소유한다.
- `selection-floating-menu` consumer 자체는 아직 없지만, `selection-bounds` anchor 및 재배치 helper는 host에 준비돼 있다.

## 4) 체크포인트

- Checkpoint A: 4개 surface가 동일 host contract를 사용한다.
- Checkpoint B: outside click/Escape/selection change dismiss가 동일 reason 체계로 수집된다.
- Checkpoint C: open focus/close restore가 surface 공통 정책으로 동작한다.
- Checkpoint D: pointer/selection/viewport-fixed anchor 배치가 boundary 침범 없이 동작한다.
- Checkpoint E: bubble overlay/drag feedback/toast와 z-layer 충돌이 없다.
- Checkpoint F: surface 구현에서 개별 `createPortal`/전역 listener 중복이 제거된다.

## 5) 테스트 가이드

```bash
# overlay host + canvas/context menu 관련 회귀
bun test app/features/overlay-host/state.test.ts app/features/overlay-host/positioning.test.ts app/features/overlay-host/lifecycle.test.ts app/features/overlay-host/context.test.tsx app/hooks/useContextMenu.test.ts app/components/GraphCanvas.test.tsx app/components/GraphCanvas.viewport.test.ts app/components/editor/WorkspaceClient.test.tsx

# 타입 검증
bunx tsc --noEmit
```

## 6) 검증 결과

- 2026-03-18: `bun install` 완료
- 2026-03-18: `bun test app/features/overlay-host/state.test.ts app/features/overlay-host/positioning.test.ts app/features/overlay-host/lifecycle.test.ts app/features/overlay-host/context.test.tsx app/hooks/useContextMenu.test.ts app/components/GraphCanvas.test.tsx app/components/GraphCanvas.viewport.test.ts app/components/editor/WorkspaceClient.test.tsx` 통과
  - 결과: `65 pass`, `0 fail`
- 2026-03-18: `bunx tsc --noEmit` 통과

## 7) 수동 검증 시나리오

1. pane menu를 화면 모서리에서 열어 clamp/flip이 정상 동작하는지 확인한다.
2. node menu를 연 뒤 Escape/outside click으로 닫아 dismiss reason과 focus 복귀를 확인한다.
3. selection 이동 중 floating menu가 anchor를 따라 재배치되는지 확인한다.
4. toolbar/floating/pane/node overlay가 동시에 존재할 때 레이어 순서가 일관적인지 확인한다.
5. canvas 외부 global overlay와 canvas overlay가 서로 간섭하지 않는지 확인한다.

## 8) 정량 검증 기준

- SC-001: 4개 surface host contract 재사용률 100%
- SC-002: dismiss 규칙 불일치 0건
- SC-003: focus lifecycle 실패율 0%
- SC-004: viewport 경계 침범 0건
- SC-005: z-index 충돌 0건
- SC-006: slot contribution 기반 신규 연결 사례 1건 이상
