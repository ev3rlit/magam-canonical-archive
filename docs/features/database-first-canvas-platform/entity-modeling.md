# Database-First Canvas Platform 엔티티 모델링

## 1. 문서 목적

이 문서는 `database-first-canvas-platform`을 **애플리케이션 레벨 엔티티 모델** 관점에서 설명한다.

기존 [schema-modeling.md](./schema-modeling.md)는 데이터베이스 친화적인 관계 모델에 집중했다. 하지만 Drizzle ORM을 사용할 경우 실제 구현에서는 다음이 더 중요해진다.

- 어떤 테이블 묶음을 하나의 aggregate로 볼 것인가
- 어떤 데이터를 entity로 다루고, 어떤 데이터를 value object로 다룰 것인가
- `jsonb` 컬럼 안의 payload를 어떤 타입으로 관리할 것인가
- `semantic role`, `content contract`, `capability`, `binding`, `layout`을 어디에 둘 것인가

즉, 이 문서는 **schema-modeling 내용을 포함하면서**, 그 위에 애플리케이션 레벨 모델을 덧씌운 상위 문서다.

기본 persistence 선택:

- ORM: `Drizzle ORM`
- local/embedded PostgreSQL path: `PGlite`
- production path: PostgreSQL/pgvector 호환 구성

## 2. 핵심 관점

Drizzle에서는 “테이블 하나 = 엔티티 하나”로 바로 가면 금방 모델이 거칠어진다. 이 프로젝트는 특히 다음 이유 때문에 애플리케이션 레벨 모델이 먼저 필요하다.

- 하나의 문서는 `documents` 단일 row가 아니라 `surfaces`, `canvas_nodes`, `canvas_edges`, `canvas_bindings`를 함께 가진다.
- 하나의 plugin instance는 `plugin_instances` row만이 아니라 `canvas_nodes`와 binding까지 함께 봐야 의미가 완성된다.
- canonical object는 더 이상 `objectKind + metadata` 한 묶음이 아니라 `semantic role + content contract + capability bag + provenance` 축으로 나뉜다.
- file-first 쪽 `ObjectCore` 계약은 database-first에서는 하나의 row로 복사되지 않고, workspace-stable 의미 데이터와 document-local 배치 데이터로 분해돼 저장될 수 있다.
- `style`, `layout`, `viewport_state`, `binding_config`, capability payload는 단순 JSON blob가 아니라 타입이 있는 값 객체다.

따라서 구현에서는 아래 4층을 구분하는 것이 좋다.

1. **Relational Table**
   - Drizzle이 직접 읽고 쓰는 실제 테이블
2. **Persistence Model**
   - 테이블 row와 1:1 또는 1:n으로 대응하는 저장 모델
3. **Application Entity / Aggregate**
   - 비즈니스 규칙과 불변식을 가진 도메인 모델
4. **Value Object**
   - `layout`, `style`, `capability`, `binding`처럼 identity 없이 값으로 비교되는 타입

## 3. 모델링 원칙

1. workspace, document, canonical object, plugin catalog는 서로 다른 aggregate 경계를 가진다.
2. canvas의 배치 책임과 canonical object의 의미 책임은 분리한다.
3. native object의 canonical shape는 `semantic role`, `content kind`, `capability bag`, `provenance` 축으로 다룬다.
4. public alias는 authoring surface이지 persistence base type이 아니다.
5. plugin source와 plugin instance는 분리한다.
6. `style`, `binding`, capability payload는 top-level entity가 아니라 typed value object로 다룬다.
7. Drizzle schema는 persistence contract이고, 애플리케이션 entity는 그 위의 해석 계층이다.

## 4. Aggregate 경계

### WorkspaceAggregate

- 루트: `WorkspaceEntity`
- 포함: workspace metadata, document index, object index, plugin catalog index
- 책임: workspace 범위, 검색 범위, 권한 범위, 백업/내보내기 범위

### DocumentAggregate

- 루트: `DocumentEntity`
- 포함: `SurfaceEntity`, `CanvasNodeEntity`, `CanvasEdgeEntity`, `CanvasBindingEntity`, `DocumentRevisionEntity`
- 책임: 문서 내부 배치, surface 구성, 부모-자식 관계, selection-independent persisted state

