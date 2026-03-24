# Canvas Editor Node Create

작성일: 2026-03-24  
상태: Proposed  
범위: `m2/canvas-editor`  
목표: database-first canvas platform 기준으로 `CanvasNode` 생성 경계를 고정한다.

## Implementation Alignment (2026-03-24)

- MVP implementation targets `mindmap-first` Phase 1~4 plus slash-command `object.body.block.insert` wiring for markdown/image block insertion.
- `floating-action-menu` state/UI는 이 slice에서 제외되며, node create는 `canvas.node.create` canonical mutation을 primary path로 사용한다.
- current renderer compatibility still projects create/body mutations back into the TSX shell so reload and immediate edit continue to work while canonical DB remains the source of truth.

## 1. 배경

기존 canvas 생성 경로는 UI intent에서 시작해 결국 `node.create -> ws/filePatcher`로 내려가 TSX AST를 수정하는 흐름에 가깝다.

- UI 생성 진입점
  - `app/components/GraphCanvas.tsx`
  - `app/processes/canvas-runtime/bindings/graphCanvasHost.ts`
- action routing / command normalize
  - `app/features/editing/actionRoutingBridge/*`
  - `app/features/editing/commands.ts`
- legacy write path
  - `app/features/editor/pages/CanvasEditorPage.tsx`
  - `app/ws/methods.ts`
  - `app/ws/filePatcher.ts`

하지만 ADR-0005 이후 canonical source of truth는 TSX가 아니라 database다.

- canonical object truth
  - `libs/shared/src/lib/canonical-persistence/schema.ts`
- canonical mutation/query
  - `libs/shared/src/lib/canonical-mutation/*`
  - `libs/shared/src/lib/canonical-query/*`
- TSX 역할 재정의
  - compatibility/import/reference path

즉 `CanvasNode 생성`은 더 이상 "어떤 JSX 태그를 삽입할 것인가"가 아니라 "어떤 canonical record들을 어떤 순서로 만들 것인가"가 되어야 한다.

## 2. 현재 문제

현재 코드베이스는 DB-first 기반을 일부 갖고 있지만, node create만큼은 아직 구조가 중간 단계에 머물러 있다.

### 2.1 canonical schema와 UI create path가 어긋난다

`canvas_nodes`는 이미 canonical object / plugin instance를 참조하는 DB shape를 갖고 있다.

- `native` node는 `canonicalObjectId`가 필요하다.
- canvas node `props`는 canonical payload를 직접 소유하면 안 된다.

하지만 현재 `node.create`는 여전히 TSX에 shape/text/markdown/sticky 내용을 직접 materialize하는 흐름이다.

### 2.2 mutation executor에 create operation이 없다

현재 canonical mutation executor는 다음만 지원한다.

- `object.content.update`
- `object.capability.patch`
- `object.body.*`
- `canvas.node.move`
- `canvas.node.reparent`

즉 direct manipulation에서 가장 핵심인 "새 node 생성"이 canonical mutation core 바깥에 남아 있다.

### 2.3 native node와 plugin node 경계가 생성 시점에 고정되지 않는다

schema상 `canvas_nodes`는 다음 세 가지 node kind를 가진다.

- `native`
- `plugin`
- `binding-proxy`

하지만 현재 create 경로는 대부분 renderer/tag 중심의 payload를 다루고 있고, 생성 시점에 이 세 가지를 분기하는 canonical contract가 없다.

### 2.4 revision ownership이 file patch 중심 흐름과 갈라진다

DB-first 이후에는 create도 다른 mutation과 동일하게 revision append, optimistic concurrency, changed-set reporting을 따라야 한다. 현재는 create가 canonical revision path에 있지 않다.

## 3. 목표

이 slice의 목표는 node create를 UI surface, canonical semantics, canvas composition, plugin runtime 사이의 명확한 계약으로 다시 세우는 것이다.

구체 목표:

1. `canvas.node.create`를 canonical mutation core의 정식 operation으로 추가한다.
2. native/plugin/binding-proxy 생성 경로를 분리한다.
3. create가 revision append와 optimistic concurrency를 동일하게 사용하도록 만든다.
4. `CanvasNode`가 semantic payload를 직접 소유하지 않도록 경계를 고정한다.
5. legacy TSX path는 compatibility/import 전용으로 강등한다.

