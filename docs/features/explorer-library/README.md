# Explorer Library PRD (Magam)

작성일: 2026-03-31  
상태: Draft  
결정: `workspace-local DB-backed explorer library`

## Executive Summary

Magam은 canvas-first, workspace-scoped, database-first 제품 방향을 갖고 있지만, 반복적으로 재사용할 템플릿과 리소스를 워크스페이스 내부 DB에 축적하고 즉시 꺼내 쓰는 전용 shell은 아직 없다. Explorer Library는 워크스페이스 로컬 데이터베이스 안에 `template`, `asset`, `reference`를 저장하고, 하단 패널의 빠른 탐색과 전용 라이브러리 화면에서 검색·미리보기·적용할 수 있게 하는 DB-native 보관함이다.

## Problem Statement

현재 Magam에는 자주 쓰는 보드 구조, 이미지 자산, 참고 리소스를 앱 내부의 canonical storage 관점에서 누적하고 재사용하는 일관된 제품 surface가 없다.

- 반복 작업에 쓰이는 구조와 자료가 캔버스 안이나 파일 시스템에 흩어져 있어 재사용 비용이 높다.
- existing image flow는 여전히 `assets/images` 같은 파일 저장 관성이 남아 있어 database-first 방향과 어긋난다.
- note-like editable content는 canonical persistence에서 shared live template 경로가 범위 밖으로 남아 있어, 재사용 모델을 제품 차원에서 다시 정의해야 한다.
- 사람 중심의 리소스 보관 UX와 워크스페이스 내부 재사용 모델이 하나의 제품 개념으로 정리되어 있지 않다.

## Proposed Solution

Explorer Library를 워크스페이스 로컬 DB 안의 general vault로 도입한다.

- 저장 범위는 현재 workspace로 제한한다.
- 저장 단위는 `LibraryItem`이며, MVP 타입은 `template`, `asset`, `reference`로 고정한다.
- 바이너리도 metadata와 함께 workspace DB에 직접 저장한다.
- 탐색 구조는 file tree가 아니라 `search + tags + collections + recent/favorite` 중심으로 설계한다.
- 주요 ingest 경로는 외부 import보다 현재 workspace/canvas/selection에서 저장하는 흐름을 우선한다.
- 적용 동작은 타입별 혼합 모델로 두고, `template`는 clone/instantiate, `asset`은 insert/attach, `reference`는 link or attach metadata를 기본으로 한다.
- shell은 `하단 패널 quick explorer + 전용 라이브러리 화면`의 2-surface 조합으로 제공한다.
- editor shell 안에 배치되는 quick explorer surface는 기존 panel/widget 계층과 같은 종류의 shell widget으로 취급하며, 기본 chrome은 `WidgetBase`를 통해 제공한다.
- 제품 개념은 일반 파일 탐색기보다 Unreal/Unity의 `Content Browser`에 더 가깝다.

## Concept Origin And Prior Art

Explorer Library는 기존 whiteboard의 단순 템플릿 패널을 확장한 것이 아니라, 게임 엔진의 asset/content browsing 개념을 Magam의 canvas runtime에 맞게 가져오려는 시도다.

- 1차 개념 출처는 `Unreal Engine Content Browser`와 `Unity Project/Asset` 탐색기다.
- 이 두 시스템에서 가져오는 핵심은 `저장`, `탐색`, `미리보기`, `인스턴스화`, `참조`다.
- Magam은 이 개념을 파일 시스템 브라우저가 아니라 workspace-scoped DB browser로 재해석한다.
- 따라서 사용자 mental model은 "파일을 연다"보다 "저장된 content를 찾아 캔버스에 적용한다"에 가깝다.

가까운 prior art는 다음처럼 해석한다.

- `Unreal Engine`
  - asset을 탐색하고, 검색하고, 미리보고, scene에 배치하는 content browser의 원형에 가깝다.
- `Unity`
  - project/asset 탐색과 prefab 인스턴스화 개념이 `template -> instantiate` 모델과 가장 유사하다.