### CanonicalObjectAggregate

- 루트: `ObjectEntity`
- 포함: `ObjectRelationEntity`, `EmbeddingRecordEntity`
- 책임: canonical native object 의미 데이터, content contract, capability provenance, relation graph

### PluginCatalogAggregate

- 루트: `PluginPackageEntity`
- 포함: `PluginVersionEntity`, `PluginExportEntity`, `PluginPermission`
- 책임: 설치된 plugin 자산과 capability 선언

### PluginInstanceAggregate

- 루트: `PluginInstanceEntity`
- 포함: 관련 `CanvasNodeEntity`, 선택적 `CanvasBindingEntity`
- 책임: 특정 문서에 배치된 widget 인스턴스의 props/state/binding

## 5. 핵심 엔티티

아래 계약은 구현 시점의 TypeScript/Drizzle 모델을 바로 상상할 수 있게 하기 위한 **애플리케이션 레벨 contract**다. 실제 코드에서는 branded id, enum, validator 타입으로 더 좁혀질 수 있다.

## 5.1 Workspace and Document

### WorkspaceEntity

용도:

- 문서, 오브젝트, 플러그인이 속하는 최상위 경계

Persistence mapping:

- `workspaces`

```ts
interface WorkspaceEntity {
  id: string;
  slug: string;
  name: string;
  settings: WorkspaceSettings;
}
```

### DocumentEntity

용도:

- 사용자가 여는 board/canvas/note의 루트 엔티티
- 문서 메타와 schema version의 owner

Persistence mapping:

- `documents`
- `document_revisions`

```ts
interface DocumentEntity {
  id: string;
  workspaceId: string;
  kind: DocumentKind;
  title: string;
  schemaVersion: number;
  status: DocumentStatus;
  metadata: DocumentMetadata;
}
```

### SurfaceEntity

용도:

- 하나의 document 안에서 실제 편집 가능한 scene root
- 메인 canvas, 보조 보드, mindmap surface 등을 표현

Persistence mapping:

- `surfaces`

```ts
interface SurfaceEntity {
  id: string;
  documentId: string;
  surfaceKind: SurfaceKind;
  name: string;
  viewportState: ViewportState;
  settings: SurfaceSettings;
}
```

### DocumentRevisionEntity

용도:

- 문서 변경의 append-only history

Persistence mapping:

- `document_revisions`

```ts
interface DocumentRevisionEntity {
  id: string;
  documentId: string;
  revisionNo: number;
  authorKind: "user" | "agent" | "system";
  authorId: string;
  mutationBatch: MutationBatch;
  snapshotRef?: string;
}
```

## 5.2 Canonical Object Model

### ObjectEntity

용도:

- 문서가 참조할 수 있는 native object 의미 데이터의 canonical entity
- 여러 문서가 같은 object를 다른 위치/레이아웃으로 재사용 가능
- `semantic role`, `content contract`, `capability bag`, `provenance`의 owner

Persistence mapping:

- `objects`

```ts
interface ObjectEntity {
  id: string;
  workspaceId: string;
  semanticRole: SemanticRole;
  primaryContentKind?: ContentKind;
  alias?: CanonicalObjectAlias;
  contentBlocks?: ContentBlockValue[];
  sourceMeta: ObjectSourceMetaValue;
  capabilities: CapabilityBagValue;
  capabilitySources?: CapabilitySourceMap;
  canonicalText: string;
  extensions: NamespacedExtensionMap;
}
```

설계 포인트:

- `documentId`를 두지 않는 이유는 object가 문서 소속이 아니라 workspace 소속이기 때문이다.
- 같은 object는 여러 `CanvasNodeEntity`에 바인딩될 수 있다.
- `primaryContentKind`는 direct `capabilities.content.kind` 또는 `contentBlocks`의 검색/인덱싱 친화 projection이다.
- `contentBlocks`는 기존 선언형 `Node`/`Sticky`의 ordered note body를 보존하는 canonical block container 값 객체다.
- editable note-like object는 shared canonical reference보다 copy-on-create가 기본이며, explicit shared mode만 예외다.
- `alias`는 canonical truth가 아니라 provenance/compatibility 힌트다.
- file-first `ObjectCore`의 `position`, `children`, 일부 relation 입력은 database-first에서 그대로 `objects` row에 넣지 않고 `canvas_nodes` 또는 `object_relations`로 분리될 수 있다.