## 4. 우선 개발 전략: mindmap-first

이 feature는 모든 node family를 한 번에 닫는 방식보다, mindmap을 최우선 vertical slice로 먼저 구현하는 편이 맞다.

이유:

1. 현재 코드베이스에는 이미 `mindmap.child.create`, `mindmap.sibling.create`, `mindmap-child`, `mindmap-sibling` 같은 UI/placement vocabulary가 존재한다.
2. mindmap은 단순 절대 좌표 생성보다 구조적 생성 의도가 명확하다.
3. parent-child-sibling create를 먼저 닫으면 canonical create, layout normalization, reparent, revision append를 한 번에 검증할 수 있다.
4. mindmap은 제품적으로도 direct manipulation과 AI 보조 생성이 모두 자주 일어나는 핵심 surface다.

따라서 첫 구현 milestone은 아래를 우선 대상으로 삼는다.

- mindmap root 생성
- mindmap child 생성
- mindmap sibling 생성
- mindmap node의 auto placement / layout normalization
- mindmap create 이후 revision append / optimistic concurrency

반대로 아래 항목은 contract만 열어 두고 구현 우선순위는 뒤로 미룬다.

- generic freeform canvas shape create 완성
- plugin node create end-to-end
- binding-proxy create end-to-end
- decorative node family 전체 확장

즉 이 문서의 장기 contract는 전체 node create를 다루되, 실제 delivery order는 `mindmap native path -> generic native path -> plugin path -> binding-proxy path`를 따른다.

## 5. 킬러 피쳐: universal body blocks

이 canvas editor의 핵심 차별점은 "노드 하나가 단일 text payload만 갖는 모델"이 아니라, Notion처럼 여러 body block을 순서대로 담을 수 있는 모델이어야 한다는 점이다.

의도하는 사용자 경험:

- body-capable node는 모두 block body를 가진다.
- 새 node 생성 시 첫 body block은 기본적으로 markdown WYSIWYG block 하나다.
- 사용자는 `/` 커맨드로 body 안에 block을 계속 추가할 수 있다.
- 같은 node 안에 markdown block 2개 이상이 들어갈 수 있다.
- image, graph, table, query view, plugin block도 같은 body container 안에 들어갈 수 있다.

예:

- mindmap node 하나 안에 markdown block 2개
- sticky node 안에 markdown + image
- shape node 안에 markdown + graph block

중요한 점은 이것이 `canvas_nodes.props` 확장이 아니라 canonical object body contract여야 한다는 것이다.

- node shell
  - layout, style, z-order, selection chrome
- node body
  - ordered block container
  - slash command insert surface
  - markdown WYSIWYG 기본 편집 모델

이 feature를 위해 contract 초안을 먼저 feature 폴더 안에 둔다.

- draft contract
  - `docs/features/m2/canvas-editor/node-create/canvas-node-body-contract.ts`

이 계약은 아직 shared runtime contract가 아니다. 우선 M2 body editor와 node create seed의 설계 기준으로만 유지하고, 안정화 이후에만 `libs/shared`로 승격한다.

초기 원칙:

1. "모든 노드"를 literal하게 해석하지 않는다.
2. 실제 대상은 `body-capable native node`다.
3. `line`, purely structural proxy, lightweight connector까지 body를 강제하지 않는다.
4. `plugin node`와 `plugin block`은 별도 개념으로 유지한다.

즉 첫 milestone에서의 현실적 해석은 다음과 같다.

- mindmap node: body-capable
- sticky node: body-capable
- text/markdown/shape node: body-capable
- plugin node: optional
- binding-proxy/connector/line: non-body-capable

## 6. 비목표

이번 설계에서 바로 다루지 않는 것:

1. 모든 legacy `node.create` 호출부를 한 번에 제거
2. plugin runtime bundle loading 전체 설계
3. import/export UX 완성
4. full collaborative conflict resolution
5. selection/toolbar/context menu UX 자체의 상세 polish

추가 비목표:

6. 첫 milestone에서 모든 canvas node family create를 동시에 shipping
7. 첫 milestone에서 자유 배치형 generic shape create UX까지 완성

추가 비목표:

8. 첫 milestone에서 block-based body editor와 node-level plugin runtime을 하나의 모델로 합치기

## 7. 핵심 모델

### 7.1 생성은 단일 record 추가가 아니다