- `Figma`
  - assets/components/instance 개념은 일부 유사하지만, 일반 content browser보다는 design system asset panel에 더 가깝다.
- `Miro`, `FigJam`, `Excalidraw`
  - 템플릿과 라이브러리는 제공하지만, Unreal/Unity 수준의 content browser mental model은 상대적으로 약하다.

이 feature의 제품 포지셔닝은 다음 문장으로 요약한다.

- Explorer Library는 file explorer가 아니라 `workspace-scoped content browser`다.
- 핵심 동사는 `browse`, `save`, `instantiate`, `attach`, `reference`다.
- 따라서 UX와 용어는 문서/파일 편집기보다 engine-style content workflow에 더 가깝게 설계한다.

## Terminology Layers

Explorer Library는 같은 대상을 하나의 이름으로 밀어붙이지 않는다. 사용자 UI, 도메인 코어, 저장소 계층은 같은 뜻을 공유하되 서로 다른 naming rule을 가진다.

### 1. User-Facing Terminology

사용자에게는 작업 맥락과 mental model이 먼저 전달되어야 한다.

- `라이브러리`
  - 저장된 항목을 모아 다시 꺼내 쓰는 공간
- `항목`
  - 라이브러리 안의 개별 저장 단위
- `템플릿`
  - 캔버스에 다시 적용할 구조 또는 구성
- `자산`
  - 이미지나 첨부 같은 재사용 가능한 자료
- `참고자료`
  - 링크, 캔버스 참조, 오브젝트 참조 같은 재열람용 자료
- `컬렉션`
  - 항목을 묶어두는 사용자 정리 단위

### 2. Domain/Core Terminology

코어 로직은 UX 문구보다 안정성과 타입 명확성을 우선한다. 다만 문맥을 패키지/모듈이 이미 제공한다면, 타입 이름에 `ExplorerLibrary` 같은 긴 접두사를 반복하지 않는다.

- 패키지/모듈 문맥
  - `explorer-library`
  - `@magam/shared/explorer-library`
- 타입/클래스 이름
  - `LibraryItem`
  - `LibraryItemType`
  - `TemplateItem`
  - `AssetItem`
  - `ReferenceItem`
  - `LibraryCollection`
  - `LibraryItemVersion`
  - `TemplatePayload`
  - `AssetPayload`
  - `ReferencePayload`
  - `TemplateInstantiation`
  - `ReferenceTarget`

예시:

- 패키지 경계 바깥에서 부를 때: `explorer-library/LibraryItem`
- 코드 안에서 사용할 때: `LibraryItem`
- DB나 transport 계층으로 내려갈 때: `library_items`, `item_type`

### 3. Storage Terminology

저장소 계층은 구조적이고 충돌이 적은 이름을 사용한다.

- `library_items`
- `library_item_versions`
- `library_collections`
- `workspace_id`
- `item_type`
- `payload`
- `binary_blob`
- `created_by`

### 4. Avoid Terms

다음 용어는 계층을 섞거나 mental model을 흐리기 쉬우므로 기본 용어로 채택하지 않는다.

- UI 기본 용어로서의 `파일`
  - OS file과 database record 의미가 쉽게 충돌한다.
- UI 기본 용어로서의 `레코드`
  - 내부 구현 느낌이 강해 사용자 mental model을 해친다.
- 코어 타입 이름으로서의 `FileItem`
  - 실제 filesystem file과 오해를 만든다.
- 코어 타입 이름으로서의 `Document`
  - canvas document, library item, workspace document를 혼동시킨다.

### 5. Mapping Principle

- UI는 친화적인 이름을 사용한다.
- 도메인 코어는 안정적인 타입 이름을 사용한다.
- 저장소는 구조적인 필드/테이블 이름을 사용한다.
- 하나의 단어를 전 계층에 억지로 통일하지 않는다.

## Success Criteria

