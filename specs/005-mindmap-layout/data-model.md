# Data Model: Dense MindMap Layout

## 1) MindMapLayoutProfile

- Purpose: 하나의 MindMap 그룹에 적용되는 dense layout 설정과 실행 범위를 정의한다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `groupId` | string | Yes | 대상 MindMap 그룹 식별자 |
| `layoutType` | `'compact'` | Yes | 신규 안정형 dense layout 공개 식별자 |
| `spacing` | number | Yes | 기본 간격 입력 |
| `sourceVersion` | string \| null | No | 현재 레이아웃이 계산된 소스 버전 |

### Validation

- `layoutType`은 dense layout 구현이 연결된 안정형 값이어야 한다.
- `spacing`은 0보다 커야 한다.

## 2) LayoutInputTree

- Purpose: 내부 그룹 레이아웃이 소비하는 MindMap topology 입력 모델.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `groupId` | string | Yes | MindMap 그룹 식별자 |
| `rootIds` | string[] | Yes | 그룹 내부 루트 노드 id 목록 |
| `nodes` | `Map<string, LayoutNode>` | Yes | 그룹 내부 노드 인덱스 |
| `childrenByParent` | `Map<string, string[]>` | Yes | 부모별 자식 순서 |
| `edges` | `{ source: string; target: string }[]` | Yes | 그룹 내부 관계 |

```ts
type LayoutNode = {
  id: string;
  width: number;
  height: number;
};
```

### Validation

- `rootIds.length >= 1` 이어야 한다.
- 각 `rootIds[*]`는 incoming edge가 없어야 한다.
- 사이클이 없어야 한다.
- `childrenByParent` 순서는 입력 graph 순서를 보존해야 한다.

## 3) MeasuredNodeFootprint

- Purpose: 실제 렌더 완료 후 노드가 차지하는 측정 크기를 표현한다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `nodeId` | string | Yes | 측정 대상 노드 id |
| `width` | number | Yes | 실제 렌더 폭 |
| `height` | number | Yes | 실제 렌더 높이 |
| `sourceVersion` | string \| null | No | 측정 시점 소스 버전 |
| `isStable` | boolean | Yes | 최근 측정이 안정 상태인지 여부 |

### Validation

- `width`, `height`는 0보다 커야 한다.
- 같은 `sourceVersion`에서 가장 최근 footprint만 layout signature 계산에 사용한다.

## 4) SubtreeProfile

- Purpose: 자식 서브트리를 압축 배치하기 위한 파생 프로필이다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `rootId` | string | Yes | 서브트리 루트 노드 id |
| `bbox.width` | number | Yes | 서브트리 전체 폭 |
| `bbox.height` | number | Yes | 서브트리 전체 높이 |
| `leftContour` | number[] | Yes | 깊이별 좌측 윤곽 |
| `rightContour` | number[] | Yes | 깊이별 우측 윤곽 |
| `depth` | number | Yes | 서브트리 깊이 |
| `leafCount` | number | Yes | leaf 수 |

### Validation

- `leftContour.length === rightContour.length` 이어야 한다.
- contour는 같은 depth 기준 좌표계에서 계산되어야 한다.
- `bbox`는 subtree 내 모든 footprint를 포함해야 한다.

## 5) SiblingPlacementFrame

- Purpose: 한 부모 아래 형제 서브트리를 하나의 cluster로 합성한 결과를 표현한다.
- 같은 합성 규칙은 그룹 최상위의 root cluster에도 재사용된다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `parentId` | string | Yes | 부모 노드 id |
| `childOrder` | string[] | Yes | 형제 순서 |
| `placements` | `Map<string, { x: number; y: number }>` | Yes | 각 자식 서브트리의 상대 배치점 |
| `clusterWidth` | number | Yes | 형제 cluster 폭 |
| `clusterHeight` | number | Yes | 형제 cluster 높이 |
| `spreadFactor` | number | Yes | fan-out 정도를 나타내는 0~1 연속 값 |

### Validation

