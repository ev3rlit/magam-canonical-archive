# Canvas Editing

## 배경

Magam은 현재 `TSX -> render -> React Flow` 경로를 중심으로 동작한다. 이 구조는 AI가 초안을 만들고 사용자가 결과를 보는 흐름에는 잘 맞지만, 사용자가 웹에서 직접 조작하고 수정하는 경험은 아직 제한적이다.

이번 문서는 `TSX를 source of truth로 유지`한 상태에서, 웹 조작과 편집을 어떻게 안전하게 TSX 수정으로 연결할지 정의한다.

## 문제 정의

웹 편집에서 가장 어려운 문제는 "화면에서 일어난 모든 조작을 그대로 TSX로 역직렬화할 수 있는가"가 아니다. 실제 문제는 다음과 같다.

- 시각적 조작은 자유롭지만 TSX 표현은 여러 방식으로 가능하다
- 같은 결과를 만드는 JSX 구조가 여러 개일 수 있다
- 직접 조작 결과를 generic AST patch로 처리하면 diff가 커지고 예측 가능성이 떨어진다
- MindMap 같은 구조형 오브젝트는 좌표보다 부모-자식 관계가 더 중요하다

따라서 웹 편집은 자유 편집을 그대로 저장하는 모델이 아니라, `TSX에 안전하게 write-back 가능한 command 집합`으로 설계해야 한다.

## 핵심 원칙

### 1. TSX Source of Truth 유지

- canonical source는 계속 `.tsx` 파일이다
- 웹 상태는 TSX에서 파생된다
- 저장은 AST patch를 통해 원본 TSX에 반영한다

### 2. Direct Manipulation은 Semantic Command로 변환

- 웹에서 발생한 UI 이벤트를 그대로 TSX로 쓰지 않는다
- 모든 편집은 의미 있는 command로 변환한 뒤 patcher가 처리한다
- command는 최소 수정 원칙을 따라야 한다

예시:

- 드래그 -> `node.move.absolute`
- attach 오브젝트 이동 -> `node.move.relative`
- 텍스트 수정 -> `node.content.update`
- 자식 추가 -> `mindmap.child.create`

### 3. Object Family별 편집 해석 분리

같은 drag라도 오브젝트 종류에 따라 의미가 달라야 한다.

- Canvas absolute object: 좌표 이동
- Relative attachment object: 상대 offset/gap 수정
- MindMap member: 구조 변경 의도(reparent, reorder, branch move)
- Rich content object: content 편집 또는 style 편집

### 4. Editable Subset 선언

모든 TSX를 웹 편집 가능 대상으로 삼지 않는다.

- 단순 prop 기반 컴포넌트는 editable
- 예측 가능한 children 구조는 editable
- spread props, 계산식, 복잡한 조건부 JSX, 고차 조합은 read-only 또는 제한 편집으로 둔다

## 목표

- 웹에서 조작한 결과가 작은 TSX diff로 반영된다
- 사용자는 "AI가 만든 결과를 내가 다듬었다"는 통제감을 얻는다
- MindMap과 Canvas의 편집 해석이 서로 충돌하지 않는다
- 생성, 수정, 구조 변경을 단계적으로 웹 편집 UX에 추가할 수 있다

## 비목표

- 화면상의 모든 조작을 generic AST inference로 복원하는 것
- arbitrary TSX를 모두 editable native object처럼 취급하는 것
- 협업 CRDT/OT를 이번 문서에서 설계하는 것
- TSX source of truth를 다른 저장 모델로 대체하는 것

## 시스템 모델

### 현재 파이프라인

```text
TSX file
  -> render server
  -> graph AST + sourceMeta + sourceVersion
  -> React Flow nodes/edges
  -> user interaction
  -> semantic command
  -> RPC
  -> AST patch
  -> re-render
```

### 핵심 계층

#### 1. Render Layer

- TSX를 실행하고 캔버스 그래프로 변환한다
- 각 renderable node에 `sourceMeta`를 주입한다
- `sourceId`, `filePath`, `scopeId`, `frameScope`를 포함해 edit target을 추적한다

