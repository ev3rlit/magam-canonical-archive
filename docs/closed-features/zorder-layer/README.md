# Z-Order Layer 기능 PRD

## 1) 배경

현재 캔버스에서 요소가 겹칠 때 렌더 순서가 명확히 표준화되어 있지 않아, 스티커/와시테이프가 스티키·마인드맵·쉐이프 아래로 들어가 보이지 않는 문제가 발생한다.

특히 장식/강조 성격의 요소(스티커, 와시테이프)는 항상 상단에 있어야 사용자 의도와 일치하며, 편집 중에도 레이어를 직관적으로 제어할 수 있어야 한다.

## 2) 문제 정의

- 컴포넌트 타입별 기본 z-order 기준이 없다.
- 노드 단위로 명시적 z-order를 지정/저장/패치하는 경로가 불완전하다.
- 동일한 장면을 다시 열었을 때 레이어 순서가 의도와 다르게 보일 수 있다.
- 사용자 관점에서 레이어를 빠르게 조정할 도구가 부족하다.

핵심 문제는 "모든 컴포넌트에 공통으로 적용되는 z-order 정책 + 사용자 제어 UX"가 없다는 점이다.

## 3) 목표와 비목표

### 목표

- 모든 주요 컴포넌트(Sticky, Shape, Text, Markdown, Image, MindMap 관련 노드, Sticker, WashiTape)에 대해 기본 z-order를 정의한다.
- 스티커/와시테이프는 항상 최상위 레이어에 유지한다.
- 각 요소에 `zIndex`를 명시적으로 지정할 수 있게 한다.
- 레이어 조작 UX(레이어 패널/정렬 액션/단축 조작)를 제공한다.
- 저장/재로드/WS patch/내보내기에서 동일한 레이어 결과를 유지한다.

### 비목표

- 포토샵 수준의 복합 블렌딩 모드 지원
- 그룹별 독립 스택 컨텍스트(레이어 폴더) v1
- 자동 충돌 회피 레이아웃과 z-order를 동시에 최적화하는 고급 엔진

## 4) 기본 레이어 정책 (v1)

z-order는 숫자가 클수록 앞(상단)에 배치한다.

| 레이어 밴드 | 기본 zIndex | 대상 |
|---|---:|---|
| Background | 0 | 캔버스 배경/그리드(노드 외 시스템 레이어) |
| Base | 100 | `shape`, `sticky`, `text`, `markdown`, `image`, `sequence-diagram`, 일반 MindMap 자식 |
| Structure | 200 | MindMap 컨테이너/그룹 메타 시각 요소(필요 시) |
| Overlay | 900 | `sticker` |
| Overlay+ | 910 | `washi-tape` |

정책 원칙:

- 스티커/와시테이프는 항상 `Overlay` 이상을 유지한다.
- 같은 `zIndex`에서는 기존 선언 순서(문서 순서)를 tie-breaker로 사용한다.
- 값 간 간격(예: 100 단위)을 두어 사용자가 중간 레이어를 추가하기 쉽게 한다.

## 5) 기능 요구사항

### FR-1. 전 컴포넌트 공통 `zIndex` 지원

- 모든 노드성 컴포넌트 prop 인터페이스에 `zIndex?: number`를 명시한다.
- 렌더 파서에서 `zIndex`를 읽어 React Flow 노드 레벨에 반영한다.
- `zIndex` 미지정 시 타입별 기본값을 사용한다.

수용 기준

- [AC-01] 동일 파일을 여러 번 로드해도 레이어 순서가 재현된다.
- [AC-02] `zIndex`가 없는 기존 문서도 기본 정책으로 안정적으로 렌더된다.

### FR-2. 스티커/와시 최상위 강제

- `sticker`, `washi-tape`는 `zIndex`를 낮게 지정해도 최상위 밴드 아래로 내려가지 않는다.
- 내부 계산은 `effectiveZ = max(requestedZ, overlayFloor)` 규칙으로 처리한다.