node create는 아래 세 계층을 동시에 건드릴 수 있다.

- canonical model
  - semantic object
  - relation metadata
- canvas composition
  - node placement
  - parent/group/frame/surface membership
  - z-order
- plugin runtime
  - plugin instance
  - binding config / persisted state

따라서 create contract는 "node row 하나 insert"로 축소되면 안 된다.

### 7.2 `canvas_nodes`는 composition truth만 가진다

`canvas_nodes`는 다음만 소유한다.

- `nodeKind`
- `nodeType`
- `surfaceId`
- `parentNodeId`
- `layout`
- `style`
- `zIndex`
- renderer hint 수준의 `props`

`canvas_nodes`가 직접 소유하면 안 되는 것:

- note body text
- markdown source
- canonical text
- semantic role truth
- normalized content blocks

이 값들은 `canonicalObjects` 또는 `pluginInstances`가 소유해야 한다.

body-capable node의 경우에는 여기에 더해 ordered block body truth가 필요하다.

- 기본 저장 책임: canonical object body
- 기본 초기 block: markdown WYSIWYG
- 추가 block insert surface: slash command

즉 node create는 앞으로 "node shell create + initial body seed"를 함께 처리해야 한다.

### 7.3 생성 타입은 3종으로 나눈다

#### A. native node create

예:

- text
- markdown
- sticky
- rectangle / ellipse / diamond / line
- 향후 canonical object에 매핑되는 built-in node

생성 결과:

- canonical object 생성 또는 clone
- canvas node 생성
- 필요 시 binding 생성

#### B. plugin node create

예:

- table
- calendar
- chart
- user-installed component

생성 결과:

- plugin instance 생성
- canvas node 생성

#### C. binding-proxy node create

예:

- saved query result surface
- relation-set projection
- object field map view

생성 결과:

- binding source definition
- binding-proxy node 생성
- 필요 시 binding row 생성

## 8. 권장 생성 계약

### 8.1 mutation operation 추가

`libs/shared/src/lib/canonical-mutation/types.ts`에 아래 operation을 추가한다.

```ts
type MutationOperation =
  | ...
  | CanvasNodeCreateOperation
  | CanvasNodeRemoveOperation
```

최소 create shape:

```ts
interface CanvasNodeCreateOperation {
  op: "canvas.node.create";
  requestId: string;
  node: {
    id: string;
    surfaceId: string;
    nodeKind: "native" | "plugin" | "binding-proxy";
    nodeType?: string | null;
    parentNodeId?: string | null;
    placement:
      | { mode: "canvas-absolute"; x: number; y: number }
      | { mode: "mindmap-child"; parentNodeId: string }
      | { mode: "mindmap-sibling"; siblingNodeId: string; parentNodeId: string | null };
    layout?: Record<string, unknown>;
    style?: Record<string, unknown> | null;
    props?: Record<string, unknown> | null;
    zIndex?: number;
    body?:
      | {
          mode: "markdown-wysiwyg";
          initialBlocks?: Array<{
            id: string;
            blockType: string;
            [key: string]: unknown;
          }>;
        };
    semanticSeed?:
      | {
          create: true;
          semanticRole: string;
          primaryContentKind?: string | null;
          content?: Record<string, unknown>;
          capabilities?: Record<string, unknown>;
        }
      | {
          cloneFromObjectId: string;
        }
      | {
          canonicalObjectId: string;
        };
    pluginSeed?:
      | {
          pluginExportId: string;
          pluginVersionId: string;
          displayName?: string;
          props?: Record<string, unknown>;
          bindingConfig?: Record<string, unknown>;
          persistedState?: Record<string, unknown>;
        };
  };
}
```

핵심은 `semanticSeed`, `pluginSeed`, `body`가 선택적이되, `nodeKind` 및 body-capable profile과 조합될 때 validator가 필수성을 강제해야 한다는 점이다.

### 8.2 create service는 executor 밖 helper로 분리

`executor.ts` 안에서 모든 create 조합을 직접 처리하기보다, 아래 helper를 둔다.

- `createNativeCanvasNode()`
- `createPluginCanvasNode()`
- `createBindingProxyCanvasNode()`

이 helper는 공통으로 다음 책임을 가진다.

1. 입력 validation
2. 필요한 record id materialization
3. repository insert 순서 결정
4. initial body seed 생성
5. final `CanvasNodeRecord` 반환