#### 2. Interaction Layer

- selection, drag, context menu, shortcut, toolbar action을 받는다
- raw UI event를 semantic command로 변환한다

#### 3. Edit Routing Layer

- rendered node id를 canonical source id로 되돌린다
- cross-file subtree, frame-local scope, mindmap scope를 해석한다

#### 4. Patch Layer

- command별 전용 patcher가 TSX를 최소 수정한다
- generic patcher는 fallback으로만 사용한다

#### 5. Sync Layer

- `sourceVersion`, `originId`, `commandId`를 사용해 충돌과 self-origin loop를 처리한다

## Semantic Command 모델

웹 편집은 아래 command family를 기준으로 확장한다.

### Shared Command Envelope

모든 semantic command는 공통 envelope를 가진다.

```ts
type EditCommandBase = {
  commandId: string;
  type: string;
  filePath: string;
  baseVersion: string;
  originId: string;
  target: {
    sourceId: string;
    renderedId?: string;
    scopeId?: string;
    frameScope?: string;
  };
  issuedAt: number;
};
```

공통 필드 의미:

- `commandId`: 실행 단위를 식별한다
- `filePath`: 실제 patch 대상 파일
- `baseVersion`: optimistic concurrency guard
- `originId`: self-origin loop 방지
- `target.sourceId`: canonical edit target
- `target.renderedId`: runtime selection/debug 용도

### Shared Client Flow

각 command는 아래 순서로 처리한다.

1. selection 또는 pointer interaction에서 edit target resolve
2. node family와 editable subset 검사
3. semantic command 생성
4. optimistic reducer 적용
5. RPC dispatch
6. 성공 시 version update + history push
7. 실패 시 rollback + toast

### Shared Server Flow

각 command는 아래 순서로 처리한다.

1. `baseVersion` 검사
2. `sourceId` 기준 JSX element resolve
3. 해당 command가 허용된 editable subset인지 검증
4. 전용 patcher 실행
5. file hash 재계산
6. `file.changed` notification 전송

### Render Metadata Requirements

현재 `sourceMeta`만으로는 edit routing은 가능하지만, command-specific patch를 안정적으로 하려면 render 단계에서 `editMeta`도 제공하는 것이 좋다.

권장 shape:

```ts
type EditMeta = {
  family: 'canvas-absolute' | 'relative-attachment' | 'mindmap-member' | 'rich-content';
  contentCarrier?: 'label-prop' | 'text-child' | 'markdown-child';
  relativeCarrier?: 'gap' | 'at.offset';
  styleEditableKeys?: string[];
  createMode?: 'canvas' | 'mindmap-child' | 'mindmap-sibling';
  readOnlyReason?: string;
};
```

의도:

- client가 heuristic 없이 어떤 command를 열 수 있는지 판단
- patcher가 target node를 어떤 방식으로 수정해야 하는지 결정
- unsupported pattern은 UI에서 미리 read-only 처리

### Position Commands

#### `node.move.absolute`

- 대상: Canvas의 자유 배치 노드
- 결과: `x`, `y`만 수정
- 금지: `id`, `children`, `from`, `style`까지 함께 바꾸지 않음

기술 설계:

- UI trigger: React Flow `onNodeDragStop`
- target 조건:
  - `editMeta.family === 'canvas-absolute'`
  - auto-layout에 종속되지 않는 node
  - `anchor`, `at`, `from` 기반 상대/구조 편집 노드는 제외
- command payload:

```ts
type MoveAbsoluteCommand = EditCommandBase & {
  type: 'node.move.absolute';
  next: { x: number; y: number };
  previous: { x: number; y: number };
};
```

- client optimistic:
  - 현재 React Flow node position을 즉시 업데이트
  - drag origin을 `previous`에 보관
- transport:
  - Phase 1에서는 기존 `node.move` RPC 재사용
- server validation:
  - target JSX element 존재
  - `x`, `y`가 literal numeric prop으로 쓰일 수 있는 패턴인지 검사
  - dynamic expression 기반 좌표면 reject
