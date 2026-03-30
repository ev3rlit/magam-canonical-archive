# Canonical Object Persistence

## 개요

이 slice는 `database-first-canvas-platform`의 첫 구현 단위다.

여기서 `canonical`은 시스템이 저장, 검증, query, mutation의 **정식 기준**으로 삼는 내부 표준 형태를 뜻한다. `Node`, `Shape`, `Sticky`, `Image` 같은 public alias는 작성 편의용 표면이고, 실제 persistence는 그 alias를 canonical object shape로 정규화한 뒤 저장한다.

목표는 native object canonical model을 데이터베이스에 안정적으로 저장할 수 있는 최소 persistence contract를 고정하는 것이다.

기준 선택:

- ORM: `Drizzle ORM`
- local/embedded path: `PGlite`
- production path: PostgreSQL/pgvector 호환 구성

## 왜 먼저 하는가

- 이후 mutation/query core가 의존할 저장 shape를 먼저 고정해야 한다.
- `object-capability-composition`에서 합의한 canonical object 모델을 실제 DB contract로 내릴 첫 단계다.
- canvas, CLI, plugin이 모두 같은 canonical persistence contract를 공유해야 한다.

## 범위

- `objects` 저장 모델 정의
- `object_relations` 저장 모델 정의
- `documents`, `document_revisions`, `canvas_nodes`, `canvas_bindings`와의 최소 저장 경계 정리
- `semantic_role`, `primary_content_kind`, `content_blocks`, `source_meta`, `capabilities`, `capability_sources`, `canonical_text`, `extensions` 저장 방식 고정
- Drizzle schema와 migration 초안
- local `PGlite` bootstrap에서 동작하는 persistence smoke path
- canonical object row <-> application entity mapper/repository 경계 정의
- editable note-like object의 copy-on-create 기본 규칙 고정

## 비범위

- canonical object patch/query service 구현
- AI/CLI command surface 구현
- app-attached session 명령
- plugin runtime sandbox
- legacy TSX import/migration tool 완성
- block-level mutation verb 이름과 transport shape 확정

## 핵심 계약

### Objects

- public alias는 persistence base type이 아니다.
- canonical object는 최소 다음 축을 가진다.
  - `semantic_role`
  - `primary_content_kind`
  - `content_blocks`
  - `source_meta`
  - `capabilities`
  - `capability_sources`
  - `canonical_text`
  - `extensions`

### Note Body Content

- 기존 선언형 `Node`, `Sticky`가 가질 수 있었던 ordered text/markdown body는 database-first에서도 필수적으로 보존해야 한다.
- 다만 `content_blocks`는 장기적으로 Notion 같은 block container가 될 수 있어야 하며, 하나의 노드 안에 text/markdown 외 구조화된 custom block도 담을 수 있어야 한다.
- 이 본문은 canonical object 내부의 `content_blocks`가 소유한다. `canvas_nodes.props`나 renderer-local state가 canonical truth가 되면 안 된다.
- 각 block은 stable id와 순서를 가진다.
- v1 core block은 `text`, `markdown`을 기본 지원한다.
- 확장 block은 namespaced `block_type`과 structured payload를 통해 저장할 수 있어야 한다. 예: `core.callout`, `plugin.table`, `custom.form-field`.
- direct leaf content가 필요한 alias(`Markdown`, `Image`, `Sequence`)는 기존처럼 `capabilities.content`를 사용할 수 있지만, note-like body의 주 저장 경로는 `content_blocks`다.
- `primary_content_kind`는 direct `capabilities.content.kind`가 있으면 그 값을 따르고, `content_blocks`만 있으면 built-in `markdown` block이 하나라도 있을 때 `markdown`, built-in `text` block만 있을 때 `text`, custom block만 있을 때는 `NULL`을 허용한다.
- `canonical_text`는 `content_blocks` 순서를 따라 flatten한 결과를 저장하며, custom block은 선택적 `textual_projection`으로 검색/embedding 텍스트에 기여할 수 있어야 한다.
- 새 note-like object 생성 시 initial block이 없으면 빈 `text` block 하나로 seed해야 한다.
- editable note-like object는 기본적으로 shared reference가 아니라 copy-on-create semantics를 가진다.
- editable note shared-template/shared canonical note reuse는 현재 slice에서 스펙 오프하고 backlog 후보로 남긴다.

### Canvas Boundary

- native object의 semantic/content/capability payload는 `objects`가 소유한다.
- native object의 ordered note body(`content_blocks`)도 `objects`가 소유한다.
- `canvas_nodes`는 placement/composition만 소유한다.
- `canvas_nodes.props`는 canvas-local display props 또는 renderer/plugin view props만 담는다.

### Storage Compatibility

- local `PGlite`와 production PostgreSQL이 같은 Drizzle schema contract를 가능한 한 공유해야 한다.
- vector path는 PostgreSQL/pgvector 우선으로 설계하되, local path와의 호환 전략을 문서화해야 한다.

## 선행 문서

- `docs/features/database-first-canvas-platform/README.md`
- `docs/features/database-first-canvas-platform/entity-modeling.md`
- `docs/features/database-first-canvas-platform/schema-modeling.md`
- `docs/features/object-capability-composition/README.md`

## 다음 slice에 넘겨야 할 것

- canonical object row shape
- note-like `content_blocks` value shape와 seed rule
- relation/binding/canvas ownership boundary
- clone-vs-share ownership rule
- repository/bootstrap boundary
- migration baseline

## 완료 기준

- local `PGlite`에서 Drizzle migration이 적용된다.
- canonical object를 alias 전용 테이블 없이 저장할 수 있다.
- `Sticky`, `Image`, `Markdown`, `Sequence` 계열 object를 canonical row shape로 수용할 수 있다.
- `Node`와 `Sticky`의 mixed text/markdown body가 block 순서 손실 없이 canonical row shape로 round-trip 된다.
- 새 editable note-like node 생성 시 canonical object에 기본 empty text block이 seed된다.
- note-like object를 다른 document에 배치/복제할 때 기본 동작이 shared mutation이 아니라 cloned canonical object 생성으로 고정된다.
- `objects`와 `canvas_nodes`의 책임이 문서와 스키마에서 충돌하지 않는다.