## 9. 생성 순서

### 9.1 native node create

권장 순서:

1. `semanticSeed`를 canonical object record로 정규화
2. canonical object insert 또는 clone
3. placement를 `layout`/`parentNodeId`로 정규화
4. body-capable node면 default markdown block seed 적용
5. `canvas_nodes` insert
6. 필요 시 `canvas_bindings` insert
7. revision append

중요:

- `native` node는 insert 전에 `canonicalObjectId`가 확정돼야 한다.
- text/markdown/sticky/shape/mindmap node의 body 초깃값은 object content contract를 통해 만들어야 한다.
- shape node의 경우에도 semantic payload가 필요 없다고 가정하지 않는다.
  - 최소 canonical object를 만들고, node는 renderer/view hint만 가진다.
- body-capable node는 기본적으로 markdown WYSIWYG block 하나를 seed한다.

mindmap-first 적용:

- 첫 구현은 `native node create` 중에서도 mindmap root/child/sibling path를 우선 닫는다.
- 이때 `placement.mode = mindmap-child | mindmap-sibling` 정규화가 첫 번째 핵심 과제다.
- 동시에 mindmap node는 "기본 markdown block 1개"를 항상 가진 상태로 생성한다.

### 9.2 plugin node create

권장 순서:

1. plugin export/version 존재 및 status 검증
2. publish된 runtime snapshot 존재 확인
3. plugin instance insert
4. `canvas_nodes` insert with `pluginInstanceId`
5. revision append

중요:

- `plugin` node는 `canonicalObjectId` 대신 `pluginInstanceId`를 진실 참조로 쓴다.
- plugin instance의 `props`와 canvas node의 `props`를 섞지 않는다.
  - plugin instance `props`: 실행 대상 component prop
  - canvas node `props`: shell-level renderer hint
- plugin node는 원본 source tree가 아니라 immutable한 published runtime snapshot을 참조해야 한다.

### 9.3 plugin durability 전략

plugin node는 "지금 source를 읽을 수 있는가"보다 "나중에도 같은 실행 자산을 복구 가능한가"가 더 중요하다.

권장 원칙:

- node마다 source를 복사하지 않는다.
- publish 시점의 plugin version artifact를 workspace-managed storage에 snapshot한다.
- 각 plugin instance는 source path가 아니라 published `pluginVersionId`를 참조한다.
- 원본 plugin source가 삭제되거나 이동돼도 published version artifact가 남아 있으면 node는 계속 열리고 렌더되어야 한다.

이 slice에서 권장하는 모델은 `copy-on-publish, reference-on-instance`다.

#### A. 개발 연결 모드

- 로컬 source tree를 직접 참조
- 빠르지만 durability가 없다
- dev-only mode로 한정

#### B. workspace publish 모드

- bundle, manifest, schema, integrity metadata를 workspace-managed artifact로 복사
- `plugin_versions.bundleRef`는 이 복사본을 가리킨다
- plugin instance는 `pluginVersionId`만 참조한다
- 기본 운영 경로는 이 모드를 사용한다

#### C. portable export 모드

- 문서 export/share 시 필요한 plugin runtime artifact를 문서 패키지에 포함
- 가장 안전하지만 무겁기 때문에 기본 편집 경로로 두지는 않는다

중요한 점은 복사의 단위가 `node`가 아니라 `published plugin version`이어야 한다는 것이다.

node별 복사 방식의 문제:

- 같은 plugin version을 node 수만큼 중복 저장
- 보안 차단, version disable, rollback 처리 복잡도 증가
- 같은 runtime 자산의 identity가 흐려짐

version snapshot 방식의 장점:

- 여러 node가 같은 immutable runtime artifact를 공유
- source repository가 사라져도 복구 가능
- version disable/deprecate 정책과 자연스럽게 연결 가능
- integrity hash 검증이 쉬움

따라서 `plugin node create`는 단순히 plugin instance를 insert하는 것이 아니라, 해당 instance가 durable한 published runtime snapshot을 참조하는지까지 보장해야 한다.

### 9.4 binding-proxy create

권장 순서:

1. binding source contract normalize
2. 필요 시 binding row insert
3. `canvas_nodes` insert with `nodeKind = "binding-proxy"`
4. revision append

## 10. body block contract

