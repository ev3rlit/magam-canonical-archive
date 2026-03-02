# Phase 0 Research: MindMap Polymorphic Children

## Decision 1: MindMap 참여 기준은 컴포넌트 타입이 아니라 `from` 선언으로 결정

- Decision: `processChildren`에서 `child.type === 'graph-node'` 전용 분기를 폐기하고, MindMap 컨텍스트에서 `from`이 있는 자식을 MindMap 참여 노드로 처리한다.
- Rationale: 계층 관계(`from`)와 시각 타입(Node/Sticky/Shape/Sequence)은 직교 관심사이며 현재 결합이 표현 제약의 근본 원인이다.
- Alternatives considered:
  - `graph-node` 전용 유지 + 새로운 컴포넌트 타입 추가: 타입 분기만 늘어나고 결합 문제가 유지된다.
  - MindMap 내부 허용 타입 화이트리스트: 확장성이 낮고 새 컴포넌트 추가 시 반복 수정이 필요하다.

## Decision 2: MindMap topology는 fail-fast 정책으로 고정

- Decision: MindMap 자식의 `from` 누락은 파싱 에러로 처리하고, nested MindMap은 unsupported 에러로 차단한다.
- Rationale: 팀 합의가 루트 추정 금지이며, 중첩 MindMap도 지원 범위 밖으로 확정되었다.
- Alternatives considered:
  - 첫 자식을 root로 추정: 암묵 규칙이 생기고 예측 가능성이 낮다.
  - nested MindMap 부분 지원: 외부/내부 레이아웃 순서 제어와 디버깅 비용이 급증한다.

## Decision 3: `from` 단일 prop으로 관계와 edge 시각을 통합

- Decision: `FromProp = string | { node: string; edge?: EdgeStyle }`를 표준으로 채택하고 parser에서 단일 헬퍼(`parseFromProp`, `createEdgeFromProp`)로 처리한다.
- Rationale: 현재 `from` + `edgeLabel` + `edgeClassName` 분산 처리로 인한 중복/일관성 문제가 존재한다.
- Alternatives considered:
  - 기존 edge props 유지: API 파편화가 지속된다.
  - Edge 컴포넌트 분리 강제: 간단한 계층 연결 케이스의 작성 비용이 증가한다.

## Decision 4: 다중 sibling MindMap은 기존 그룹 레이아웃 파이프라인 유지

- Decision: `mindMapGroups` + `groupId` 기반 분리/전역 배치를 유지하고, 새 기능은 그룹 참여 노드 확대에 집중한다.
- Rationale: 현재 `useLayout`은 다중 그룹 내부/전역 배치를 이미 처리하며 검증된 경로다.
- Alternatives considered:
  - 그룹 배치 로직 재작성: 기능 요구 대비 과도한 변경이다.
  - 단일 MindMap만 허용: 기존 다중 MindMap 사용 시나리오를 훼손한다.

## Decision 5: 비동기 콘텐츠 크기 변화는 시그니처 기반 자동 재레이아웃으로 처리

- Decision: 초기 레이아웃 후 MindMap 노드의 정량화된 사이즈 시그니처가 변경되면 debounce 후 `calculateLayout()`을 자동 재실행한다.
- Rationale: 현재 `hasLayouted` 게이트로 초기 1회만 실행되어 이미지/코드 블록 늦은 확장에 대응하지 못한다.
- Alternatives considered:
  - 수동 새로고침/재파싱 의존: 사용자 경험이 불안정하다.
  - ResizeObserver 기반 즉시 레이아웃: 루프/떨림 위험이 높다.

## Decision 6: 자동 재레이아웃은 bounded policy로 제한

- Decision: `inFlight guard + debounce + cooldown + per-graph max attempts` 조합을 사용한다.
- Rationale: 레이아웃 후 미세 측정 변동이 반복될 수 있어 안전장치 없이는 무한 재실행 위험이 있다.
- Alternatives considered:
  - debounce만 적용: 장시간 흔들림에서 재시도 폭주를 막지 못한다.
  - 하드 1회 재시도: 실제 늦은 렌더가 여러 단계로 완료되는 케이스를 놓친다.

## Decision 7: 파서 에러는 UI 에러 오버레이 경로로 노출

- Decision: `page.tsx` 렌더 파이프라인의 catch에서 topology 관련 파싱 에러를 `setGraphError`에 연결한다.
- Rationale: 현재 콘솔 로그만 남기면 사용자는 원인을 알 수 없어 수정 루프가 느리다.
- Alternatives considered:
  - 콘솔 로그만 유지: 사용자 피드백 채널이 없다.
  - hard crash: 편집 세션 연속성이 깨진다.

## Decision 8: WS patch/edit 경로도 `from` object를 round-trip 지원

- Decision: `app/ws/filePatcher.ts`, `app/ws/methods.ts`가 `from` string/object 모두를 보존하도록 계약을 확장한다.
- Rationale: 런타임 parser만 바꾸면 편집/리페어런트/리네임 경로에서 데이터 손실/오동작이 발생한다.
- Alternatives considered:
  - 런타임 전용 지원: 편집 기능 회귀가 발생한다.
  - string 강제 직렬화: edge 스타일 정보 손실이 발생한다.

## Clarification Resolution Status

- `from` 누락 처리 정책: **에러**로 확정.
- nested MindMap 정책: **미지원/에러**로 확정.
- 다중 MindMap 정책: **지원**으로 확정.
- 비동기 크기 변화 대응: **자동 재레이아웃 트리거 + bounded guard**로 확정.
- 남은 NEEDS CLARIFICATION 항목 없음. Phase 1 설계 산출물 작성 가능.
