# Contract: Source Provenance and Edit Routing

## 목적

legacy TSX import 이후에도 rendered object가 어떤 source file과 local source id에서 왔는지 복원할 수 있도록 provenance 계약을 정의한다.

## Contract Surface

node 또는 edge는 optional provenance metadata를 가질 수 있다.

### Recommended Provenance Fields

- `sourceId`: local source identifier
- `renderedId?`: rendered scoped identifier
- `filePath?`: source file path
- `kind`: `'canvas' | 'mindmap' | 'board-document' | 'imported-legacy'`
- `scopeId?`: owning container or mindmap scope
- `frameScope?`: frame-local scope string
- `framePath?`: string[]

## Semantics

- `sourceId`는 실제 write-back/import trace의 기준 id다
- `renderedId`는 runtime render tree에서 노출되는 fully-qualified id다
- `filePath`는 source file provenance다
- `frameScope`와 `framePath`는 nested frame에서 local id를 복원하기 위한 edit-routing metadata다

## Behavioral Guarantees

- rendered scoped id만으로 source local id를 복원할 수 있어야 한다
- cross-file imported subtree도 원본 file provenance를 잃지 않아야 한다
- board document-native object와 imported legacy object를 provenance에서 구분할 수 있어야 한다
- editor mutation은 rendered id가 아니라 canonical edit target id를 기준으로 실행할 수 있어야 한다

## Relationship to Current Codebase

- 현재 `sourceMeta`, `frameScope`, `framePath`, `filePath`가 parser와 edit-routing 유틸에 이미 존재한다
- nested frame 편집은 rendered id를 local source id로 다시 축소하는 규칙에 의존한다

## Out of Scope

- full audit log history
- per-user authorship metadata