body block은 node shell과 별도 계약으로 다룬다.

초기 contract 원칙:

- default initial block type: `markdown`
- default editor mode: `markdown-wysiwyg`
- slash command는 block insert surface다
- image는 core block으로 열 수 있다
- graph/table/query/plugin block은 namespaced custom block으로 확장 가능하다

구분:

- plugin node
  - 캔버스 레벨 독립 노드
- plugin block
  - node body 안에 삽입되는 block

이 둘은 저장, 레이아웃, 권한 모델이 다르므로 첫 milestone에서 통합하지 않는다.

## 11. floating action menu 모델

universal body blocks가 들어가면 floating action menu는 단일 메뉴로 유지하면 안 된다. node 선택과 내부 block 활성화의 의미가 다르기 때문이다.

권장 모델은 2단계 메뉴다.

### 11.1 node-level floating menu

노드가 선택되고 active block이 없을 때 보이는 메뉴다.

역할:

- node 전체 body에 공통 적용되는 typography 기본값 노출
- 전체 body 기준 font size scale
- 전체 body 기준 text align
- theme, tone, body spacing 같은 container-level 옵션
- `/` insert 진입
- 기타 node shell 수준 action

이 메뉴의 변경은 기본적으로 일괄 적용이 아니라 "공용 기본값 변경"으로 해석한다.

- 각 block에 override가 없으면 모두 같은 결과를 본다.
- block override가 있는 경우에는 node-level 값이 default 역할만 한다.

### 11.2 block-level floating menu

노드 내부에서 특정 markdown block 또는 body block을 클릭했을 때 보이는 메뉴다.

역할:

- 현재 block 전용 font size override
- 현재 block 전용 text align override
- heading/body/list/todo 같은 block style
- duplicate/delete/move up/down
- block type convert

이 메뉴의 변경은 현재 block에만 적용된다.

### 11.3 inline text toolbar

markdown block 내부에서 텍스트 범위를 선택했을 때는 더 작은 인라인 toolbar를 추가로 열 수 있다.

역할:

- bold
- italic
- link
- inline code

이 레벨은 body block menu와 구분한다.

### 11.4 상태 우선순위

권장 우선순위:

1. `node selected, no active block`
  - node-level floating menu 표시
2. `node selected + active block`
  - block-level floating menu 표시
  - node-level menu는 축소하거나 secondary 상태로 유지
3. `text selection inside block`
  - inline text toolbar 표시

### 11.5 스타일 해석 규칙

권장 해석 순서:

1. block-level override
2. node-level body defaults
3. global editor defaults

이렇게 해야 node-level 메뉴의 공용 변경과 block-level 메뉴의 개별 예외 처리가 동시에 성립한다.

### 11.6 첫 milestone 적용

mindmap-first 첫 milestone에서는 아래까지만 먼저 닫는다.

- node-level floating menu
  - body default font size
  - body default text align
- block-level floating menu
  - current markdown block font size override
  - current markdown block text align override

즉 초기에는 "공용 typography defaults + 현재 block override" 조합만 먼저 구현하고, inline selection toolbar는 후속 단계로 미룬다.

## 12. placement와 layout 정규화

UI는 여러 종류의 create gesture를 가진다.

- click create
- drag-size create
- mindmap child create
- mindmap sibling create

하지만 persistence layer는 더 적은 수의 정규 shape만 알아야 한다.

권장 규칙:

- `canvas-absolute`
  - `layout.x`, `layout.y` 필수
  - width/height는 optional이지만 drag create면 채운다.
- `mindmap-child`
  - `parentNodeId` 필수
  - layout는 auto placement service가 결정하거나 seed hint만 받는다.
- `mindmap-sibling`
  - sibling 기준으로 parent를 resolve한 뒤 `parentNodeId`를 canonicalize한다.

즉 `placement`는 UI intent shape이고, DB에 저장되기 전에는 `layout + parentNodeId + maybe relation metadata`로 정규화되어야 한다.

mindmap-first milestone에서는 아래를 우선 고정한다.

- `mindmap-child`
  - parent lookup
  - sibling ordering seed 또는 subtree order metadata
  - auto placement hint 생성
- `mindmap-sibling`
  - sibling 기준 parent resolve
  - 동일 mindmap scope 검증
  - sibling 뒤/앞 insert policy 결정
