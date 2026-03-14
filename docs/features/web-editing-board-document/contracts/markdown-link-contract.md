# Contract: Markdown Link

## 목적

markdown 안에서 사용하는 내부 링크의 canonical scheme과 navigation behavior를 정의한다.

## Canonical Scheme

내부 링크는 `node:/` scheme을 사용한다.

지원 경로 형식:

- `node:/nodeId`
- `node:/containerId/nodeId`
- `node:/workspacePath/containerId/nodeId`

## Semantics

- `node:/nodeId`: 현재 문서에서 stable node id로 직접 이동
- `node:/containerId/nodeId`: 현재 문서에서 container-scoped reference로 이동
- `node:/workspacePath/containerId/nodeId`: cross-file navigation을 위한 확장 경로

## Resolution Rules

- renderer는 markdown source에 적힌 링크를 그대로 보존해야 한다
- same-document link는 node selection + viewport center 이동으로 해석한다
- cross-file path가 포함된 경우 target document를 연 뒤 node navigation을 수행할 수 있어야 한다
- unresolved link는 앱을 깨뜨리지 않고 안전하게 실패해야 한다

## Legacy Compatibility

- 현재 구현이 사실상 `node:/mindmapId/nodeId`를 사용하므로, 이 형식은 새 contract에서도 `node:/containerId/nodeId`로 계속 유효하다
- 현재 `NavigationContext`가 future path를 위해 마지막 두 segment fallback을 허용하는 점은 하위 호환 입력으로 간주한다

## Relationship to Components

- markdown inline link가 primary consumer다
- core의 `<Link>` component도 동일한 `node:/` contract에 맞춰야 한다
- board document 저장 포맷은 별도 link AST를 만들지 않고 markdown source 안의 URI를 canonical form으로 유지한다

## Behavioral Guarantees

- 내부 링크 클릭은 외부 새 창이 아니라 editor navigation으로 처리되어야 한다
- external `http(s)` 링크는 기존 웹 링크처럼 동작할 수 있다
- invalid internal link는 사용자 세션을 중단시키지 않는다

## Out of Scope

- anchor-to-range deep link
- comment/thread link
- AI chat message link