- `placements`는 `childOrder`의 모든 자식 id를 포함해야 한다.
- `spreadFactor`는 자식 수, subtree aspect ratio, contour clearance로 결정되어야 하며 hard switch를 사용하지 않는다.
- cluster는 sibling overlap이 없어야 한다.

## 6) RelayoutGuardState

- Purpose: post-render 재배치가 무한 루프 없이 수렴하도록 제어한다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `groupId` | string | Yes | 대상 MindMap 그룹 |
| `sourceVersion` | string \| null | No | 현재 relayout guard가 묶인 소스 버전 |
| `lastSignature` | string | Yes | quantized footprint signature |
| `pending` | boolean | Yes | debounce 대기 중 여부 |
| `inFlight` | boolean | Yes | 현재 relayout 수행 중 여부 |
| `retryCount` | number | Yes | 현재 버전에서 실행된 자동 보정 횟수 |
| `maxRetries` | number | Yes | 허용 최대 자동 보정 횟수 |

### Validation

- `retryCount <= maxRetries` 이어야 한다.
- signature가 동일하면 추가 relayout을 예약하지 않는다.
- 새 `sourceVersion`이 들어오면 `retryCount`는 초기화된다.

## 7) LayoutBenchmarkSnapshot

- Purpose: dense layout 품질을 정량 비교하기 위한 fixture 결과 집합이다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `fixtureId` | string | Yes | benchmark fixture 식별자 |
| `layoutType` | string | Yes | 비교 대상 layout 이름 |
| `occupiedArea` | number | Yes | 전체 bounding box 면적 |
| `maxSiblingSpan` | number | Yes | 최대 형제 cluster 수직 span |
| `meanSiblingGap` | number | Yes | 인접 형제 branch 평균 수평 공백 |
| `overlapCount` | number | Yes | 최종 overlap 수 |

### Validation

- 같은 fixture는 동일한 metric 계산 방식으로 비교되어야 한다.
- `overlapCount === 0`이 dense layout 최종 pass 조건이다.

## Relationships

- `MindMapLayoutProfile.groupId` -> `LayoutInputTree.groupId` (1:1)
- `LayoutInputTree.nodes[*]` -> `MeasuredNodeFootprint.nodeId` (1:1 latest measurement)
- `LayoutInputTree.rootIds[*]` -> `SubtreeProfile.rootId` (1:N over root and recursive subtrees)
- `SubtreeProfile.rootId` -> `SiblingPlacementFrame.childOrder[]` (N:1 parent frame)
- `MindMapLayoutProfile.groupId` -> `RelayoutGuardState.groupId` (1:1 active guard)
- `LayoutBenchmarkSnapshot.fixtureId` compares multiple `layoutType` results for the same fixture

## State Transitions

1. `Parsed` -> `Measured`
   - Trigger: 그룹 노드의 실제 footprint 측정 완료
   - Guard: 최소 1개의 유효 노드 측정 존재
2. `Measured` -> `Profiled`
   - Trigger: 각 root subtree와 자식 subtree profile(contour/bbox) 계산
   - Action: `SubtreeProfile` 생성
3. `Profiled` -> `Placed`
   - Trigger: 부모별 sibling placement frame과 최상위 root cluster 합성
   - Action: 그룹 내부 상대 좌표 계산
4. `Placed` -> `OffsetApplied`
   - Trigger: 전역 group offset 및 anchor 보정 적용
   - Action: 캔버스 좌표 반영
5. `OffsetApplied` -> `Settled`
   - Trigger: layout signature가 안정 상태로 유지됨
6. `Settled` -> `PendingRelayout`
   - Trigger: footprint signature 변경 감지
   - Guard: `retryCount < maxRetries`
7. `PendingRelayout` -> `Relayouting`
   - Trigger: debounce 만료 + `inFlight === false`
8. `Relayouting` -> `Settled`
   - Trigger: 새로운 non-overlap 좌표 적용 + signature 고정
9. `Relayouting` -> `GuardStopped`
   - Trigger: `retryCount === maxRetries`
   - Action: 자동 재배치 중단, 마지막 안정 좌표 유지