- 5,000개 라이브러리 item이 있는 workspace에서 검색 응답 p95가 200ms 이하이다.
- 현재 canvas 또는 selection을 library item으로 저장하는 기본 흐름이 3 interaction 이하이다.
- 하단 패널에서 원하는 item을 찾아 현재 캔버스에 적용하는 기본 흐름이 2 interaction 이하이다.
- `template` 적용 후 원본 item과 적용된 canvas state가 서로 독립적으로 편집된다.
- workspace를 전환하면 다른 workspace의 library item은 조회, 검색, 적용 어디에서도 섞이지 않는다.
- oversize binary, unsupported type, missing target reference는 silent fallback 없이 구조화된 에러를 반환한다.

## User Personas

- 반복적인 캔버스 작업을 빠르게 재사용하고 싶은 creator
- 보드 구조와 자산을 팀 표준처럼 큐레이션하고 싶은 operator
- 현재 캔버스에서 자주 쓰는 요소를 저장해 다음 작업에 바로 쓰고 싶은 solo builder
- 작업 자료와 참고 링크를 워크스페이스 안에서 정리하고 싶은 researcher

## Core User Stories

- As a canvas user, I want to save the current selection as a reusable template so that I can apply the same structure later without rebuilding it manually.
- As a content creator, I want to store images and attachments inside the workspace database so that the workspace remains self-contained.
- As a returning user, I want to find saved items by search, tags, collections, and recents so that I can insert them quickly instead of browsing folders.
- As a cautious user, I want template application to create an independent copy so that editing the result never mutates the original library item.
- As a researcher, I want to save and reopen reference items so that source material stays attached to the workspace context.

## Acceptance Criteria

- 템플릿 저장
  - 사용자는 현재 canvas 또는 selection을 `template` item으로 저장할 수 있다.
  - 저장된 template에는 source canvas/selection provenance와 preview metadata가 함께 기록된다.
  - note-like editable content는 shared live object로 재사용되지 않고 apply 시 새 instance로 복제된다.
- 자산 저장
  - 사용자는 이미지 또는 일반 첨부를 `asset` item으로 저장할 수 있다.
  - 바이너리와 metadata는 모두 workspace DB에 저장된다.
  - 파일 크기 제한을 초과하면 명시적 에러가 반환되고 partial save는 발생하지 않는다.
  - 외부 클립보드 이미지를 현재 canvas에 붙여넣으면 시스템은 `asset` record를 먼저 저장한 뒤, 그 asset을 참조하는 이미지 배치를 현재 canvas에 즉시 생성한다.
  - 클립보드 붙여넣기로 생성된 asset은 기본적으로 `recent/imported` 영역에 노출되고, 사용자가 태그나 컬렉션을 부여했을 때 curated library item으로 승격된다.
- 탐색과 정리
  - 사용자는 search, tags, collections, recents, favorites로 item을 찾을 수 있다.
  - 폴더 트리는 primary IA로 제공하지 않는다.
  - 하단 패널 quick explorer와 전용 라이브러리 화면은 같은 DB truth를 공유한다.
- 적용 동작
  - `template`는 현재 canvas에 instantiate/clone 된다.
  - `asset`은 현재 canvas에 insert 또는 attach 된다.
  - `reference`는 URL, canvas, object 같은 target을 통해 연결 또는 메타데이터 첨부에 사용된다.
- 워크스페이스 경계
  - 모든 library item, collection, version은 workspace-scoped identity를 가진다.
  - 다른 workspace의 item은 조회 및 검색 결과에 나타나지 않는다.
- 에러 계약
  - oversize binary, unsupported MIME/type, missing target reference, invalid item payload는 success-shaped fallback 없이 명시적 진단을 반환한다.

## Non-Goals

- 여러 workspace가 공유하는 global personal library
- editable note shared live template
- 범용 파일 탐색기 수준의 folder tree browser
- 대용량 미디어 관리나 cloud sync
- v1에서의 cross-workspace sync 또는 publish marketplace
- 앱 내부 AI assistant, prompt surface, MCP resource exposure

## UX Structure

### 1. 하단 패널 Quick Explorer

