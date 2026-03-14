# Phase 0 Research: TSX-Backed Canvas Editing Commands

## Decision 1: semantic command는 기존 RPC 위의 client-side abstraction으로 도입한다

- Decision: 초기 구현에서는 `node.move`, `node.update`, `node.create`, `node.reparent` RPC를 그대로 재사용하고, 클라이언트에서 semantic command를 build한 뒤 transport payload로 변환한다.
- Rationale: 현재 WS 경로가 `baseVersion`, `originId`, `commandId`, `file.changed`를 이미 제공하므로 transport 계층을 재설계하지 않아도 command semantics를 올릴 수 있다.
- Alternatives considered:
  - semantic command와 1:1 RPC를 즉시 추가: 계약은 명확하지만 서버/클라이언트 동시 변경 범위가 커진다.
  - semantic command 없이 현재 heuristic 유지: 각 UI 경로가 patch semantics를 중복 추론해 diff 품질이 떨어진다.

## Decision 2: `editMeta`는 render server가 아니라 `parseRenderGraph.ts`에서 계산한다

- Decision: `sourceMeta`는 현재처럼 render server가 주입하고, `family`, `contentCarrier`, `styleEditableKeys`, `relativeCarrier`, `readOnlyReason` 같은 `editMeta`는 `parseRenderGraph.ts`에서 노드 타입/props를 바탕으로 계산한다.
- Rationale: 기존 render HTTP contract를 바꾸지 않고도 현재 parsed node data만으로 대부분의 편집 가능성 판단이 가능하다.
- Alternatives considered:
  - render server에서 `editMeta`까지 주입: 명시성은 높지만 server/client contract 변경과 테스트 범위가 넓어진다.
  - UI에서 매번 heuristic 계산: 동일 규칙이 여러 곳에 흩어져 유지보수가 어려워진다.

## Decision 3: patcher는 command별 helper를 같은 파일 내부에서 먼저 분리한다

- Decision: `app/ws/filePatcher.ts`를 유지하되 `patchNodeContent`, `patchNodeStyle`, `patchNodeRename`, `patchNodeCreateInScope`, `patchNodeReparent` 같은 helper를 추가한다.
- Rationale: 기존 테스트/호출점을 크게 깨지 않고 patch surface를 명확히 나눌 수 있다.
- Alternatives considered:
  - patcher를 여러 파일로 즉시 분리: 장기적으로는 좋지만 지금은 파일 이동/리팩터링 비용이 크다.
  - generic `patchFile(nodeId, props)` 유지: 최소 diff 원칙과 editable subset 검증을 command별로 보장하기 어렵다.

## Decision 3A: feature-level editing module은 3파일로 제한한다

- Decision: client-side feature module은 `commands.ts`, `editability.ts`, `createDefaults.ts` 3파일로 제한한다.
- Rationale: command envelope 공유, editable subset 규칙 공유, 생성 기본값 공유는 현재 시점의 실제 재사용 요구다. 반면 `validators.ts`, `createBuilders.ts`, `reparentBuilder.ts` 같은 세분화는 아직 단일 feature 내부 단일 호출 경로라 speculative하다.
- Alternatives considered:
  - per-command/per-concern 파일 세분화: 병렬 작업성은 좋아 보이지만 현재 범위에서는 추상화 비용이 더 크다.
  - 기존 파일에 전부 인라인: UI/transport/routing 규칙이 중복되어 heuristic drift가 생긴다.

## Decision 4: MindMap 구조 편집은 `x/y` 저장이 아니라 `reparent`와 scoped create 중심으로 해석한다

- Decision: MindMap member의 drag 또는 명시적 UI action은 `node.reparent` 또는 `mindmap.child.create` / `mindmap.sibling.create`로 해석한다. MindMap member의 좌표 저장은 기본 경로에서 제외한다.
- Rationale: MindMap의 본질은 구조이며 auto-layout이 있기 때문에 `x/y`를 canonical write target으로 삼으면 재편집과 layout 품질이 무너진다.
- Alternatives considered:
  - MindMap 노드도 모두 `x/y` 저장: 구조 의미 손실과 layout 회귀를 유발한다.
  - 구조 편집을 전부 추후로 미루기: 웹 편집에서 "내가 만들었다"는 감각이 생성/관계 편집에서 크게 약해진다.