### ObjectRelationEntity

용도:

- object 간의 parent/reference/schedule/dependency graph를 표현
- canonical object contract에서 relation 축을 별도 aggregate entity로 분리 저장

Persistence mapping:

- `object_relations`

```ts
interface ObjectRelationEntity {
  id: string;
  workspaceId: string;
  fromObjectId: string;
  relationType: ObjectRelationType;
  toObjectId: string;
  sortKey?: number;
  metadata: RelationMetadata;
}
```

### EmbeddingRecordEntity

용도:

- object/document/plugin-instance에 대한 semantic index

Persistence mapping:

- `embedding_records`

```ts
interface EmbeddingRecordEntity {
  id: string;
  workspaceId: string;
  ownerKind: "object" | "document" | "plugin-instance";
  ownerId: string;
  modelName: string;
  sourceText: string;
  embedding: number[] | PgVectorValue;
}
```

## 5.3 Canvas Composition

### CanvasNodeEntity

용도:

- 문서 안에 실제 배치되는 모든 시각 노드
- native node, plugin-backed node, binding-proxy node를 공통 모델로 수용

Persistence mapping:

- `canvas_nodes`

```ts
interface CanvasNodeEntity {
  id: string;
  documentId: string;
  surfaceId: string;
  nodeKind: "native" | "plugin" | "binding-proxy";
  nodeType?: string;
  parentNodeId?: string;
  canonicalObjectId?: string;
  pluginInstanceId?: string;
  props: NodeProps;
  layout: NodeLayout;
  style: NodeStyle;
  persistedState: NodePersistedState;
  zIndex: number;
}
```

설계 포인트:

- `parentNodeId`는 group/frame/container 계층을 표현한다.
- native node의 `semanticRole`, `content.kind`, capability payload는 직접 소유하지 않고 `canonicalObjectId`를 통해 가져온다.
- native node의 `contentBlocks`도 직접 소유하지 않고 `canonicalObjectId`를 통해 가져온다.
- `nodeType`은 renderer hint 또는 legacy fallback일 수 있지만, semantic truth가 되면 안 된다.
- `props`는 canvas-local display state 또는 plugin/widget 입력값이어야 하며 canonical object content/capability payload를 중복 소유하면 안 된다.

### CanvasEdgeEntity

용도:

- surface 위에 표시되는 연결선
- 순수 시각 edge와 canonical relation 투영 edge를 모두 포함

Persistence mapping:

- `canvas_edges`

```ts
interface CanvasEdgeEntity {
  id: string;
  documentId: string;
  surfaceId: string;
  edgeKind: "native" | "relation-proxy" | "plugin-owned";
  fromNodeId: string;
  toNodeId: string;
  props: EdgeProps;
  layout: EdgeLayout;
  persistedState: EdgePersistedState;
}
```

### CanvasBindingEntity

용도:

- canvas node와 canonical data/query 사이의 연결 규칙

Persistence mapping:

- `canvas_bindings`

```ts
interface CanvasBindingEntity {
  id: string;
  documentId: string;
  nodeId: string;
  bindingKind: "object" | "query" | "relation-set" | "field-map";
  sourceRef: BindingSourceRef;
  mapping: BindingMapping;
}
```

## 5.4 Plugin Runtime

### PluginPackageEntity

용도:

- plugin의 논리적 package 단위

Persistence mapping:

- `plugin_packages`

```ts
interface PluginPackageEntity {
  id: string;
  workspaceId?: string;
  packageName: string;
  displayName: string;
  ownerKind: "workspace" | "user" | "system";
  ownerId: string;
}
```

### PluginVersionEntity

용도:

- 특정 package의 실행 가능한 version

Persistence mapping:

- `plugin_versions`

