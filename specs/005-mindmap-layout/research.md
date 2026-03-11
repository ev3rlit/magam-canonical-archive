# Research: Dense MindMap Layout

## 1) 공개 layout 식별자는 `compact`로 고정한다

- **Decision**: 신규 dense MindMap 레이아웃의 공개 식별자는 새 문자열을 추가하지 않고 기존 `compact`를 안정형 이름으로 사용한다.
- **Rationale**: `MindMap` public prop, parser, store, registry에 이미 `compact`가 연결되어 있어 surface 확장을 피할 수 있다. 현재 feature 목표는 새 naming 실험이 아니라 dense layout 품질을 완성하는 것이다.
- **Alternatives considered**:
  - `dense`: 의미는 명확하지만 public prop, parser/store 타입, 예제 문서, migration 표면을 모두 늘린다.
  - `organic`: 사용자 기대치가 넓고 비결정적 레이아웃으로 오해될 수 있다.

## 2) 내부 그룹 레이아웃 엔진은 `d3-flextree` 기반 compact tree를 유지한다

- **Decision**: 내부 그룹의 기본 배치는 `d3-flextree` 기반 compact tree로 유지하고, 기존 ELK layered는 dense layout의 내부 엔진으로 사용하지 않는다.
- **Rationale**: `d3-flextree`는 가변 크기 노드와 결정적 tree layout에 맞고, 현재 코드베이스에도 이미 포함되어 있다. 목표가 "더 조밀하고 더 읽기 쉬운 tree"이므로 layered보다 tree-specific 엔진이 자연스럽다.
- **Alternatives considered**:
  - ELK layered 튜닝: 현행 파이프라인 재사용은 쉽지만 sibling stretching과 deep subtree 공백 문제를 근본적으로 해결하기 어렵다.
  - Voronoi/Treemap/Force 계열: 밀도 표현은 가능하지만 마인드맵의 tree readability와 결정성을 해친다.

## 3) 형제 배치는 별도 모드 전환이 아니라 단일 adaptive 규칙으로 처리한다

- **Decision**: 형제가 많아질 때 `quadrant-pack`나 별도 모드로 전환하지 않고, 모든 부모에서 동일한 adaptive sibling placement 규칙을 사용한다.
- **Rationale**: 작은 입력 변화만으로 layout family가 바뀌면 안정성이 무너진다. 사용자는 같은 레이아웃이 연속적으로 더 넓은 fan-out을 만드는 결과를 기대하며, 이는 단일 규칙이 더 적합하다.
- **Alternatives considered**:
  - sibling count threshold 기반 mode switch: 설명은 쉬우나 임계값 주변에서 결과가 급변한다.
  - quadrant-pack direct adoption: 표현은 강하지만 layout style이 root-heavy branch에만 과도하게 바뀐다.

## 4) 깊은 서브트리 공백은 contour/profile 압축으로 해결한다

- **Decision**: sibling 간 clearance 계산은 bounding box가 아니라 subtree contour/profile을 기준으로 계산한다.
- **Rationale**: 이번 기능의 핵심 결함은 깊은 서브트리 하나가 주변 형제 전체를 밀어내는 것이다. bbox-only spacing은 이 문제를 다시 만든다. level-wise contour comparison을 사용하면 얕은 형제는 실제 충돌 직전까지 더 가깝게 붙을 수 있다.
- **Alternatives considered**:
  - bounding box packing: 구현은 단순하지만 deep subtree spillover를 해결하지 못한다.
  - fixed sibling gap 축소: 모든 경우를 동시에 만족시키지 못하고 overlap 위험을 키운다.

## 5) post-render 안정화는 measured signature + guarded relayout으로 제한한다

- **Decision**: post-render size 변화 대응은 `inFlight guard + 120ms debounce + 2px quantized signature threshold + max 2 auto-relayout cycles` 조합으로 제한한다.
- **Rationale**: 이미지/Markdown 같은 늦은 크기 확정 콘텐츠는 재배치가 필요하지만, 무제한 relayout은 jitter를 만든다. 120ms debounce는 한 프레임보다 충분히 길고 체감상 즉시성도 유지한다. 2px quantization은 measurement jitter를 무시하기에 충분하고, max 2 cycles는 spec의 수렴 요구와 일치한다.
- **Alternatives considered**:
  - size change 즉시 relayout: jitter와 중복 계산이 많다.
  - 무제한 debounce + retry: 안정성은 있지만 "언제 끝나는지"를 보장하지 못한다.
  - 수동 relayout only: 최종 overlap 보장을 만족하지 못한다.

## 6) 다중 MindMap 전역 배치는 기존 ELK 메타 레이아웃을 유지한다

- **Decision**: dense layout 변경 범위는 그룹 내부 배치로 제한하고, 다중 MindMap 간 전역 positioning은 기존 `globalLayoutResolver` 경로를 유지한다.
- **Rationale**: 사용자 문제는 개별 MindMap 내부 품질에 집중되어 있다. 전역 그룹 배치까지 동시에 바꾸면 diff가 커지고 원인 분석이 어려워진다.
- **Alternatives considered**:
  - 전역 배치까지 dense strategy로 치환: 범위가 커지고 회귀 위험이 높다.
  - 그룹 anchor 처리까지 재설계: 현재 사용자 요구와 직접 연결되지 않는다.

## 7) 검증은 fixture 기반 정량 비교를 우선한다

- **Decision**: 구현 완료 판단은 overlap/occupied area/max sibling span/mean sibling gap/repeat-run stability를 포함한 fixture 비교로 고정한다.
- **Rationale**: "사람이 그린 것 같다"는 정성적 표현만으로는 회귀를 막기 어렵다. fixture와 지표를 고정해야 지속적으로 비교 가능하다.
- **Alternatives considered**:
  - 육안 비교 중심 검증: 설득력은 있지만 자동 회귀 방지가 어렵다.
  - 스냅샷 이미지 비교만 사용: overlap 원인과 span/gap 문제를 수치로 설명하기 어렵다.
