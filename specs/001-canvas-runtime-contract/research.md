# Phase 0 Research: Canvas Runtime Contract

## 1. Repository Translation Boundary

**Decision**: `libs/shared/src/lib/canonical-persistence/repository.ts`를 storage <-> runtime translation의 단일 boundary로 고정한다. `mappers.ts`, `records.ts`, `validators.ts`, and `schema.ts`는 이 boundary 내부 구현으로 유지하고, new shared runtime modules는 repository ports와 validated records만 소비한다.

**Rationale**: 현재 `canonical-query`, `canonical-mutation`, and `app/ws/methods.ts` 일부가 storage language에 가까운 shape를 직접 다루고 있다. published runtime contract를 고정하려면 raw row, Drizzle schema, persisted JSON column shape가 runtime 위 계층으로 새지 않아야 한다. repository를 단일 번역 경계로 고정하면 persistence 변경과 runtime contract 변경을 분리할 수 있다.

**Alternatives considered**:

- `canonical-query`/`canonical-mutation`가 schema row를 계속 직접 읽도록 유지
  - rejected because query and mutation helper가 곧 published language처럼 굳어져 runtime contract 경계를 흐린다.
- app adapter에서 row-to-contract translation 수행
  - rejected because UI/transport가 storage ownership을 가지게 되어 bounded context가 무너진다.

## 2. Projection Placement

**Decision**: hierarchy, render, editing projection은 new `libs/shared/src/lib/canvas-runtime/projections/` 아래에 둔다. `app/features/render/parseRenderGraph.ts`는 render projection consumer, `app/features/editing/editability.ts`와 `workspaceEditUtils.ts`는 editing projection consumer로 축소한다.

**Rationale**: 현재 render parsing과 editability derivation이 app 안에 있어 React client가 runtime meaning owner처럼 동작한다. spec의 핵심 목표는 React UI를 adapter/consumer로 재정렬하는 것이다. projection builders가 shared runtime에 있어야 CLI, UI, future MCP가 같은 read model을 공유할 수 있다.

**Alternatives considered**:

- projections를 `canonical-query` 안에 유지
  - rejected because `canonical-query`는 현재 workspace/document query concern과 mixed 되어 있고 published read contract boundary가 아니다.
- projections를 `app/features/render`와 `app/features/editing`에 남기기
  - rejected because React-specific dependency가 계속 runtime meaning을 소유하게 된다.

## 3. Published Command To Canonical Mutation Translation

**Decision**: published command contract와 current `canonical-mutation` operations 사이에 explicit translator layer를 둔다. 위치는 `libs/shared/src/lib/canvas-runtime/application/`이며, runtime command batch를 aggregate ownership 기준으로 해석한 뒤 current lower-level operations로 변환한다.

**Rationale**: 현재 `canonical-mutation/types.ts`는 `object.body.block.update`에 raw `blockId`, `object.body.block.reorder`에 `toIndex`, `canvas.node.update` 같은 lower-level shape를 노출한다. published command contract는 selection/anchor/index targeting, resize/rotate semantics, aggregate ownership, result envelopes를 요구한다. translation layer 없이 바로 lower-level operation을 published contract로 삼으면 spec 요구를 만족할 수 없다.

**Alternatives considered**:

- current `canonical-mutation` types를 곧바로 public contract로 승격
  - rejected because raw block-id/toIndex/node.update semantics가 spec의 published language와 어긋난다.
- `canonical-mutation`을 한 번에 완전히 새 runtime application으로 교체
  - rejected because scope가 커지고 migration risk가 커진다.

## 4. Content Ownership Split

**Decision**: `object.content.update`는 `Canonical Object Aggregate` 소유로 고정하고, node label/display-name identity는 `canvas.node.rename`이 소유한다. visual styling은 `canvas.node.presentation-style.update`와 `canvas.node.render-profile.update`가 소유한다. UI `selection.content.update`와 similar intent는 editing projection target을 보고 object content update인지 canvas rename인지 분기한다.

**Rationale**: `EVENT-COMMAND-MAPPING.md`가 이미 `selection.content.update -> node.content.update` current path를 contract gap으로 지적한다. spec은 `CanvasNode`가 placement/structure를, `Canonical Object`가 meaning/content/body를 소유한다고 고정했다. 이 ownership split이 먼저 고정되어야 command/result/history model이 일관된다.

**Alternatives considered**:

- `node.update` umbrella command를 계속 사용
  - rejected because aggregate ownership이 섞이고 object/content boundary가 유지되지 않는다.