```ts
interface PluginVersionEntity {
  id: string;
  pluginPackageId: string;
  version: string;
  manifest: PluginManifest;
  bundleRef: string;
  integrityHash: string;
  status: "active" | "disabled" | "deprecated";
}
```

### PluginExportEntity

용도:

- plugin version이 노출하는 widget/panel/inspector entry

Persistence mapping:

- `plugin_exports`
- `plugin_permissions`

```ts
interface PluginExportEntity {
  id: string;
  pluginVersionId: string;
  exportName: string;
  componentKind: "widget" | "panel" | "inspector";
  propSchema: JsonSchemaLike;
  bindingSchema: JsonSchemaLike;
  capabilities: PluginCapabilitySet;
}
```

### PluginInstanceEntity

용도:

- 특정 문서에 배치된 plugin widget 인스턴스

Persistence mapping:

- `plugin_instances`
- 관련 `canvas_nodes`
- 선택적 `canvas_bindings`

```ts
interface PluginInstanceEntity {
  id: string;
  documentId: string;
  surfaceId: string;
  pluginExportId: string;
  pluginVersionId: string;
  displayName: string;
  props: NodeProps;
  bindingConfig: BindingSpec;
  persistedState: PluginPersistedState;
}
```

## 6. Value Object 모델링

이 프로젝트에서 많은 중요한 상태는 별도 entity가 아니라 value object다. Drizzle에서는 대체로 `jsonb` 컬럼으로 저장되고, 애플리케이션에서는 타입이 있는 TS 객체로 다룬다.

## 6.1 ObjectSourceMetaValue

용도:

- canonical object와 source provenance를 연결하는 최소 메타
- alias provenance, edit routing, legacy normalization 추적 기준

저장 위치:

- `objects.source_meta`

```ts
interface ObjectSourceMetaValue {
  sourceId: string;
  filePath?: string;
  scopeId?: string;
  kind?: "canvas" | "mindmap";
  renderedId?: string;
  frameScope?: string;
  framePath?: string[];
  [key: string]: unknown;
}
```

## 6.2 ContentCapabilityValue

용도:

- native object 본문 계약 축을 표현
- style capability와 별도 validation path를 가진다

```ts
type ContentCapabilityValue =
  | { kind: "text"; value: string; fontSize?: number | string }
  | { kind: "markdown"; source: string; size?: unknown }
  | { kind: "media"; src: string; alt?: string; fit?: "cover" | "contain" | "fill" | "none" | "scale-down"; width?: number; height?: number }
  | { kind: "sequence"; participants: unknown[]; messages: unknown[] };
```

설계 포인트:

- object는 동시에 하나의 declared `content.kind`만 가진다.
- content validation은 style/capability validation과 별도로 수행한다.
- `Image`, `Markdown`, `Sequence` 같은 alias는 결국 이 contract에 정규화된다.
- ordered note body는 direct `ContentCapabilityValue`로 펴지지 않고 별도 `ContentBlockValue[]`로 저장한다.
- 이 배열은 rich text 전용이 아니라 장기적으로 custom structured block을 수용하는 container다.

### ContentBlockValue

용도:

- 기존 선언형 `Node`/`Sticky`가 가졌던 ordered body를 canonical 값 객체로 유지
- 새 note-like object 생성 시 기본 empty body seed와 block-level mutation의 기준 shape 제공
- 장기적으로 Notion-style custom block을 같은 node 안에 담을 수 있는 확장 경계 제공

저장 위치:

- `objects.content_blocks`

```ts
type ContentBlockValue =
  | { id: string; blockType: "text"; text: string }
  | { id: string; blockType: "markdown"; source: string }
  | {
      id: string;
      blockType: string;
      payload: Record<string, unknown>;
      textualProjection?: string;
      metadata?: Record<string, unknown>;
    };
```

설계 포인트:

- array 순서가 canonical display/edit order다.
- block id는 object 내부에서 stable해야 한다.
- core block type `text`, `markdown`은 first-class validation 대상이고, custom block은 namespaced `blockType`과 structured payload를 가진다.
- `primaryContentKind`는 built-in block projection만 반영하며, custom block만 있을 때는 `NULL`을 허용한다.
- 새 editable note-like object는 initial body가 없으면 빈 `text` block 하나로 seed한다.
- cross-document create/duplicate/import에서 editable note body는 shared reference가 아니라 clone 대상이다.