## Decision 5: 생성은 placement mode를 명시한 command로 처리한다

- Decision: 생성 command는 `canvas-absolute`, `mindmap-child`, `mindmap-sibling` 중 하나의 placement mode를 반드시 가진다.
- Rationale: 같은 `node.create`라도 삽입 위치, 필수 prop, insertion point 규칙이 다르므로 placement를 명시해야 patcher가 예측 가능한 diff를 만들 수 있다.
- Alternatives considered:
  - 생성 위치를 UI 좌표만으로 추정: MindMap child/sibling 생성과 canvas absolute 생성을 구분할 수 없다.
  - 무조건 현재 파일의 첫 Canvas/MindMap 끝에 append: 올바른 scope와 sibling 맥락을 보장하지 못한다.

## Decision 6: editable subset 밖의 TSX는 read-only로 처리하고 patch 시도 자체를 줄인다

- Decision: spread props, 계산식 좌표, 불명확한 children carrier, 비표준 복합 JSX는 `readOnlyReason`을 부여하고 UI에서 편집 command를 막는다.
- Rationale: 실패 후 rollback보다 애초에 편집 가능 범위를 명확히 제한하는 편이 사용자에게 더 예측 가능하다.
- Alternatives considered:
  - 일단 patch 시도 후 실패: 사용자 경험이 불안정하고 에러 빈도가 높다.
  - 모든 패턴을 지원하려는 AST 추론 확장: 복잡도 대비 안정성이 낮다.

## Decision 7: undo/redo는 command 결과를 `EditCompletionEvent`로 정규화해 replay/inverse 한다

- Decision: move/content/style/rename/create/reparent 모두 성공 응답 후 `EditCompletionEvent`를 push하고, undo/redo는 event 단위 inverse/replay RPC로 수행한다.
- Rationale: 현재 move/content 중심 history를 확장해 생성/구조 편집까지 동일 모델로 다룰 수 있다.
- Alternatives considered:
  - 그래프 전체 snapshot 기반 undo: TSX minimal diff와 맞지 않고 의미 단위가 너무 크다.
  - command별 ad-hoc undo 구현: 편집 종류가 늘수록 store/useFileSync 복잡도가 폭증한다.

## Decision 8: rename은 reference surface inventory를 명시적으로 확장한다

- Decision: 1차 범위의 rename rewrite surface는 `id`, `from`, `to`, `anchor`로 고정하고, 후속 확장 대상은 `at.target`, port/handle reference, embedded scope reference로 문서화한다.
- Rationale: 현재 코드가 이미 `from/to/anchor` rewrite를 일부 지원하므로, 범위를 명시적으로 고정한 뒤 필요한 surface를 점진 확장하는 편이 안전하다.
- Alternatives considered:
  - 모든 string prop를 잠재적 reference로 일괄 rewrite: 오탐으로 인해 사용자 의도와 무관한 값이 바뀔 수 있다.
  - rename을 초기 범위에서 제외: FR-011을 충족하지 못한다.

## Decision 9: 생성/구조 편집의 첫 UI는 context-first, toolbar-assisted로 시작한다

- Decision: Canvas absolute create는 toolbar + pane context menu, MindMap child/sibling create 및 reparent는 node context menu/selection-first flow를 우선 지원한다.
- Rationale: freeform drag-create나 다단계 floating handles보다 기존 UI 구조(`FloatingToolbar`, `ContextMenu`) 위에서 시작하는 편이 surgical change 원칙에 맞다.
- Alternatives considered:
  - 새로운 전용 editor chrome 추가: 범위와 UI 변화량이 크다.
  - 단축키 전용 편집: discoverability가 낮다.

## Clarification Resolution Status

- persistence: **TSX source of truth 유지**
- semantic command transport: **기존 RPC 재사용**
- render metadata: **`sourceMeta` 유지 + client-side `editMeta` 계산**
- MindMap 구조 편집: **reparent + child/sibling create 중심**
- unsupported TSX pattern: **read-only**
- 남은 NEEDS CLARIFICATION 없음
