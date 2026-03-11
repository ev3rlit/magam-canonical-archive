# Contract: MindMap Dense Layout Public API

## 목적

사용자가 `MindMap` 컴포넌트에서 dense layout을 선택하는 공개 계약을 정의한다.

## Public Surface

### 1) `MindMap.layout`

- Accepted value: `compact`
- Meaning: 사용자가 작성한 MindMap topology를 유지한 채, 조밀하고 읽기 쉬운 dense MindMap 배치를 요청한다.

### 2) `MindMap.spacing`

- Accepted value: number
- Meaning: dense layout의 기본 간격 기준값
- Behavior: 지정하지 않으면 그룹 기본값을 사용한다.

## Behavioral Guarantees

- `layout="compact"`는 하나의 일관된 배치 규칙으로 동작해야 한다.
- 구현은 형제 수가 많아져도 별도의 사용자-visible layout mode로 전환되어서는 안 된다.
- 결과는 사용자가 작성한 부모-자식 구조를 바꾸지 않아야 한다.
- 최종 렌더 상태는 노드 겹침이 없어야 한다.
- 동일한 입력과 설정에서는 일관된 결과를 만들어야 한다.

## Out of Scope

- 자동 topology 재작성
- 가상 부모 삽입
- `compact` 외 새로운 dense layout 공개 이름 추가
- density 전용 신규 public prop 도입