- patcher:
  - `patchNodePosition(sourceId, x, y)`
  - `x`, `y`만 upsert
- rollback:
  - drag 전 좌표로 복원
  - version conflict 시 최신 상태 재렌더

필요 구현:

- absolute move eligibility resolver 추가
- dynamic position read-only detection 추가

#### `node.move.relative`

- 대상: `anchor/position/gap` 또는 `at.offset` 기반 노드
- 결과: `gap` 또는 `at` 일부만 수정
- 목적: 상대 배치 의미를 유지한 채 위치만 조정

기술 설계:

- UI trigger: React Flow `onNodeDragStop`
- target 조건:
  - `editMeta.family === 'relative-attachment'`
  - `editMeta.relativeCarrier`가 정의되어 있어야 함
- command payload:

```ts
type MoveRelativeCommand = EditCommandBase & {
  type: 'node.move.relative';
  carrier: 'gap' | 'at.offset';
  next: { gap?: number; at?: { offset: number } };
  previous: { gap?: number; at?: { offset: number } };
};
```

- client resolution:
  - `Sticker + anchor`면 `gap` 계산
  - `WashiTape + at.type='attach'`면 `at.offset` 계산
  - 추후 generic anchor object는 `anchor/position` 축 기준 gap 계산기로 확장
- transport:
  - Phase 1에서는 기존 `node.update` RPC 사용
  - command builder가 patch payload를 `gap` 또는 partial `at` object로 변환
- server validation:
  - target이 relative carrier를 가진 패턴인지 확인
  - `gap` 또는 `at.offset`만 수정 가능
  - attach/anchor 관계를 제거하는 patch는 reject
- patcher:
  - `patchNodeRelativePosition`
  - `gap`은 literal numeric prop으로 upsert
  - `at`는 object merge로 offset만 갱신
- rollback:
  - 수정 전 상대값으로 복원

필요 구현:

- 현재 `Sticker`, `WashiTape` 외의 generic anchor family 지원
- `relativeAttachmentMapping` 결과를 `editMeta` 기반으로 일반화

### Content Commands

#### `node.content.update`

- 대상: `Text`, `Markdown`, 단순 label 기반 node
- 결과: text/markdown source만 수정
- markdown은 WYSIWYG를 제공해도 저장 포맷은 markdown source string을 유지

기술 설계:

- UI trigger:
  - double click
  - inspector content field
  - AI scoped content edit
- target 조건:
  - `editMeta.family === 'rich-content'` 또는 `contentCarrier`가 존재
- command payload:

```ts
type UpdateContentCommand = EditCommandBase & {
  type: 'node.content.update';
  carrier: 'label-prop' | 'text-child' | 'markdown-child';
  next: { content: string };
  previous: { content: string };
};
```

- carrier별 patch 방식:
  - `label-prop`: `label` prop만 수정
  - `text-child`: JSX text child만 수정
  - `markdown-child`: `<Markdown>{\`...\`}</Markdown>` child만 수정
- transport:
  - Phase 1에서는 기존 `node.update({ content })`
- server validation:
  - target node의 content carrier가 명확해야 함
  - content 외 다른 prop 수정 금지
  - markdown이면 string source만 저장
- patcher:
  - `patchNodeContent`
  - 현재 구조 보존 우선
  - `<Markdown>` child가 있으면 그 child만 수정
  - plain text면 text child만 수정
  - label prop 기반이면 `label` prop만 수정
- rollback:
  - 이전 content snapshot으로 복원

필요 구현:

- parser 또는 render metadata에 `contentCarrier` 추가
- client의 content builder와 server patcher가 같은 carrier 정의를 공유

### Style Commands

#### `node.style.update`

- 대상: 색상, 패턴, 폰트, 크기, outline, padding 같은 안전한 prop
- 결과: 명시적으로 허용된 prop만 수정
- 목적: inspector 기반 편집을 안정적으로 저장

기술 설계:

- UI trigger:
  - inspector
  - preset menu
  - quick action
- target 조건:
  - `styleEditableKeys`가 비어 있지 않아야 함