- 모든 text-like change를 `canvas.node.rename`로 몰기
  - rejected because body content, markdown, and ordered body blocks는 object aggregate 소유여야 한다.

## 5. Body Block Targeting And History Normalization

**Decision**: public input은 selection/anchor/index targeting을 그대로 유지하되, mutation execution 전에 editing projection metadata로 이를 canonical target으로 해석한다. 성공한 mutation과 history replay는 `blockId` target and `ResolvedBodyBlockPositionV1` (`start`, `end`, `before-block`, `after-block`)로 정규화한다. replay batch는 원래 request의 `dryRun`/`preconditions`를 상속하지 않는다.

**Rationale**: user-facing authoring intent는 "몇 번째 블록 앞/뒤", "현재 anchor가 가리키는 블록" 같은 위치 의미를 갖는다. 하지만 history replay는 selection/anchor/index가 변하면 흔들린다. spec과 contract 파일이 이미 canonical replay form을 요구하므로, resolution-before-commit and replay-normalization이 application/history layer 책임이 된다.

**Alternatives considered**:

- history에 raw selectionKey/anchorId/index를 그대로 저장
  - rejected because replay 시점에 projection shape가 바뀌거나 selection metadata가 달라질 수 있다.
- public command input도 처음부터 raw blockId만 받기
  - rejected because CLI/UI authoring UX와 spec의 editing projection 목적을 훼손한다.

## 6. Group Membership Scope

**Decision**: group membership는 이번 v1 published runtime contract에 포함하지 않는다. current `node.group.update` / `node.group-membership.update` flows는 app-side or legacy mutation concern으로 남기고, 별도 feature에서 command/event vocabulary를 추가할 때 다시 승격한다.

**Rationale**: user가 명시한 mandatory published command list에 group membership가 포함되지 않았고, current docs도 이를 contract gap으로 표시한다. 지금 승격하면 aggregate ownership, event vocabulary, history semantics, changed-set rules를 추가로 고정해야 해서 feature scope가 넓어진다. 이번 feature는 계약 고정과 adapter thinning이 목표이므로 spec에 없는 vocabulary를 끼워 넣지 않는다.

**Alternatives considered**:

- `canvas.node.group-membership.update`를 즉시 v1 public command로 추가
  - rejected because spec 범위를 넓히고 additional event/history semantics를 요구한다.
- group 기능 자체를 제거
  - rejected because current editor behavior와 unrelated cleanup가 된다.

## 7. React-Specific Types And WebSocket Shapes

**Decision**: `reactflow.Node`, React selection state, `JsonRpcRequest/JsonRpcResponse`, `RpcMutationResult`, compatibility file path resolution, and file patch payloads는 app adapter concern으로 남긴다. shared runtime는 framework-neutral request/response DTO, projection DTO, command batch DTO, mutation result envelope만 노출한다.

**Rationale**: `useCanvasRuntime.ts`, `app/ws/methods.ts`, `GraphCanvas.tsx`, `CanvasEditorPage.tsx`는 transport/UI runtime details와 current edit orchestration을 섞고 있다. published runtime contract에 이런 shape를 올리면 CLI/MCP consumer가 React/WS assumptions를 떠안게 된다.

**Alternatives considered**:

- shared runtime가 ReactFlow node types를 직접 반환
  - rejected because renderer-specific payload를 contract로 승격하는 셈이다.
- shared runtime가 JSON-RPC method names와 params shape를 직접 정의
  - rejected because transport-specific grammar가 published language가 된다.

## 8. Current `app/processes/canvas-runtime` Naming

**Decision**: `app/processes/canvas-runtime/*`는 shared core domain runtime이 아니라 UI composition runtime으로 취급한다. 이번 feature에서 즉시 rename하지는 않지만, plan과 contracts에서 new shared runtime package와 혼동하지 않도록 명시한다.

**Rationale**: 현재 이 디렉터리는 toolbar/context-menu/keyboard contribution binding을 소유한다. 이름만 보면 core runtime처럼 보이지만 실제 책임은 app-side UI process다. rename보다 먼저 ownership 문서를 고정하는 것이 현재 feature에 더 안전하다.

**Alternatives considered**:

- 즉시 directory rename 수행
  - rejected because incidental churn가 크고 feature goal은 contract boundary 고정이다.
- current directory를 core runtime location으로 재사용
  - rejected because app dependency와 UI slot concern이 이미 깊게 섞여 있다.