- 현재 canvas 흐름을 끊지 않고 최근 항목, 검색 결과, 즐겨찾기, 빠른 미리보기를 보여준다.
- 대표 액션은 `Save to Library`, `Insert`, `Apply`, `Open in Library`다.
- 빈 상태에서는 현재 selection/canvas를 첫 template로 저장하는 CTA를 우선 노출한다.
- editor shell 안에서 렌더링되는 quick explorer는 별도 ad-hoc panel이 아니라 `WidgetBase`를 기본으로 사용하는 shell widget이어야 한다.
- 하단 배치를 유지하려면 `WidgetBase` 또는 그와 동등한 shared widget contract를 확장해서 배치해야 하며, Explorer만을 위한 독자 shell wrapper는 만들지 않는다.

### 2. 전용 라이브러리 화면

- 큐레이션과 관리에 집중하는 surface다.
- 주요 구성은 검색창, tags filter, collections rail, item grid/list, detail inspector다.
- 사용자는 제목, 설명, 태그, 컬렉션, 즐겨찾기 여부를 편집할 수 있다.
- batch 관리보다 단일 item 탐색/정리/적용을 우선한다.

### 3. 정보 구조 원칙

- primary IA는 folder tree가 아니라 `search + tags + collections`다.
- `recent`와 `favorite`는 quick access surface로 취급한다.
- visible label은 중복 설명보다 탐색과 결정에 실제 도움이 되는 수준으로만 노출한다.
- 사용자가 느끼는 1차 mental model은 file explorer가 아니라 engine-style content browser여야 한다.
- editor shell 안의 Explorer는 canvas, outliner, inspector와 동일한 widget family로 읽혀야 한다.

## Data Model

### 1. Hybrid TypeScript Model

Explorer Library의 데이터 모델은 두 가지 방식을 혼합한다.

- 저장/전송/DB 정렬 관점에서는 Go식으로 단순한 `type + payload` record를 사용한다.
- 앱 내부 도메인 로직에서는 `type` discriminator를 기준으로 `TemplateItem`, `AssetItem`, `ReferenceItem`처럼 좁혀서 사용한다.

즉 source of truth는 TypeScript이지만, 모델링 전략은 "단순 record + 좁혀진 domain view"의 hybrid approach를 채택한다.

```ts
export type LibraryItemType = 'template' | 'asset' | 'reference';

export type ReferenceTargetKind = 'url' | 'canvas' | 'object';

export interface LibraryActor {
  kind: 'user' | 'system';
  id: string;
}

export interface TemplateSelection {
  nodeIds: string[];
  bindingIds: string[];
}

export interface TemplatePayload {
  sourceCanvasId: string;
  sourceSelection: TemplateSelection | null;
  previewText: string | null;
  previewImageAssetId: string | null;
  snapshot: Record<string, unknown>;
}

export interface AssetPayload {
  mimeType: string;
  byteSize: number;
  binaryData: Uint8Array;
  originalFilename: string | null;
  sha256: string;
  importSource: 'clipboard' | 'file' | 'url' | 'canvas-export';
  previewText: string | null;
  imageMetadata?: {
    width: number;
    height: number;
  } | null;
}

export interface ReferencePayload {
  targetKind: ReferenceTargetKind;
  target: string;
  displayHint: string | null;
  metadata: Record<string, unknown> | null;
}

export interface LibraryItemRecord {
  id: string;
  workspaceId: string;
  type: LibraryItemType;
  title: string;
  summary: string | null;
  tags: string[];
  collectionIds: string[];
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: LibraryActor;
  visibility: 'imported' | 'curated';
  payload: unknown;
}

export type TemplateItem = Omit<LibraryItemRecord, 'type' | 'payload'> & {
  type: 'template';
  payload: TemplatePayload;
};

export type AssetItem = Omit<LibraryItemRecord, 'type' | 'payload'> & {
  type: 'asset';
  payload: AssetPayload;
};

export type ReferenceItem = Omit<LibraryItemRecord, 'type' | 'payload'> & {
  type: 'reference';
  payload: ReferencePayload;
};

export type LibraryItem = TemplateItem | AssetItem | ReferenceItem;

export interface ReferenceTarget {
  kind: ReferenceTargetKind;
  value: string;
}

export interface TemplateInstantiation {
  itemId: string;
  canvasId: string;
  actor: LibraryActor;
}

export function toTemplateItem(record: LibraryItemRecord): TemplateItem;
export function toAssetItem(record: LibraryItemRecord): AssetItem;
export function toReferenceItem(record: LibraryItemRecord): ReferenceItem;

export interface LibraryCollection {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryItemVersion {
  id: string;
  workspaceId: string;
  itemId: string;
  versionNo: number;
  snapshot: LibraryItemRecord;
  changeSummary: string | null;
  createdAt: Date;
  createdBy: LibraryActor;
}
```

