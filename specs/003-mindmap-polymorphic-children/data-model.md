# Data Model: MindMap Polymorphic Children

## 1) FromProp

- Purpose: MindMap 자식이 부모 관계와 edge 시각 설정을 선언하는 입력 계약.

### Type

```ts
type FromProp =
  | string
  | {
      node: string;      // nodeId or nodeId:portId, fully-qualified ids allowed
      edge?: EdgeStyle;  // optional edge visual style
    };
```

### Validation

- `string`인 경우 비어 있지 않아야 한다.
- object인 경우 `node` 필수, `edge`는 optional.
- `node`는 `resolveNodeId` 규칙으로 scope 보정 가능해야 한다.

## 2) ParsedFrom

- Purpose: parser 내부 edge 생성용 정규화 결과.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `node` | string | Yes | 정규화된 source endpoint |
| `edge` | `EdgeStyle` | Yes | 시각 옵션(미지정 시 빈 객체) |

### Derivation Rule

- `FromProp`가 string이면 `{ node: from, edge: {} }`.
- `FromProp`가 object면 `{ node: from.node, edge: from.edge ?? {} }`.

## 3) MindMapMembership

- Purpose: 노드가 어떤 MindMap 그룹에 참여하는지 나타내는 런타임 파생 모델.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `nodeId` | string | Yes | React Flow node id |
| `groupId` | string | Yes | MindMap group id |
| `kind` | `'mindmap'` | Yes | source kind |
| `sourceMeta.scopeId` | string | Yes | parser scope id |

### Constraints

- MindMap 참여 노드는 항상 `groupId`를 가져야 한다.
- 동일 `groupId` 내 노드는 하나의 내부 레이아웃 pass 대상이다.

## 4) MindMapTopologyError

- Purpose: 잘못된 MindMap authoring을 deterministic하게 표면화하는 오류 모델.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `'MISSING_FROM' \| 'NESTED_MINDMAP'` | Yes | 오류 분류 |
| `mindmapId` | string | Yes | 오류가 발생한 MindMap id |
| `nodeId` | string | No | 관련 child node id |
| `message` | string | Yes | 사용자 표시 메시지 |

### Rules

- MindMap 컨텍스트 child에서 `from` 누락 시 `MISSING_FROM`.
- MindMap 내부에서 `graph-mindmap` 발견 시 `NESTED_MINDMAP`.

## 5) LayoutSignature

- Purpose: 초기 레이아웃 후 노드 크기 변화를 감지하기 위한 정규화된 시그니처.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `groupId` | string | Yes | 대상 group |
| `entries` | string[] | Yes | `nodeId:widthxheight` 목록 |
| `value` | string | Yes | 정렬/조합된 비교 문자열 |

### Construction

- MindMap 노드만 대상으로 생성한다.
- `width/height`는 2px 양자화 후 문자열화한다.
- `entries`를 id 기준 정렬해 deterministic value를 만든다.

## 6) RelayoutPolicyState

- Purpose: 자동 재레이아웃 실행을 bounded하게 제어하는 상태.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `lastSizeSignature` | string \| null | Yes | 마지막 성공 시그니처 |
| `inFlight` | boolean | Yes | 레이아웃 실행 중 여부 |
| `pendingTimerId` | number \| null | Yes | debounce timer |
| `lastRelayoutAt` | number | Yes | 마지막 재실행 완료 시각(ms) |
| `attemptByGraphId` | Map<string, number> | Yes | graph별 auto relayout 횟수 |

### Policy Defaults

- `debounceMs = 120`
- `cooldownMs = 250`
- `maxAttemptsPerGraph = 3`
- `quantizationPx = 2`

## Relationships

- `FromProp` -> `ParsedFrom` (정규화 1:1)
- `MindMapMembership.groupId` -> `MindMapGroup.id` (N:1)
- `LayoutSignature`는 `MindMapMembership` 집합에서 파생
- `RelayoutPolicyState`는 `graphId`와 `LayoutSignature` 변화에 반응

## State Transitions

1. `ParsedGraphLoaded` -> `InitialLayoutCompleted`
   - Trigger: `graphId` 갱신 + 최초 `calculateLayout` 성공
   - Action: `lastSizeSignature` 저장, attempt 카운터 초기화
2. `InitialLayoutCompleted` -> `RelayoutScheduled`
   - Trigger: MindMap 노드 크기 시그니처 변경 감지
   - Action: debounce 타이머 등록
3. `RelayoutScheduled` -> `RelayoutRunning`
   - Trigger: debounce 만료 + guard 통과
   - Action: `inFlight=true`, `calculateLayout` 호출
4. `RelayoutRunning` -> `RelayoutCompleted`
   - Trigger: 레이아웃 성공
   - Action: signature 갱신, attempt++, cooldown 시작
5. `RelayoutRunning` -> `RelayoutFailed`
   - Trigger: 레이아웃 실패
   - Action: `inFlight` 해제, timer 정리, UI 유지
6. `RelayoutCompleted/Failed` -> `InitialLayoutCompleted`
   - Trigger: 다음 유효 변화 감지(한도 내)
   - Action: 반복
