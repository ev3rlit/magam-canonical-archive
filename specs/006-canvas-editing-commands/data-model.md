# Data Model: TSX-Backed Canvas Editing Commands

## 1) EditTarget

- Purpose: 렌더된 노드에서 원본 TSX patch 대상까지 라우팅하는 최소 식별 모델.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `sourceId` | string | Yes | patch 대상 JSX element의 canonical id |
| `filePath` | string | Yes | patch 대상 파일 경로 |
| `renderedId` | string \| undefined | No | runtime selection/debug 용 fully-qualified id |
| `scopeId` | string \| undefined | No | MindMap 또는 owning scope |
| `frameScope` | string \| undefined | No | frame-local id 축소/확장용 scope |

### Validation

- `sourceId`는 해당 `filePath` 안에서 patch 대상 JSX element 1건으로 resolve되어야 한다.
- `filePath`가 누락되거나 resolve 실패 시 command는 실행되지 않는다.

## 2) EditMeta

- Purpose: UI와 patcher가 target node의 편집 가능 범위를 같은 규칙으로 판단하기 위한 파생 메타데이터.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `family` | `'canvas-absolute' \| 'relative-attachment' \| 'mindmap-member' \| 'rich-content'` | Yes | 편집 해석 기준 |
| `contentCarrier` | `'label-prop' \| 'text-child' \| 'markdown-child' \| undefined` | No | content patch surface |
| `relativeCarrier` | `'gap' \| 'at.offset' \| undefined` | No | 상대 위치 patch surface |
| `styleEditableKeys` | string[] | Yes | UI에서 노출 가능한 style field whitelist |
| `createMode` | `'canvas' \| 'mindmap-child' \| 'mindmap-sibling' \| undefined` | No | 허용 생성 방식 |
| `readOnlyReason` | string \| undefined | No | editable subset 밖일 때 표시 이유 |

### Validation

- `readOnlyReason`가 있으면 content/style/rename/create/reparent command를 열 수 없다.
- `relativeCarrier`가 있으면 `family`는 반드시 `relative-attachment`여야 한다.
- `contentCarrier==='markdown-child'`인 경우 저장 포맷은 markdown source string이어야 한다.

## 3) EditCommandEnvelope

- Purpose: 모든 semantic command가 공유하는 transport-neutral envelope.

```ts
type EditCommandEnvelope = {
  commandId: string;
  type:
    | 'node.move.absolute'
    | 'node.move.relative'
    | 'node.content.update'
    | 'node.style.update'
    | 'node.rename'
    | 'node.create'
    | 'mindmap.child.create'
    | 'mindmap.sibling.create'
    | 'node.reparent';
  target: EditTarget;
  baseVersion: string;
  originId: string;
  issuedAt: number;
};
```

### Validation

- `baseVersion`는 현재 파일 hash와 일치해야만 commit할 수 있다.
- `commandId`는 동일 편집 결과 이벤트와 1:1로 매핑 가능해야 한다.

## 4) Command Payload Families

### 4-1) MoveAbsolutePayload

```ts
type MoveAbsolutePayload = {
  previous: { x: number; y: number };
  next: { x: number; y: number };
};
```

### 4-2) MoveRelativePayload

```ts
type MoveRelativePayload = {
  carrier: 'gap' | 'at.offset';
  previous: { gap?: number; at?: { offset: number } };
  next: { gap?: number; at?: { offset: number } };
};
```

### 4-3) ContentUpdatePayload

```ts
type ContentUpdatePayload = {
  carrier: 'label-prop' | 'text-child' | 'markdown-child';
  previous: { content: string };
  next: { content: string };
};
```

### 4-4) StyleUpdatePayload

```ts
type StyleUpdatePayload = {
  previous: Record<string, unknown>;
  patch: Record<string, unknown>;
};
```

### 4-5) RenamePayload

```ts
type RenamePayload = {
  previous: { id: string };
  next: { id: string };
  rewriteSurfaces: ('from' | 'to' | 'anchor' | 'at.target')[];
};
```

### 4-6) CreatePayload

```ts
type CreatePayload = {
  nodeType: 'shape' | 'text' | 'markdown' | 'sticky' | 'sticker' | 'washi-tape' | 'image';
  id: string;
  initialProps?: Record<string, unknown>;
  initialContent?: string;
  placement: CreationPlacement;
};
```

### 4-7) ReparentPayload

```ts
type ReparentPayload = {
  previous: { parentId: string | null };
  next: { parentId: string | null };
};
```

## 5) CreationPlacement

- Purpose: 생성 command에서 삽입 위치와 required prop rule을 고정한다.