- command payload:

```ts
type UpdateStyleCommand = EditCommandBase & {
  type: 'node.style.update';
  patch: Record<string, unknown>;
  previous: Record<string, unknown>;
};
```

- patch policy:
  - whitelist 기반 prop update만 허용
  - 구조/정체성 prop은 제외
- transport:
  - 기존 `node.update`
- server validation:
  - patch key가 `styleEditableKeys` 안에 있어야 함
  - `from`, `children`, `id` 등은 reject
- patcher:
  - `patchNodeStyle`
  - object merge가 필요한 prop(`pattern`)과 scalar prop을 분리 처리
- rollback:
  - inspector 편집 이전 snapshot으로 복원

필요 구현:

- 현재 runtime-only 편집 UI를 semantic command로 승격
- node family별 editable style contract 정의

### Identity Commands

#### `node.rename`

- 대상: stable id를 가진 노드
- 결과: `id` 변경 + 참조 갱신
- 참조 갱신 범위:
  - `from`
  - `to`
  - `anchor`
  - 추후 `at.target`, port reference 등 확장 가능

기술 설계:

- UI trigger:
  - rename action
  - inspector id field
  - AI targeted rename
- command payload:

```ts
type RenameNodeCommand = EditCommandBase & {
  type: 'node.rename';
  next: { id: string };
  previous: { id: string };
};
```

- transport:
  - Phase 1에서는 기존 `node.update({ id })`
  - Phase 2에서는 `node.rename` 전용 RPC로 분리 권장
- server validation:
  - 새 id collision 검사
  - editable subset 상 literal id 패턴인지 검사
  - ref rewrite가 가능한 reference surface인지 검사
- patcher:
  - `patchNodeRename`
  - `id` 변경
  - `from`, `to`, `anchor` rewrite
  - 추후 `at.target`, port reference, embedded scope reference 확장
- rollback:
  - rename 전 id와 refs로 복원

필요 구현:

- reference surface inventory 문서화
- rename impact preview UI

### Structure Commands

#### `node.reparent`

- 대상: MindMap member 또는 구조적 부모 개념이 있는 node
- 결과: `from` 수정
- 필수 조건:
  - cycle guard
  - scope-aware parent resolution

기술 설계:

- UI trigger:
  - drag-drop on mindmap node
  - context action "부모 변경"
- target 조건:
  - `editMeta.family === 'mindmap-member'`
  - root node 또는 non-structural canvas object는 제외
- command payload:

```ts
type ReparentNodeCommand = EditCommandBase & {
  type: 'node.reparent';
  next: { parentId: string | null };
  previous: { parentId: string | null };
};
```

- transport:
  - 기존 `node.reparent`
- server validation:
  - `newParentId` 존재 검사
  - same-scope resolution
  - cycle 검사
  - root 허용 여부 검사
- patcher:
  - `patchNodeReparent`
  - 기존 `from`이 object면 edge payload 유지
  - string이면 string 교체
- client drop UX:
  - hover 대상 노드를 parent candidate로 표시
  - valid drop와 invalid drop를 시각적으로 구분
- rollback:
  - 이전 parentId로 복원

필요 구현:

- UI-level drop intent resolver 추가
- mindmap group 기준 parent candidate filtering 추가

#### `mindmap.child.create`

- 대상: 선택된 MindMap node
- 결과: 새 자식 node 생성 + `from=<selected>`
- 목적: MindMap에서 가장 자주 쓰이는 생성 시나리오를 단순화

기술 설계:

- UI trigger:
  - context menu "자식 추가"
  - keyboard shortcut(Tab/Enter 계열)
  - floating plus button
- command payload:

```ts
type CreateMindMapChildCommand = EditCommandBase & {
  type: 'mindmap.child.create';
  create: {
    nodeType: 'shape' | 'text' | 'markdown' | 'sticky' | 'sticker' | 'washi-tape' | 'image';
    id: string;
    initialProps?: Record<string, unknown>;
    initialContent?: string;
  };
  parentId: string;
};
```