수용 기준

- [AC-03] 스티커/와시가 스티키/쉐이프/마인드맵 뒤로 가려지지 않는다.
- [AC-04] 스티커/와시끼리는 명시적 값 또는 문서 순서대로 앞뒤가 결정된다.

### FR-3. 명시적 z-order 지정 경로 제공

- TSX/DSL: `<Sticky zIndex={180} />` 형태 지원
- WS patch: `node.update`에서 `props.zIndex` 갱신 가능
- 생성 API: `node.create`에서도 `zIndex` 지정 가능

수용 기준

- [AC-05] 실시간 patch 후 즉시 레이어가 변경되고 화면에 반영된다.
- [AC-06] 파일 저장 후 재시작해도 동일 z-order가 유지된다.

### FR-4. 레이어 UX (사용 편의성)

- 선택 요소 대상으로 레이어 조작 액션 제공:
  - Bring to front
  - Send to back
  - Bring forward
  - Send backward
- 레이어 패널(또는 Inspector 섹션)에서 현재 요소의 `zIndex`를 확인/입력 가능
- 다중 선택 시 일괄 적용 가능

수용 기준

- [AC-07] 마우스 중심 사용자가 코드 수정 없이 레이어를 조정할 수 있다.
- [AC-08] 다중 선택 레이어 조작이 누락 없이 적용된다.

## 6) 데이터/알고리즘 설계

### z-order 계산 규칙

```ts
type NodeKind =
  | 'shape'
  | 'sticky'
  | 'text'
  | 'markdown'
  | 'image'
  | 'sequence-diagram'
  | 'sticker'
  | 'washi-tape';

const DEFAULT_Z: Record<NodeKind, number> = {
  shape: 100,
  sticky: 100,
  text: 100,
  markdown: 100,
  image: 100,
  'sequence-diagram': 100,
  sticker: 900,
  'washi-tape': 910,
};

const OVERLAY_FLOOR: Partial<Record<NodeKind, number>> = {
  sticker: 900,
  'washi-tape': 910,
};

function resolveEffectiveZ(kind: NodeKind, requested?: number): number {
  const base = Number.isFinite(requested) ? (requested as number) : DEFAULT_Z[kind];
  const floor = OVERLAY_FLOOR[kind];
  return typeof floor === 'number' ? Math.max(base, floor) : base;
}
```

### 저장 호환성

- 기존 문서: `zIndex` 없으면 타입 기본값 사용
- 신규 문서: 필요한 경우만 `zIndex`를 저장(불필요한 노이즈 방지)
- 정렬 tie-breaker는 선언 순서 기반으로 유지

## 7) 구현 범위 (권장 순서)

1. 타입/파서 정비
- 컴포넌트 Props + parser + graph node model에 `zIndex` 연결
- 기본값/최상위 floor 계산 유틸 추가

2. 동기화 경로 정비
- WS `filePatcher`의 `NodeProps`에 `zIndex` 반영
- `node.update`/`node.create` 테스트 추가

3. UI/UX 추가
- 컨텍스트 메뉴/Inspector에서 레이어 액션 제공
- 다중 선택 일괄 변경 로직 추가

4. 검증
- 회귀 테스트: sticker/washi 가림 현상 재발 방지
- 내보내기 렌더 비교(캔버스 vs 산출물)

## 8) 성공 지표

- 스티커/와시 가림 이슈 재현 케이스 0건
- 레이어 조정 작업 시간 단축(수동 좌표 트릭 불필요)
- 문서 재로드 시 z-order 불일치 이슈 0건

## 9) 오픈 이슈

- MindMap 내부 자식의 기본 z-order를 타입 기준으로만 둘지, 그룹 기준 상대 오프셋을 둘지 결정 필요
- 레이어 패널 UI 위치(오른쪽 Inspector 탭 vs 독립 패널) 확정 필요