### 2. Storage Rules

- 모든 entity는 workspace-scoped identity를 가진다.
- 바이너리는 MVP에서 workspace DB에 직접 저장한다.
- 기본 파일 크기 제한은 25MB/item으로 둔다.
- template payload는 live canonical object reference가 아니라 reusable snapshot/instantiation payload로 저장한다.
- existing canonical persistence의 workspace boundary, auditability, explicit error 원칙을 따른다.
- 외부 clipboard/file import에서 생성된 asset도 동일한 `LibraryItemRecord` 저장 경로를 사용한다.
- 단, 탐색기 노출 수준은 `visibility = imported | curated`로 구분해 임시 유입 asset이 메인 라이브러리를 오염시키지 않게 한다.
- DB schema와 transport DTO는 `LibraryItemRecord` 기준으로 정렬한다.
- 앱 내부 service/domain 로직은 `LibraryItemRecord`를 바로 쓰지 않고 `toTemplateItem`, `toAssetItem`, `toReferenceItem` 같은 decoder/validator를 거쳐 좁혀진 타입으로 사용한다.
- `LibraryItemType`은 item 자체가 아니라 `LibraryItem` 유니온을 식별하는 discriminator로 사용한다.

## Apply Semantics

- `template`
  - 현재 canvas에 clone/instantiate 한다.
  - apply 이후 편집은 원본 library item에 영향을 주지 않는다.
  - note-like body content도 shared object reuse 없이 새 instance로 materialize 한다.
- `asset`
  - 현재 canvas context에 따라 insert 또는 attach 한다.
  - 삽입 대상이 명확하지 않으면 사용자는 target selection을 요구받는다.
  - 외부 클립보드 이미지 paste는 `asset import -> canvas placement`의 복합 동작으로 처리한다.
  - paste로 생성된 asset은 저장 자체는 항상 수행하되, 기본 노출은 curated grid가 아니라 `recent/imported` 흐름에 둔다.
  - 사용자가 명시적으로 저장, 태그, 컬렉션 추가를 수행하면 imported asset은 curated asset으로 승격된다.
- `reference`
  - URL, canvas, object, future extensible target으로 연결된다.
  - missing target은 placeholder success가 아니라 명시적 error 상태로 처리한다.

## App Boundary

Explorer Library는 앱 내부 사람 중심 기능으로 제공한다.

- 앱은 library item의 저장, 탐색, 미리보기, 적용을 직접 제공한다.
- AI assistant, MCP resource, prompt runtime 같은 직접 AI surface는 제공하지 않는다.
- reference는 사람이 다시 열고 연결하고 재사용하는 자료 단위로 다룬다.

## Technical Notes

### Public Interfaces To Lock In The PRD

#### MVP item type contract

- `template`
- `asset`
- `reference`

#### Service interface draft

- `listLibraryItems`
- `searchLibraryItems`
- `getLibraryItem`
- `createLibraryItemFromCanvas`
- `createLibraryItemFromSelection`
- `createLibraryAsset`
- `applyLibraryItemToCanvas`
- `listCollections`
- `updateLibraryMetadata`

### Recommended Skills

`teach-impeccable`을 제외하고, 이 PRD를 구현하거나 다듬을 때 우선적으로 맞는 스킬은 다음과 같다.

- `frontend-design`
  - 하단 패널 quick explorer와 전용 라이브러리 화면의 전체 UI를 실제 인터페이스로 구체화할 때 사용한다.
