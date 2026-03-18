# Data Model: Overlay Host

## 1) OverlaySlotKind

- Purpose: host가 지원하는 overlay surface 종류를 고정한다.

```ts
type OverlaySlotKind =
  | 'toolbar'
  | 'selection-floating-menu'
  | 'pane-context-menu'
  | 'node-context-menu';
```

### Validation

- slot kind는 고정 enum만 허용한다.
- unknown slot kind는 등록 단계에서 거부한다.

## 2) OverlayAnchorDescriptor

- Purpose: positioning shell이 소비하는 anchor 입력을 표준화한다.

```ts
type OverlayAnchorDescriptor =
  | { type: 'pointer'; x: number; y: number }
  | { type: 'selection-bounds'; x: number; y: number; width: number; height: number }
  | { type: 'viewport-fixed'; x: number; y: number };
```

### Validation

- 좌표는 finite number여야 한다.
- `selection-bounds`는 `width >= 0`, `height >= 0`이어야 한다.
- anchor 입력은 viewport clamp 전에만 원본 값을 유지한다.

## 3) OverlayDismissReason

- Purpose: 닫힘 원인을 표준화한다.

```ts
type OverlayDismissReason =
  | 'outside-pointer'
  | 'escape-key'
  | 'selection-change'
  | 'viewport-teardown'
  | 'programmatic-close'
  | 'programmatic-replace';
```

### Validation

- dismiss는 반드시 reason과 함께 기록되어야 한다.
- reason 누락 close는 invalid 상태로 간주한다.

## 4) OverlayFocusPolicy

- Purpose: open/close focus lifecycle 계약을 표현한다.

```ts
type OverlayFocusPolicy = {
  openTarget?: 'first-actionable' | 'explicit-target' | 'none';
  openTargetId?: string;
  restoreTarget?: 'trigger' | 'selection-owner' | 'explicit-target' | 'none';
  restoreTargetId?: string;
};
```

### Validation

- `openTarget='explicit-target'`면 `openTargetId`가 필요하다.
- `restoreTarget='explicit-target'`면 `restoreTargetId`가 필요하다.

## 5) OverlayContribution

- Purpose: surface가 host에 등록하는 최소 계약 단위.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `slot` | `OverlaySlotKind` | Yes | overlay 종류 |
| `priority` | number | Yes | stacking 우선순위 |
| `dismissible` | boolean | Yes | outside/Escape dismiss 허용 여부 |
| `anchor` | `OverlayAnchorDescriptor` | Yes | 배치 기준 |
| `focusPolicy` | `OverlayFocusPolicy` | No | focus lifecycle 규칙 |
| `replaceKey` | string | No | 동일 컨텍스트 replace 기준 |

### Validation

- 동일 slot의 중복 open은 `replace` 정책 또는 close 후 open으로 정규화한다.
- `priority`는 비교 가능한 정수 범위에서 관리한다.

## 6) OverlayInstanceState

- Purpose: 현재 열린 overlay 인스턴스 runtime 상태.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `instanceId` | string | Yes | host 내부 인스턴스 식별자 |
| `slot` | `OverlaySlotKind` | Yes | surface 종류 |
| `anchor` | `OverlayAnchorDescriptor` | Yes | 원본 anchor |
| `resolvedPosition` | `{x:number;y:number}` | Yes | clamp/flip 적용 후 위치 |
| `priority` | number | Yes | stacking 계산용 우선순위 |
| `openedAt` | number | Yes | 생성 시각 |
| `focusPolicy` | `OverlayFocusPolicy` | No | focus lifecycle 정보 |

### Validation

- `resolvedPosition`은 viewport safe margin 내 좌표여야 한다.
- 동일 `instanceId`는 active 집합에서 유일해야 한다.

## 7) OverlayHostState

- Purpose: host 전역 runtime state를 표현한다.

```ts
type OverlayHostState = {
  active: OverlayInstanceState[];
  lastDismissed?: {
    slot: OverlaySlotKind;
    reason: OverlayDismissReason;
    at: number;
  };
};
```

### Validation

- `active` 리스트는 priority + openedAt 기반으로 deterministic order를 가져야 한다.
- dismiss 후 `lastDismissed`는 reason과 timestamp를 함께 기록한다.

## 8) OverlayLifecycleEvent

- Purpose: host의 상태 전이를 추적한다.

```ts
type OverlayLifecycleEvent =
  | { type: 'open-requested'; contribution: OverlayContribution }
  | { type: 'opened'; instance: OverlayInstanceState }
  | { type: 'replace-requested'; targetInstanceId: string; contribution: OverlayContribution }
  | { type: 'dismiss-requested'; instanceId: string; reason: OverlayDismissReason }
  | { type: 'dismissed'; instanceId: string; reason: OverlayDismissReason };
```

### Validation

- `dismissed` 이벤트는 항상 선행 `dismiss-requested` 또는 강제 teardown과 짝을 이룬다.
- `replace-requested`는 대상 instance가 active 상태일 때만 유효하다.

## Relationships

- `OverlayContribution.slot` -> `OverlaySlotKind` (1:1)
- `OverlayContribution.anchor` -> `OverlayAnchorDescriptor` (1:1)
- `OverlayContribution.focusPolicy` -> `OverlayFocusPolicy` (0..1)
- `OverlayInstanceState`는 `OverlayContribution`에서 파생된다.
- `OverlayHostState.active`는 `OverlayInstanceState`의 ordered collection이다.
- `OverlayLifecycleEvent`는 `OverlayHostState` 전이를 일으킨다.

## State Transitions

1. `Idle` -> `OpenRequested`
   - Trigger: surface가 host `open` 호출
   - Guard: valid contribution
2. `OpenRequested` -> `Opened`
   - Trigger: positioning/stacking 계산 완료
   - Guard: anchor/priority validation 통과
3. `Opened` -> `ReplaceRequested`
   - Trigger: 동일 slot 또는 replace key 갱신 요청
   - Guard: target instance active
4. `Opened|ReplaceRequested` -> `DismissRequested`
   - Trigger: outside pointer, Escape, selection change, teardown, programmatic close
5. `DismissRequested` -> `Dismissed`
   - Trigger: lifecycle close 수행 완료
   - Action: reason 기록 및 focus restore 수행