- root create
  - root node의 canonical object seed
  - 초기 layout anchor 결정

즉 자유 배치형 `canvas-absolute`보다 구조적 `mindmap-*` placement가 첫 milestone의 1순위다.

## 13. UI 레이어 책임

`GraphCanvas`와 entrypoint surface는 아래까지만 책임진다.

- 사용자가 어떤 kind/type의 node를 만들려는지 결정
- click/drag/mindmap child intent 생성
- 초기 크기와 위치 hint 생성
- semantic defaults 선택

UI가 소유하면 안 되는 것:

- canonical object schema 조립
- plugin instance persistence
- revision sequencing
- canonical/native/plugin/binding-proxy insert ordering

즉 `GraphCanvas`는 `create request producer`여야 하고, record composition owner가 되면 안 된다.

body-capable node의 `/` 커맨드는 create surface가 아니라 body mutation surface다.

- node create
  - `canvas.node.create`
- slash block insert
  - `object.body.block.insert`
- slash block reorder/remove/update
  - `object.body.block.reorder`
  - `object.body.block.remove`
  - `object.body.block.update`

mindmap-first 적용:

- toolbar / pane create UI는 먼저 mindmap child/sibling affordance를 우선 노출한다.
- generic shape create affordance는 있어도 canonical primary path로 먼저 닫지 않는다.
- body editor는 mindmap node 생성 직후 바로 markdown WYSIWYG block에 focus 진입할 수 있어야 한다.
- floating menu는 node-level과 block-level을 분리한다.

## 14. legacy TSX 경로 처리

`app/ws/filePatcher.ts` 기반 `node.create`는 primary path가 아니라 아래 용도로 재정의한다.

1. legacy `.graph.tsx` import
2. compatibility materialization
3. debug/dev-only fallback

금지해야 하는 것:

- primary UI create가 `filePatcher`를 canonical write path로 사용하는 것
- DB create 이후 다시 TSX를 truth처럼 patch해 맞추는 것

호환성 원칙:

- canonical DB write가 먼저다.
- TSX가 필요하면 canonical state를 export/materialize한 결과여야 한다.

## 15. 단계별 적용 제안

### Phase 1. contract 추가

- `canvas.node.create` operation 추가
- repository helper / validator 보강
- executor create branch 추가
- `canvas-node-body-contract.ts` 추가
- 단, 첫 구현은 mindmap root/child/sibling contract만 우선 지원

### Phase 2. mindmap-first vertical slice

- `CanvasEditorPage`의 mindmap create dispatch를 canonical mutation으로 전환
- `mindmap.child.create`, `mindmap.sibling.create`를 canonical create payload로 재정의
- mindmap root create 경로를 canonical mutation으로 연결
- optimistic UI patch를 DB-first changed-set 기준으로 맞춤
- mindmap auto placement / parent scope validation 추가
- 기본 markdown body seed와 생성 직후 WYSIWYG focus 연결
- node-level floating menu의 공용 typography defaults 연결

### Phase 3. generic native create 확장

- generic canvas node create를 같은 contract 위로 확장
- `node.create` generic path를 canonical mutation으로 수렴
- `/` slash command 기반 block insert surface 추가
- block-level floating menu의 markdown block override 연결

### Phase 4. legacy isolation

- `ws/filePatcher` create path를 compatibility label로 격하
- primary permission / editability surface에서 file-first create 제거

## 16. 성공 기준

다음이 만족되면 이 slice는 성공이다.

1. mindmap root/child/sibling 생성이 canonical mutation path로 동작한다.
2. 첫 milestone에서 `mindmap.child.create`, `mindmap.sibling.create`는 더 이상 file patch primary path를 사용하지 않는다.
3. `native` node는 항상 유효한 `canonicalObjectId`를 가진다.
4. `plugin` node는 항상 유효한 `pluginInstanceId`를 가진다.
5. `plugin` node는 원본 source path가 아니라 published runtime snapshot을 참조한다.
6. body-capable node는 생성 시 기본 markdown block 하나를 가진다.
7. `/` slash command로 추가 block insert가 canonical object body mutation으로 표현된다.
8. node-level floating menu는 공용 typography defaults를 바꿀 수 있다.
9. block-level floating menu는 현재 markdown block override만 수정한다.
10. canvas node `props`는 canonical payload를 소유하지 않는다.
11. create가 move/reparent와 같은 revision/changed-set/optimistic concurrency 경로를 사용한다.
12. 전체 primary UI create path가 더 이상 `filePatcher`를 canonical write path로 사용하지 않는다.

