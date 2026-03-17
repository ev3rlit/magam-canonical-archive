# Contract: Frame and Group

## 목적

현재 코드베이스에서 서로 다른 책임을 가진 `frame`과 `group`을 schema에서 분리해 정의한다.

## Distinction

- `frame`: 재사용 가능한 구성 단위이자 provenance/edit-routing boundary
- `group`: 공간적 containment와 공동 이동을 위한 visual container

둘은 같은 개념이 아니며, 같은 collection으로 합치지 않는다.

## Frame Contract

`containers.frames[frameId]`는 아래 필드를 가진다.

- `id`: string
- `surfaceId`: string
- `memberNodeIds`: string[]
- `childFrameIds?`: string[]
- `mount?`: object
- `source?`: object
- `extensions?`: object

`source` contract:

- `filePath?`: string
- `frameScope?`: string
- `framePath?`: string[]
- `importedFrom?`: string

## Frame Semantics

- frame은 reusable composition instance를 나타낸다
- nested frame을 허용한다
- frame membership은 semantic structure보다 provenance와 edit routing에 더 가깝다
- frame scope 정보는 legacy import와 explicit re-import 판단에 사용된다

## Group Contract

`containers.groups[groupId]`는 아래 필드를 가진다.

- `id`: string
- `surfaceId`: string
- `memberNodeIds`: string[]
- `boundsMode?`: `'auto' | 'manual'`
- `placement?`: object
- `extensions?`: object

## Group Semantics

- group은 visual/spatial containment를 나타낸다
- group membership은 React Flow의 `parentId`/`extent='parent'`와 같은 renderer-specific 구현 세부를 직접 저장하지 않는다
- group의 bounds와 clipping/selection behavior는 presentation/runtime에서 해석할 수 있어야 한다

## Legacy Mapping

- `frame(...)`는 더 이상 단순 helper로만 남지 않고, import 이후에는 frame container provenance로 보존되어야 한다
- low-level `Group`은 group container로 import 된다
- 현재 `sourceMeta.frameScope`, `sourceMeta.framePath`, `sourceMeta.filePath`는 frame contract의 근거 필드다

## Behavioral Guarantees

- frame edit target resolution은 rendered scoped id가 아니라 local source id로 복원 가능해야 한다
- group 이동은 member node의 상대 배치를 보존해야 한다
- frame과 group은 동시에 같은 node를 참조할 수 있지만, 의미는 분리되어야 한다

## Out of Scope

- frame authoring UI를 이번 단계에서 확정하는 일
- group clipping renderer 세부 구현