## 6.3 CapabilityBagValue

용도:

- native object의 opt-in 기능 집합
- frame/material/texture/attach/content 같은 capability payload를 한곳에 모은다

저장 위치:

- `objects.capabilities`

```ts
interface CapabilityBagValue {
  frame?: { shape?: string; fill?: string; stroke?: string; strokeWidth?: number };
  material?: { preset?: string; pattern?: unknown };
  texture?: { noiseOpacity?: number; glossOpacity?: number; texture?: unknown };
  attach?: { target?: string; position?: string; offset?: number };
  ports?: { ports: unknown[] };
  bubble?: { bubble: boolean };
  content?: ContentCapabilityValue;
}
```

설계 포인트:

- allow-list 밖 capability key는 허용하지 않는다.
- `content`는 capability bag 안에 저장되지만, validation은 별도 content contract를 따른다.
- `Sticky` 같은 alias는 별도 base entity가 아니라 capability preset으로 해석된다.

## 6.4 CapabilitySourceMap

용도:

- 각 capability가 explicit, legacy-inferred, alias-default 중 어디서 왔는지 추적
- patch gate와 migration 판단에서 provenance를 유지

저장 위치:

- `objects.capability_sources`

```ts
type CapabilitySourceMap = Partial<Record<CanonicalCapabilityKey, NormalizationSource>>;
```

## 6.5 NodeLayout

용도:

- 위치, 크기, 회전, anchor, relative/absolute 좌표 정책

저장 위치:

- `canvas_nodes.layout`
- `canvas_edges.layout`

```ts
interface NodeLayout {
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  anchor?: AnchorSpec;
  positionMode?: "absolute" | "relative";
}
```

## 6.6 NodeStyle

용도:

- 노드의 시각적 표현 규칙
- 색상, radius, border, shadow, typography, utility class 같은 표시 정보를 가진다

저장 위치:

- `canvas_nodes.style`

```ts
interface NodeStyle {
  tokens?: string[];
  classList?: string[];
  slotClasses?: Record<string, string[]>;
  cssVars?: Record<string, string>;
  appearance?: Record<string, unknown>;
}
```

설계 포인트:

- tailwind는 별도 top-level entity가 아니라 `NodeStyle` 내부의 표현 규칙으로 보는 편이 맞다.
- 저장 시 raw CSS 전체를 넣기보다 utility class 또는 semantic token 수준을 유지하는 편이 낫다.

## 6.7 NodeProps

용도:

- canvas-local display props 또는 plugin/widget 입력값
- 예: plugin widget option, canvas-local decorator 설정, renderer fallback 옵션

저장 위치:

- `canvas_nodes.props`
- `canvas_edges.props`
- `plugin_instances.props`

설계 포인트:

- native node의 semantic/content/capability payload는 여기 두지 않는다.
- `props`는 layout이나 transient UI state를 섞지 않는다.
- `props`는 canvas-local 표현 입력값이어야 한다.

```ts
type NodeProps = Record<string, unknown>;
type EdgeProps = Record<string, unknown>;
```

## 6.8 TailwindUtilitySpec

용도:

- Tailwind utility를 애플리케이션 레벨에서 다루기 위한 값 객체

권장 형태:

```ts
type TailwindUtilitySpec = {
  classList?: string[];
  slotClasses?: Record<string, string[]>;
  dataAttrs?: Record<string, string>;
  cssVars?: Record<string, string>;
};
```

설계 포인트:

- top-level table로 올리지 않는다.
- 보통은 `NodeStyle` 내부에 포함된다.
- class string 한 줄보다 `string[]`나 slot별 구조가 병합/검증에 더 유리하다.

## 6.9 ViewportState

용도:

- surface의 줌, 오프셋, 가이드, 표시 옵션

저장 위치:

- `surfaces.viewport_state`

```ts
interface ViewportState {
  zoom: number;
  offsetX: number;
  offsetY: number;
  guides?: Record<string, unknown>;
  displayOptions?: Record<string, unknown>;
}
```

