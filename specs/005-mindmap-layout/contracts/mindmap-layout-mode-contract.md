# Contract: MindMap Layout Mode

## 목적

사용자가 `MindMap`에 dense layout을 선택했을 때, public prop에서 parser/store/strategy 실행까지 어떤 계약이 유지되어야 하는지 정의한다.

## Public Authoring Contract

- 작성자는 `MindMap`에서 `layout="compact"`를 사용할 수 있다.
- `layout="compact"`는 사용자 작성 MindMap topology를 바꾸지 않는 dense MindMap 배치를 의미한다.
- `spacing`은 계속 지원되며, 기본 배치 밀도를 조정하는 보조 입력으로 동작한다.
- `density`는 기존 실험용 전략 호환을 위해 파이프라인에 남아 있을 수 있으나, v1의 안정 `compact` 계약에서는 필수 또는 대표 제어값으로 취급하지 않는다.

## Parser / Store Contract

- `parseRenderGraph.ts`는 `layout="compact"`를 MindMap 그룹의 `layoutType`으로 보존해야 한다.
- `graph.ts`의 `MindMapGroup.layoutType`과 `GraphState.layoutType`은 `compact`를 유효 값으로 유지해야 한다.
- parser/store 계층은 `compact`를 다른 실험용 전략 값으로 치환해서는 안 된다.

## Strategy Execution Contract

- `useLayout.ts`는 그룹의 `layoutType`이 `compact`일 때 dense layout 전략을 호출해야 한다.
- dense layout 전략은 그룹 내부 노드의 상대 좌표를 반환해야 한다.
- dense layout 전략은 parent-child 관계, group membership, anchor 기반 전역 배치 정보를 변경해서는 안 된다.

## Stability Contract

- 동일한 topology, 측정 크기, 설정이 같으면 dense layout 결과는 결정적이어야 한다.
- 렌더 후 크기 변화가 있을 때는 자동 재배치 정책이 작동할 수 있으나, 최종 결과는 안정 상태로 수렴해야 한다.
- 자동 재배치 실패나 최대 시도 횟수 도달 시에도 마지막 유효 레이아웃은 유지되어야 한다.

## Compatibility Notes

- `compact-bidir`, `depth-hybrid`, `quadrant-pack`, `voronoi-pack`는 기존 호환 또는 실험적 경로로 남을 수 있다.
- 이번 feature의 구현/문서/검증 기준은 `compact`의 안정화와 dense quality 향상에 집중한다.
