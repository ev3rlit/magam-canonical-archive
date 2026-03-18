# Contract: Overlay Host API

## 목적

canvas entrypoint overlay가 공통 lifecycle API를 통해 host에 연결되도록 고정한다.

## Public Surface

- `open(contribution)` -> `instanceId`
- `close(instanceId, reason)`
- `replace(instanceId, nextContribution)` -> `nextInstanceId`
- `closeBySlot(slot, reason)`
- `getActive()` -> ordered overlay list

## Input Contract

- `contribution.slot`은 고정 slot enum이어야 한다.
- `contribution.anchor`는 valid anchor descriptor여야 한다.
- `contribution.priority`는 정렬 가능한 정수여야 한다.
- `close`와 `closeBySlot`는 명시적 dismiss reason을 요구한다.

## Lifecycle Rules

1. `open`은 deterministic `instanceId`를 반환한다.
2. 동일 slot + replace policy가 충족되면 중복 open 대신 `replace`가 수행된다.
3. `replace`는 target instance가 active일 때만 성공한다.
4. close 성공 시 host는 dismiss reason과 timestamp를 기록한다.
5. `getActive()` 결과는 stacking 우선순위와 생성 순서를 일관되게 반영한다.

## Failure Contract

- invalid slot/anchor: `OVERLAY_CONTRIBUTION_INVALID`
- missing dismiss reason: `OVERLAY_DISMISS_REASON_REQUIRED`
- unknown instance: `OVERLAY_INSTANCE_NOT_FOUND`
- replace target inactive: `OVERLAY_REPLACE_TARGET_INVALID`