- client defaults:
  - 최소 props만 생성
  - 기본 label/content placeholder 제공
  - selection을 새 노드로 이동
- transport:
  - 기존 `node.create` 활용
  - command builder가 `from=parentId`를 자동 주입
- server validation:
  - parent 존재
  - parent가 same mindmap scope에 속함
  - nodeType 허용 목록 검사
- patcher:
  - `patchNodeCreate`
  - 선택 parent와 같은 MindMap subtree에 삽입
  - 단순 "첫 Canvas/MindMap" 삽입 규칙에서 벗어나 insertion policy를 명시화해야 함
- post-commit:
  - re-render 후 새 노드 selection

필요 구현:

- insertion anchor 결정 로직
- auto-generated id policy
- 새 노드 selection/focus 관리

#### `mindmap.sibling.create`

- 대상: 선택된 MindMap node
- 결과: 같은 부모를 갖는 새 node 생성
- 목적: 빠른 브랜치 확장

기술 설계:

- UI trigger:
  - context menu "형제 추가"
  - keyboard shortcut
- command payload:

```ts
type CreateMindMapSiblingCommand = EditCommandBase & {
  type: 'mindmap.sibling.create';
  create: {
    nodeType: 'shape' | 'text' | 'markdown' | 'sticky' | 'sticker' | 'washi-tape' | 'image';
    id: string;
    initialProps?: Record<string, unknown>;
    initialContent?: string;
  };
  siblingOf: string;
  parentId: string | null;
};
```

- implementation:
  - selected node의 current parent를 먼저 resolve
  - root sibling이면 `from` 없이 생성
  - non-root sibling이면 `from=parentId`
- patcher:
  - `patchNodeCreate` 재사용 가능
  - 추후 sibling order를 저장하게 되면 insertion index 인자를 추가

필요 구현:

- selected node parent resolution 유틸
- multi-root mindmap 처리 규칙

### Create Commands

#### `node.create`

- 대상: Canvas 또는 명시적 부모/컨테이너가 있는 위치
- 결과: 새 JSX element 삽입
- 입력 필수값:
  - `type`
  - `id`
  - 생성 위치 정보 또는 부모 정보
  - 초기 content/style props

기술 설계:

- UI trigger:
  - empty canvas click create
  - toolbar tool create
  - AI create action
- command payload:

```ts
type CreateNodeCommand = EditCommandBase & {
  type: 'node.create';
  create: {
    nodeType: 'shape' | 'text' | 'markdown' | 'sticky' | 'sticker' | 'washi-tape' | 'image';
    id: string;
    initialProps?: Record<string, unknown>;
    initialContent?: string;
  };
  placement:
    | { mode: 'canvas-absolute'; x: number; y: number }
    | { mode: 'mindmap-child'; parentId: string }
    | { mode: 'mindmap-sibling'; siblingOf: string; parentId: string | null };
};
```

- server validation:
  - nodeType -> component tag mapping 검사
  - placement mode와 target scope 일치 여부 검사
  - id collision 검사
- patcher:
  - `patchNodeCreate`
  - placement mode에 맞는 prop 주입
  - component별 default prop builder 사용
- insertion policy:
  - Canvas absolute: 현재 surface의 top-level children에 삽입
  - MindMap child/sibling: 해당 MindMap subtree 내부에 삽입
  - frame/local scope는 source provenance 기준으로 source file와 insertion scope를 resolve

필요 구현:

- nodeType -> JSX component mapping registry
- component별 default prop template
- insertion scope resolver

### Semantic Command와 RPC 매핑

초기 구현에서는 semantic command와 transport RPC를 아래처럼 매핑한다.

| Semantic Command | Initial RPC | Server Patcher |
|---|---|---|
| `node.move.absolute` | `node.move` | `patchNodePosition` |
| `node.move.relative` | `node.update` | `patchNodeRelativePosition` |
| `node.content.update` | `node.update` | `patchNodeContent` |
| `node.style.update` | `node.update` | `patchNodeStyle` |
| `node.rename` | `node.update` | `patchNodeRename` |
| `node.reparent` | `node.reparent` | `patchNodeReparent` |
| `mindmap.child.create` | `node.create` | `patchNodeCreate` |
| `mindmap.sibling.create` | `node.create` | `patchNodeCreate` |
| `node.create` | `node.create` | `patchNodeCreate` |

