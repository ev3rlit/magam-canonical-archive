# Contract: Workspace

## 목적

board document가 놓이는 workspace와 editor-level file contract를 정의한다.

## Scope

workspace contract는 per-board document schema와 별개로, editor shell이 어떤 파일과 상태를 다뤄야 하는지 정의한다.

## Workspace File Families

- `board document`: 웹 편집의 canonical 파일
- `legacy TSX`: one-way import 대상인 read-only reference 파일
- `workspace asset`: image 등 media asset 파일

## Workspace Registry Contract

workspace는 아래 수준의 정보를 안정적으로 제공해야 한다.

- file tree
- open tabs
- quick open index
- search index
- current document path
- source version map

## Behavioral Guarantees

- workspace explorer는 board document와 legacy TSX를 함께 표시할 수 있어야 한다
- board document는 editable로, legacy TSX는 read-only/importable로 구분되어야 한다
- tabs, quick open, search는 workspace-relative path를 기준으로 동작해야 한다
- file sync는 file-level version을 추적할 수 있어야 한다
- 동일 workspace 안에서 asset path 해석이 안정적이어야 한다

## Recommended Document Metadata

editor shell은 문서 메타를 최소 아래 수준으로 다룰 수 있어야 한다.

- `path`
- `kind`
- `title`
- `readOnly`
- `importSourcePath?`
- `sourceVersion`

## Relationship to Current Codebase

현재 구현은 `files`, `fileTree`, `openTabs`, `sourceVersions`, quick open, global/page search를 이미 가진다. 새 schema에서는 이 editor-level contract를 board document 중심으로 재정렬해야 한다.

## Explicit Exclusion

- AI chat session/group/provider schema는 이번 workspace contract에 포함하지 않는다

## Out of Scope

- remote collaborative workspace permission model
- chat persistence
