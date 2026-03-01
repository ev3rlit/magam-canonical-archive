# Data Model: Washi Tape Object

## 1) WashiTapeNode

- Purpose: 캔버스에서 렌더링/선택/저장되는 1급 와시 테이프 오브젝트.
- Source of truth:
  - Core host element: `graph-washi-tape`
  - App node type: `washi-tape`

### Fields

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | 노드 고유 식별자 |
| `type` | `'washi-tape'` | Yes | 앱 레벨 노드 타입 |
| `position` | `{ x: number; y: number }` | Yes | React Flow 기본 위치 |
| `data.pattern` | `PatternDef` | No | 프리셋/커스텀 패턴 정의 |
| `data.edge` | `EdgeDef` | No | 테이프 가장자리 스타일 |
| `data.texture` | `TextureDef` | No | 텍스처 강도/블렌드 설정 |
| `data.text` | `TextDef` | No | 텍스트 정렬/색상/크기 설정 |
| `data.at` | `AtDef` | Yes | 배치 입력 원본(segment/polar/attach) |
| `data.resolvedGeometry` | `ResolvedGeometry` | Yes | 정규화된 렌더 geometry |
| `data.seed` | string \| number | No | 결정적 지터 계산용 시드 |
| `data.opacity` | number | No | 전체 투명도 |
| `data.children` | `RenderableChild[]` | No | 오버레이 콘텐츠 |
| `data.sourceMeta` | `SourceMeta` | No | 소스 추적 메타 |

### Validation Rules

- `id`는 빈 문자열일 수 없다.
- `data.at`는 반드시 하나의 유니온 분기만 만족해야 한다.
- `data.resolvedGeometry.thickness`는 0보다 커야 한다.
- `data.opacity`는 제공 시 `0 <= opacity <= 1`.
- `attach` 모드에서 `target`은 유효한 노드 ID여야 하며, 미존재 시 fallback 규칙을 적용한다.

## 2) PatternDef

### Variant: PresetPattern

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `'preset'` | Yes | 프리셋 패턴 타입 |
| `name` | string | Yes | 지원 프리셋 이름 |

Validation:
- `name`은 허용된 프리셋 목록에 포함되어야 한다.

### Variant: SolidPattern

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `'solid'` | Yes | 단색 패턴 타입 |
| `color` | string | Yes | 유효 색상 표현값 |

### Variant: SVGPattern

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `'svg'` | Yes | SVG 패턴 타입 |
| `src` | string | No | 외부 SVG 소스 |
| `markup` | string | No | inline SVG markup |

Validation:
- `src` 또는 `markup` 중 하나 이상 필요.
- `markup`은 sanitize allowlist 통과 후 렌더.

### Variant: ImagePattern

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `'image'` | Yes | 이미지 패턴 타입 |
| `src` | string | Yes | 이미지 경로/URL |
| `scale` | number | No | 패턴 스케일 |
| `repeat` | `'repeat-x' \| 'repeat' \| 'stretch'` | No | 반복 방식 |

Validation:
- `src` 비어있으면 fallback preset 적용.

## 3) AtDef (Placement)

### SegmentAt

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `'segment'` | Yes | 모드 식별자 |
| `from` | `{ x: number; y: number }` | Yes | 시작 좌표 |
| `to` | `{ x: number; y: number }` | Yes | 끝 좌표 |
| `thickness` | number | No | 두께 |

### PolarAt

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `'polar'` | Yes | 모드 식별자 |
| `x` | number | Yes | 기준 좌표 x |
| `y` | number | Yes | 기준 좌표 y |
| `length` | number | Yes | 길이 |
| `angle` | number | No | 각도 (미지정 시 지터 적용) |
| `thickness` | number | No | 두께 |

### AttachAt

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `'attach'` | Yes | 모드 식별자 |
| `target` | string | Yes | 부착 대상 노드 ID |
| `placement` | enum | No | 대상 기준 방향 |
| `span` | number | No | 대상 폭 점유율(0..1) |
| `align` | number | No | 정렬 비율(0..1) |
| `offset` | number | No | 오프셋(px) |
| `from` | `[number, number]` | No | 로컬 시작점 |
| `to` | `[number, number]` | No | 로컬 끝점 |
| `followRotation` | boolean | No | 대상 회전 추종 여부 |
| `clipToTarget` | boolean | No | 대상 경계 클리핑 여부 |
| `thickness` | number | No | 두께 |

## 4) ResolvedGeometry

- Purpose: 모든 배치 입력 모드를 렌더 공통 표현으로 변환한 결과.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `from` | `{ x: number; y: number }` | Yes | 정규화 시작점 |
| `to` | `{ x: number; y: number }` | Yes | 정규화 끝점 |
| `thickness` | number | Yes | 확정 두께 |
| `angle` | number | Yes | 확정 회전 각도 |
| `length` | number | Yes | 확정 길이 |
| `mode` | `'segment' \| 'polar' \| 'attach'` | Yes | 원본 모드 추적 |
| `targetSnapshot` | object | No | attach 계산 시 대상 스냅샷 |

Validation:
- `length > 0`이어야 하며, 0 또는 비정상 계산 시 최소 길이 fallback 적용.

## 5) TextDef

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `align` | `'start' \| 'center' \| 'end'` | No | 내부 정렬 |
| `color` | string | No | 텍스트 색상 |
| `size` | number | No | 폰트 크기 |

Rules:
- 기본 정렬은 `center`.
- overflow는 2줄 우선, 이후 말줄임 적용.

## 6) SourceMeta

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `sourceId` | string | Yes | 원본 요소 ID |
| `kind` | `'canvas' \| 'mindmap'` | Yes | 스코프 종류 |
| `scopeId` | string | No | mindmap 스코프 ID |

## Relationships

- `WashiTapeNode.data.pattern` -> `PatternDef` (1:1)
- `WashiTapeNode.data.at` -> `AtDef` (1:1)
- `WashiTapeNode.data.at(attach.target)` -> 타겟 노드 ID (N:1)
- `WashiTapeNode.data.at` -> `ResolvedGeometry` (정규화 파생 관계)

## State Transitions

1. `Inserted` -> `Normalized`
   - Trigger: 와시 테이프 삽입 또는 props 변경
   - Action: `AtDef`를 `ResolvedGeometry`로 변환
2. `Normalized` -> `Rendered`
   - Trigger: 노드 렌더 단계
   - Action: 패턴 sanitize/fallback + geometry 반영
3. `Rendered` -> `Persisted`
   - Trigger: 문서 저장
   - Action: 직렬화된 host props 저장
4. `Persisted` -> `Rehydrated`
   - Trigger: 문서 재열기
   - Action: parser가 동일 타입/속성으로 복원
5. `Rehydrated` -> `FallbackRendered` (조건부)
   - Trigger: invalid pattern, 누락된 target, 외부 에셋 불가
   - Action: 기본 preset + 안전 geometry로 대체 렌더