초기에는 기존 RPC를 재사용해도 되지만, 구현이 커질수록 semantic command와 RPC를 1:1로 맞추는 쪽이 디버깅과 계약 관리에 유리하다.

## Object Family별 편집 규칙

### 1. Canvas Absolute Objects

대상 예:

- `Shape`
- `Text`
- `Image`
- absolute `Sticky`

편집 규칙:

- drag = `node.move.absolute`
- inspector = `node.style.update`
- double click = `node.content.update`
- add from toolbar = `node.create`

### 2. Relative Attachment Objects

대상 예:

- `Sticker` with `anchor`
- `WashiTape` with `at.type = attach`
- anchor 기반 배치 오브젝트

편집 규칙:

- drag = 상대값 변경
- attach 관계는 유지
- 절대 좌표로 강등하지 않음

### 3. MindMap Members

대상 예:

- `Node`
- MindMap 내부의 `Shape`, `Sticky`, `Markdown`, `Image`, `Sequence`

편집 규칙:

- drag는 기본적으로 `x/y 저장`이 아니다
- drop target이 유효하면 `node.reparent`
- 같은 부모 내부에서 순서 변경이 감지되면 추후 `mindmap.reorder`
- quick action으로 `자식 추가`, `형제 추가`를 우선 지원

### 4. Rich Content Objects

대상 예:

- `Markdown`
- multi-line `Text`

편집 규칙:

- double click = inline editor 진입
- commit 시 content만 저장
- style 편집은 inspector에서 분리

## 신규 오브젝트 생성 모델

### Canvas 생성

Canvas에서는 사용자가 툴을 고르고 캔버스를 클릭하면 생성한다.

- Shape 생성: 클릭 위치를 `x/y`로 사용
- Text 생성: 클릭 위치 + 빈 텍스트 또는 기본 placeholder
- Markdown 생성: 클릭 위치 + 기본 markdown source
- Sticky/Sticker/WashiTape 생성: 타입별 기본 props 적용

### MindMap 생성

MindMap에서는 클릭 위치 기반 생성보다 구조 기반 생성이 더 중요하다.

- 선택 노드 아래 자식 추가
- 선택 노드와 같은 부모 아래 형제 추가
- 새 branch 템플릿 추가

생성 결과는 position이 아니라 `from` 관계를 기준으로 저장한다.

### 생성 시 기본 원칙

- 삽입 위치는 가장 가까운 semantic parent를 기준으로 결정한다
- diff는 새 element 추가로 끝나야 한다
- 기존 sibling/children 구조를 불필요하게 재정렬하지 않는다
- 생성 후 필요한 최소 props만 작성한다

## AST Patch 전략

### Generic Patcher 지양

generic `patchFile(nodeId, props)`는 단순 속성 수정에는 유용하지만, 편집 범위가 넓어질수록 예상치 못한 diff를 만들기 쉽다.

따라서 command별 전용 patcher를 둔다.

- `patchNodePosition`
- `patchNodeRelativePosition`
- `patchNodeContent`
- `patchNodeStyle`
- `patchNodeRename`
- `patchNodeCreate`
- `patchNodeReparent`

### Patcher Helper 분리

전용 patcher 아래에 공통 helper를 둔다.

- `resolveTargetElement(sourceId, filePath)`
- `assertEditableLiteralAttr(attrName)`
- `mergeObjectLiteralAttr(attrName, patch)`
- `replaceTextChild()`
- `replaceMarkdownChild()`
- `rewriteReferences(oldId, newId)`
- `resolveInsertionPoint(mode, scope)`

이 helper가 있어야 command별 patcher가 각자 AST 세부 구현을 중복하지 않는다.

### 최소 수정 원칙

patcher는 아래 원칙을 따라야 한다.