## 6.10 BindingSpec

용도:

- object/query/relation-set를 node props에 연결하는 규칙

저장 위치:

- `canvas_bindings.source_ref`
- `canvas_bindings.mapping`
- `plugin_instances.binding_config`

```ts
interface BindingSpec {
  sourceRef: BindingSourceRef;
  mapping: BindingMapping;
}
```

## 6.11 PluginManifest / Capability

용도:

- plugin version이 어떤 export, 권한, runtime 요구사항을 가지는지 선언

저장 위치:

- `plugin_versions.manifest`
- `plugin_exports.capabilities`
- `plugin_permissions.permission_value`

```ts
interface PluginManifest {
  runtime: "iframe";
  exports: string[];
  capabilities: PluginCapabilitySet;
  entry: string;
}
```

## 7. 엔티티와 테이블의 대응

| 애플리케이션 모델 | Drizzle/persistence mapping | 설명 |
|------|------|------|
| `WorkspaceEntity` | `workspaces` | 워크스페이스 루트 |
| `DocumentEntity` | `documents` + `document_revisions` | 문서 aggregate 루트 |
| `SurfaceEntity` | `surfaces` | surface 루트 |
| `ObjectEntity` | `objects` | workspace-scoped canonical object role/content/capability |
| `ObjectRelationEntity` | `object_relations` | object graph edge |
| `EmbeddingRecordEntity` | `embedding_records` | semantic index |
| `CanvasNodeEntity` | `canvas_nodes` | 배치 노드 |
| `CanvasEdgeEntity` | `canvas_edges` | 배치 edge |
| `CanvasBindingEntity` | `canvas_bindings` | data binding |
| `PluginPackageEntity` | `plugin_packages` | plugin package |
| `PluginVersionEntity` | `plugin_versions` | plugin artifact version |
| `PluginExportEntity` | `plugin_exports` + `plugin_permissions` | export + capability |
| `PluginInstanceEntity` | `plugin_instances` + related `canvas_nodes` | 문서 위젯 인스턴스 |

## 8. Drizzle 구현 관점 가이드

### 8.1 추천 패턴

- table definition은 Drizzle schema에 둔다.
- row -> entity 변환은 mapper 또는 repository layer에서 담당한다.
- `jsonb` payload는 Zod/Valibot 같은 런타임 validator와 함께 타입화한다.
- aggregate 단위 로딩은 repository method로 제공한다.
- canonical object validation은 capability registry와 content-kind contract를 함께 재사용한다.
- Drizzle repository/service 경계는 PGlite bootstrap과 production PostgreSQL driver bootstrap을 분리해도 동일하게 유지한다.

예시:

- `documentRepository.loadDocumentAggregate(documentId)`
- `objectRepository.loadWorkspaceCanonicalObjects(workspaceId)`
- `pluginRepository.loadPluginCatalog(workspaceId)`

### 8.2 피해야 할 패턴

- route handler가 Drizzle row를 그대로 UI에 넘기는 것
- `jsonb` payload를 `unknown` 상태로 전파하는 것
- public alias를 canonical persistence base type처럼 취급하는 것
- canonical object content/capability payload를 `canvas_nodes.props`에 다시 저장하는 것
- `props/style/layout`를 하나의 큰 blob으로 섞는 것
- plugin instance와 canvas node를 같은 개념으로 취급하는 것

## 9. schema-modeling과의 관계

이 문서는 [schema-modeling.md](./schema-modeling.md)의 상위 문서다.

- `schema-modeling.md`
  - DB 테이블과 관계 모델 중심
- `entity-modeling.md`
  - Drizzle 기반 애플리케이션 모델 중심

실제 구현 시작점으로는 이 문서를 먼저 읽고, SQL/DDL/Drizzle table 설계 시 `schema-modeling.md`를 참고하는 순서를 권장한다.

## 10. 관련 문서

- [docs/features/object-capability-composition/README.md](docs/features/object-capability-composition/README.md)
- [schema-modeling.md](./schema-modeling.md)
- [implementation-plan.md](./implementation-plan.md)
- [README.md](./README.md)