## 17. 오픈 질문

### 17.1 rectangle/ellipse/diamond/line도 canonical object를 항상 가져야 하는가

현재 validator는 `native`면 `canonicalObjectId`가 필요하다고 강제한다. 이 방향을 유지하는 편이 구조적으로 일관되다. 다만 purely decorative shape를 별도 lightweight semantic role로 둘지 결정이 필요하다.

### 17.2 `object.create`를 별도 operation으로 도입할 것인가

현재 object update 계열은 있지만 create operation은 mutation core에서 일급으로 보이지 않는다. 장기적으로는 `canvas.node.create` 내부에 object create seed를 내장하기보다 `object.create + canvas.node.create`의 조합으로 분리할 수도 있다.

권장 초기 선택:

- 먼저 `canvas.node.create` 내부에 seed를 허용해 end-to-end를 닫는다.
- 이후 object create contract가 안정되면 두 operation으로 분리한다.

### 17.3 create 시 z-index policy owner는 어디인가

`canvas_nodes.z_index`는 필수다. create service가 surface별 max z-index + 1을 계산할지, runtime이 미리 seed할지 결정이 필요하다.

권장:

- persistence create service가 최종 z-index를 결정한다.
- UI는 optional hint만 보낸다.

### 17.4 plugin source-linked dev mode를 어디까지 허용할 것인가

durability를 기준으로 보면 운영 경로는 published runtime snapshot이 맞다. 다만 plugin author 경험을 위해 source-linked dev mode를 일부 허용할 필요는 있다.

결정 필요:

- dev workspace에서만 허용할지
- source-linked instance가 남아 있는 문서를 열거나 publish할 때 어떤 경고를 띄울지
- source-linked instance를 언제 강제로 publish snapshot으로 승격시킬지

### 17.5 mindmap sibling insert ordering을 무엇으로 고정할 것인가

mindmap-first를 택하면 sibling 생성의 ordering contract를 초기에 정해야 한다.

결정 필요:

- 같은 parent 아래 append-only로 갈지
- target sibling의 앞/뒤 insert를 모두 지원할지
- ordering truth를 `layout`이 아니라 별도 relation/order metadata로 둘지

권장 초기 선택:

- 첫 milestone은 append-after-sibling 정책으로 단순화
- 이후 필요 시 explicit order metadata를 추가

### 17.6 body-capable node의 범위를 어디까지 열 것인가

사용자 표현은 "모든 노드"지만, 실제 구현에서는 body-capable profile을 둘 필요가 있다.

결정 필요:

- line/connector에 body를 허용할지
- plugin node 자체에도 body를 허용할지
- binding-proxy node가 body를 가질 수 있는지

권장 초기 선택:

- native content node만 body-capable로 시작
- plugin node body는 후속 slice
- structural proxy/connector는 비대상

### 17.7 core block으로 `image`를 즉시 열 것인가

image block은 사용자 가치가 크지만, asset ownership과 upload path를 함께 정해야 한다.

권장 초기 선택:

- contract에는 포함
- 첫 UI shipping은 markdown block 우선
- image block insert는 다음 milestone에서 연다

### 17.8 node-level 메뉴에서 "공용 변경"의 정확한 범위는 어디까지인가

결정 필요:

- block override가 없는 block에만 적용할지
- override가 있는 block도 강제로 덮어쓸 수 있는 `apply to all` 액션을 둘지

권장 초기 선택:

- 기본 동작은 default 값만 변경
- 명시적 `apply to all` 액션은 후속 단계로 분리

### 17.9 block-level 메뉴와 inline text toolbar를 언제 분리할 것인가

초기 구현에서 둘을 같이 열면 상호작용이 복잡해질 수 있다.

권장 초기 선택:

- 첫 milestone은 node-level + block-level만 구현
- inline selection toolbar는 후속 단계로 미룸

## 18. 참조

- `docs/adr/ADR-0005-database-first-canvas-platform.md`
- `docs/adr/ADR-0006-shared-canonical-contract-and-drizzle-split.md`
- `docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`
- `docs/features/database-first-canvas-platform/tsx-shell-separation/README.md`
