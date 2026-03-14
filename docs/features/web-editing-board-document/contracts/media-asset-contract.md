# Contract: Media and Asset Reference

## 목적

image node와 markdown/image embed가 workspace asset을 어떻게 참조하는지 정의한다.

## Contract Surface

media reference는 canonical persisted value로 원본 경로를 보존한다.

### Image Node

`nodeKind === 'image'`인 node는 최소 아래 필드를 가진다.

- `content.kind`: `'media'`
- `content.src`: string
- `content.alt?`: string
- `content.fit?`: `'cover' | 'contain' | 'fill' | 'none' | 'scale-down'`
- `content.width?`: number
- `content.height?`: number

### Markdown Embedded Image

markdown source 안의 `![alt](path)`는 markdown source 자체에 보존한다.

## Asset Path Rules

- canonical 저장값은 workspace-relative path 또는 explicit external URL이다
- runtime에서 `/api/assets/file` 같은 서빙 URL로 변환하더라도 저장 문서는 원본 asset reference를 유지한다
- current document path를 기준으로 relative asset 해석이 가능해야 한다

## Asset Families

- workspace local asset
- imported local asset copied into workspace
- external URL asset
- data URI asset

## Behavioral Guarantees

- asset reference는 document reopen 후에도 안정적으로 재해석되어야 한다
- image node와 markdown image는 같은 path resolution rule을 공유해야 한다
- asset 업로드/복사 과정은 canonical reference를 덮어쓰기보다 provenance를 남기는 쪽이 바람직하다
- broken asset reference는 문서 로드를 실패시키지 않고 degraded render로 처리해야 한다

## Relationship to Current Codebase

- `Image` component는 dedicated image node를 만든다
- markdown renderer도 image src를 workspace asset API로 resolve 한다
- workspace asset API는 현재 editor/runtime 경로로 이미 존재한다

## Out of Scope

- binary blob storage format
- remote CDN sync policy