- `arrange`
  - 검색, collections rail, item grid, detail inspector의 정보구조와 레이아웃 리듬을 정리할 때 사용한다.
- `extract`
  - `item card`, `preview tile`, `collection chip`, `metadata row` 같은 반복 패턴을 컴포넌트와 토큰으로 정리할 때 사용한다.
- `adapt`
  - 하단 패널, 좁은 폭, 전용 화면, 반응형 뷰포트 대응을 설계할 때 사용한다.
- `harden`
  - oversize asset, missing reference, imported/curated 상태, empty/error/loading 상태를 단단하게 만들 때 사용한다.
- `normalize`
  - 새 Explorer가 기존 editor shell과 시각적/구조적으로 어긋나지 않게 정렬할 때 사용한다.
- `polish`
  - 구현 후 정렬, 밀도, 계층, 시각 디테일을 마감할 때 사용한다.
- `clarify`
  - `항목`, `템플릿`, `자산`, `참고자료`, `imported`, `curated` 같은 UX 용어를 사용자 친화적으로 다듬을 때 사용한다.
- `critique`
  - Unreal/Unity식 content browser mental model이 실제 사용자에게 자연스러운지 점검할 때 사용한다.
- `audit`
  - 접근성, 반응형, 상태 처리, 성능 관점에서 Explorer UI를 검토할 때 사용한다.

권장 사용 순서는 보통 `frontend-design -> arrange -> extract -> adapt -> harden -> normalize -> polish`이고, 필요 시 `clarify`, `critique`, `audit`를 보조적으로 붙인다.

### Architectural Notes

- 이 문서는 product-facing PRD이며 implementation detail 전체를 고정하지 않는다.
- 후속 엔지니어링 문서는 필요 시 `docs/features/explorer-library/implementation-plan.md`와 `specs/011-explorer-library/spec.md`로 분리한다.
- 구현 단계에서 엔티티 source of truth는 shared domain 경계의 TypeScript 계약 파일로 둔다.
- 모델링 전략은 "저장용 단순 record + 앱 내부 typed view"의 hybrid approach로 유지한다.
- editor shell surface로 구현되는 Explorer는 `WidgetBase`를 기본 chrome contract로 사용한다.
- 하단 배치가 현재 `WidgetBase` 계약 밖이라면, Explorer 전용 shell을 만드는 대신 shared `WidgetBase` 계약을 확장해 해결한다.
- shell integration은 중앙 shared shell branching을 늘리기보다 feature-owned contribution path를 우선한다.
- 기존 file-based image path는 compatibility reference일 뿐, Explorer Library의 primary storage contract가 아니다.
- naming과 interaction은 가능하면 `파일 열기`보다 `content 탐색/적용` 관점으로 정렬한다.
- 구현 단계에서는 FR/AC를 직접 매핑할 수 있는 implementation plan을 별도로 작성해야 한다.
- 앱은 직접적인 AI 기능을 내포하지 않으며, Explorer Library도 같은 원칙을 따른다.

## Risks

- DB direct binary storage가 workspace DB 크기 증가와 성능 저하를 유발할 수 있다.
- typed item model이 너무 느슨하면 general vault가 다시 blob dump로 퇴화할 수 있다.
- template snapshot boundary가 불명확하면 canonical object reuse와 clone semantics가 섞일 수 있다.
- 하단 패널과 전용 화면이 다른 truth를 보게 되면 사용자가 저장/적용 결과를 신뢰하지 못할 수 있다.
- reference item의 범위가 지나치게 넓으면 탐색성과 적용 의미가 흐려질 수 있다.

## Phased Rollout

### MVP

- `template`, `asset`, `reference` 저장/조회/검색
- 하단 패널 quick explorer
- 전용 라이브러리 화면
- tags + collections + recents + favorites
- template clone/instantiate
- asset DB direct storage

### v1.1

- richer preview rendering
- smarter apply target suggestions
- collection management polish

### v2.0

- optional cross-workspace import/export
- richer reference types
- advanced curation workflows