- 의도한 prop만 수정
- 기존 JSX 구조를 최대한 보존
- 다른 prop 순서나 formatting을 불필요하게 건드리지 않음
- 실패 시 명시적으로 reject

## Editable Subset Contract

웹 편집이 가능한 TSX 패턴을 명시적으로 제한한다.

### Editable로 보는 패턴

- literal `id`
- literal `x`, `y`, `gap`
- object literal `at`
- 단순 string children
- 단순 `<Markdown>{\`...\`}</Markdown>`
- 명시적 prop 기반 style

### 제한 또는 read-only로 보는 패턴

- spread props
- 계산식으로 생성된 id/position
- 함수 호출 결과를 직접 prop에 사용
- deeply nested custom children tree
- 사용자가 직접 만든 복합 frame 내부의 비표준 구조

### UI 정책

- 편집 불가능한 노드는 read-only badge를 표시할 수 있다
- read-only 노드도 selection, export, AI targeting은 가능해야 한다

## UI/UX 방향

### 1. Selection-first Editing

- 편집은 항상 selection에서 시작한다
- 선택 즉시 가능한 action만 UI에 노출한다

### 2. Inspector 중심 속성 편집

- 현재 선택된 노드 타입에 따라 inspector를 동적으로 구성한다
- inspector는 저장 가능한 prop만 노출한다

### 3. Contextual Create Actions

- Canvas 빈 공간 우클릭: 생성 메뉴
- MindMap node 우클릭: 자식 추가 / 형제 추가 / 부모 변경
- Floating toolbar: 자주 쓰는 생성 도구

### 4. Predictable Diff UX

- 사용자가 "이 조작이 코드에서 무엇을 바꿀지" 예측할 수 있어야 한다
- drag는 위치만
- rename은 id와 참조만
- content edit는 텍스트만

## 실패 처리 원칙

- version conflict 시 optimistic UI를 롤백한다
- patch 실패 시 기존 상태를 복원한다
- edit target을 찾지 못하면 재동기화 안내를 제공한다
- unsupported editable subset이면 저장을 시도하지 않고 read-only로 처리한다

## 단계별 구현 방향

### Phase 1. Focused Editing 완성

- absolute move 안정화
- relative attachment move 일반화
- text/markdown edit 저장 안정화
- inspector 편집을 RPC 저장과 연결
- `editMeta` 최소 계약 추가
- `patchNodeContent`, `patchNodeStyle` 분리

### Phase 2. Create Actions 추가

- Canvas node create UI 추가
- MindMap child/sibling create 추가
- 타입별 기본 props/template 정리
- insertion scope resolver 추가

### Phase 3. Structure Editing 강화

- drag-to-reparent
- cycle guard UX
- drop preview
- scope-aware reparent
- mindmap target hit-testing

### Phase 4. Identity/Reference Editing

- id rename UI 추가
- 참조 갱신 범위 확장
- rename impact preview

### Phase 5. Advanced MindMap Editing

- sibling reorder
- branch direction
- collapse/expand state

## 오픈 이슈

- `Sticker`와 `Sticky`의 생성/편집 의미를 어떻게 더 명확히 분리할 것인가
- `id rename` 시 `at.target`, nested port reference, custom prop reference까지 어디까지 갱신할 것인가
- MindMap reorder를 drag 기반으로 해석할지, 명시적 action으로 먼저 열지
- editable subset 위반 시 read-only 표시를 어떤 수준에서 노출할 것인가
- 생성 시 JSX 삽입 위치를 어떤 규칙으로 고정할 것인가

## 정리

이 문서의 결론은 단순하다.

- TSX source of truth는 유지한다
- 웹 편집은 raw canvas state를 저장하는 것이 아니라 semantic command를 저장하는 행위로 본다
- command별 전용 patcher와 editable subset 계약이 있어야 direct manipulation이 안전하게 TSX 수정으로 이어진다

즉 앞으로의 방향은 "자유 편집을 AST에 그대로 투영"하는 것이 아니라, `웹 조작을 TSX에 안전한 명령으로 번역하는 편집기`를 만드는 것이다.
