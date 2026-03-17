# Contract: Canvas Surface

## 목적

기존 `Canvas` 개념을 board document 안에서 영속적인 surface contract로 정의한다.

## Contract Surface

`surfaces.primaryCanvasId`는 기본 scene root를 가리킨다.

`surfaces.canvases[canvasId]`는 아래 필드를 가진다.

- `id`: string
- `title?`: string
- `background?`: `'dots' | 'lines' | 'solid' | custom background object`
- `fontFamily?`: font preset
- `viewportPreset?`: `{ x: number, y: number, zoom: number }`
- `containerIds`: string[]
- `standaloneNodeIds`: string[]
- `layerOrder?`: string[]
- `extensions?`: object

## Semantics

- Canvas는 board의 scene root다
- 하나의 문서는 최소 1개의 canvas를 가져야 한다
- 같은 canvas 위에 여러 typed container와 standalone node가 함께 공존할 수 있어야 한다
- `standaloneNodeIds`에는 특정 container에 속하지 않는 node만 들어간다

## Behavioral Guarantees

- Canvas background와 canvas font family는 문서 재오픈 후에도 유지되어야 한다
- viewport preset은 document-level remembered view로 저장할 수 있지만, transient pan/zoom 작업 중간 상태를 강제로 저장할 필요는 없다
- Canvas membership은 구조 정보가 아니라 scene placement 정보다
- Canvas는 direct manipulation의 scene root이지만 semantic hierarchy의 root일 필요는 없다

## Legacy Mapping

- TSX `<Canvas background=... fontFamily=...>`는 canvas surface metadata로 import 된다
- 현재 `extractCanvasMeta()`가 따로 처리하는 background/font metadata는 새 schema에서는 canvas object에 직접 저장된다

## Out of Scope

- multi-canvas UI를 이번 단계에서 확정하는 일
- cross-canvas edge UX