```ts
type CreationPlacement =
  | { mode: 'canvas-absolute'; x: number; y: number }
  | { mode: 'mindmap-child'; parentId: string }
  | { mode: 'mindmap-sibling'; siblingOf: string; parentId: string | null };
```

### Validation

- `canvas-absolute`는 `x`,`y`를 요구한다.
- `mindmap-child`는 `parentId`를 요구한다.
- `mindmap-sibling`은 `siblingOf`를 요구하고, multi-root인 경우 `parentId`는 `null`일 수 있다.

## 6) PatchSurfacePolicy

- Purpose: 각 command가 어떤 TSX surface만 만질 수 있는지 명시한다.

| Command | Allowed Surface |
|--------|------------------|
| `node.move.absolute` | `x`, `y` |
| `node.move.relative` | `gap` or `at.offset` |
| `node.content.update` | `label` or text child or markdown child |
| `node.style.update` | `styleEditableKeys` whitelist |
| `node.rename` | `id` + reference rewrite surface |
| `node.create` / `mindmap.*.create` | 신규 JSX element 1건 삽입 |
| `node.reparent` | `from` only |

### Validation

- patch 결과가 Allowed Surface를 벗어나면 command는 reject되어야 한다.

## 7) ReferenceSurface

- Purpose: rename/reparent 시 무결성을 유지해야 하는 참조 표면 목록.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `field` | `'from' \| 'to' \| 'anchor' \| 'at.target'` | Yes | rewrite 대상 |
| `carrier` | `'string' \| 'object-key'` | Yes | 값 저장 방식 |
| `status` | `'in-scope' \| 'future'` | Yes | 현재 구현 범위 여부 |

### Current Scope

- `from`: in-scope
- `to`: in-scope
- `anchor`: in-scope
- `at.target`: future

## 8) EditCompletionEvent

- Purpose: undo/redo의 최소 replay 단위.

```ts
type EditCompletionEvent = {
  eventId: string;
  type:
    | 'ABSOLUTE_MOVE_COMMITTED'
    | 'RELATIVE_MOVE_COMMITTED'
    | 'CONTENT_UPDATED'
    | 'STYLE_UPDATED'
    | 'NODE_RENAMED'
    | 'NODE_CREATED'
    | 'NODE_REPARENTED';
  nodeId: string;
  filePath: string;
  commandId: string;
  baseVersion: string;
  nextVersion: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  committedAt: number;
};
```

### Validation

- 이벤트는 서버 commit 성공 후에만 push한다.
- undo 1회/redo 1회는 항상 이벤트 1건에 대응해야 한다.

## 9) EditHistoryState

- Purpose: event-based undo/redo stack.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `past` | `EditCompletionEvent[]` | Yes | undo stack |
| `future` | `EditCompletionEvent[]` | Yes | redo stack |
| `maxSize` | number | Yes | retained event upper bound |

### Rules

- 새 commit event 추가 시 `future`는 비워진다.
- undo 성공 시 마지막 `past` event를 `future`로 이동한다.
- redo 성공 시 마지막 `future` event를 `past`로 이동한다.

## 10) ReadOnlyGate

- Purpose: editable subset 밖의 TSX 패턴에 대해 command 생성을 막고 이유를 제공한다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `isEditable` | boolean | Yes | 명령 실행 가능 여부 |
| `reason` | string \| undefined | No | read-only 이유 |
| `blockingCommandTypes` | string[] | Yes | 차단할 semantic commands |

## Relationships

- `EditCommandEnvelope.target` -> `EditTarget` (1:1)
- `EditTarget` -> `EditMeta` (1:1 at runtime)
- `CreatePayload.placement` -> `CreationPlacement` (1:1)
- `RenamePayload.rewriteSurfaces` -> `ReferenceSurface[]`
- `EditHistoryState.past/future` -> `EditCompletionEvent[]`
- `ReadOnlyGate`는 `EditMeta.readOnlyReason`와 UI command availability를 동기화한다

## State Transitions

1. `Selected` -> `CommandReady`
   - Trigger: selection + `EditTarget`/`EditMeta` resolution
   - Guard: `ReadOnlyGate.isEditable === true`
2. `CommandReady` -> `OptimisticApplied`
   - Trigger: command build + local reducer
3. `OptimisticApplied` -> `Committed`
   - Trigger: RPC success + `newVersion`
   - Action: `EditCompletionEvent` push
4. `OptimisticApplied` -> `Rejected`
   - Trigger: conflict, patch failure, validation failure
   - Action: rollback + message
5. `Committed` -> `Undoing`
   - Trigger: undo input
6. `Undoing` -> `Undone`
   - Trigger: inverse RPC success
7. `Undone` -> `Redoing`
   - Trigger: redo input
8. `Redoing` -> `Committed`
   - Trigger: replay RPC success
