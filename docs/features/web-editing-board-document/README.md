# Web-Native Editing Transition

## 배경

Magam은 현재 코드로 다이어그램을 작성하는 강점을 갖고 있다. 사용자는 `.tsx` 파일을 작성하고, 렌더러는 이를 캔버스로 변환하며, 일부 역방향 편집은 AST patch 기반으로 반영한다.

이 구조는 "코드가 곧 문서"인 워크플로우에는 잘 맞는다. 하지만 우리가 다음 단계에서 만들고 싶은 경험은 코드 편집이 아니라 FigJam처럼 직접 조작하는 웹 편집이다.

- 컨텍스트 툴바로 도형을 배치한다
- 마인드맵을 방향키, Enter, Tab 같은 키보드 조작으로 빠르게 확장한다
- 드래그로 이동, 재부모화, 구조 변경을 자연스럽게 수행한다
- 사용자는 코드 구조가 아니라 캔버스 구조를 직접 편집한다고 느껴야 한다

## 문제 정의

현재 bidirectional editing은 제한된 범위에서는 유효하지만, 여전히 `TSX가 source of truth`라는 전제를 벗어나지 못한다.

- 웹 직접 편집의 canonical representation까지 TSX가 맡고 있다
- 같은 캔버스 상태를 표현하는 TSX가 여러 방식으로 작성될 수 있어서 시각 조작을 안정적으로 역직렬화하기 어렵다
- 형제/자식 생성, sibling reorder, branch direction, reparent, collapse/expand 같은 구조 조작은 AST patch보다 구조화된 문서 모델이 더 적합하다

## 제품 방향

웹 편집의 canonical document는 TSX가 아니라 구조화된 board document로 본다.

- 파일 시스템 기반 워크플로우는 유지한다
- 웹 편집에서 쓰기 가능한 canonical document는 board document 하나다
- 기존 TSX 파일은 one-way import 대상으로만 지원한다
- import 이후 TSX는 read-only reference이며, board mutation 결과를 TSX에 round-trip 하지 않는다
- 새로운 확장 경로는 arbitrary TSX object embedding이 아니라 adapter/plugin 기반 widget contract로 연다

## 레이어 아키텍처

웹 네이티브 편집과 레거시 호환성을 함께 가져가려면 저장 책임을 레이어로 분리해야 한다.

### 1. Interaction Layer

- 컨텍스트 툴바, keyboard shortcut, drag/reparent, selection 같은 직접 조작 UX를 담당한다
- semantic action 또는 document mutation만 생성한다

### 2. Board Document Layer

- 웹 편집의 canonical source of truth이다
- 노드/엣지, 계층, 순서, 레이아웃, 편집 상태를 구조화된 문서로 유지한다

### 3. Persistence and Sync Layer

- board document 파일의 저장, 로드, 파일 감시, 워크스페이스 동기화를 담당한다
- 사용자와 AI는 동일한 board document 파일을 읽고 수정한다

### 4. Legacy Compatibility Layer

- 기존 TSX 파일을 읽어 board document로 변환하는 importer를 제공한다
- TSX는 이 레이어에서만 다루며, 웹 편집 결과를 다시 TSX로 쓰지 않는다

## 문서 분리 원칙

이번 기획 범위가 커져서 세부 schema contract는 메인 README에 계속 누적하지 않는다.

- 메인 README는 방향 문서와 계약 인덱스 역할을 맡는다
- 세부 schema는 `contracts/` 폴더의 개별 계약 문서에서 관리한다
- 각 계약 문서는 목적, contract surface, behavioral guarantee, out of scope를 명시한다

## Contract Set

- [`contracts/README.md`](./contracts/README.md): 계약 문서 인덱스와 공통 원칙
- [`contracts/board-document-core-contract.md`](./contracts/board-document-core-contract.md): board document top-level envelope와 core layer 계약
- [`contracts/canvas-surface-contract.md`](./contracts/canvas-surface-contract.md): Canvas surface 계약
- [`contracts/mindmap-container-contract.md`](./contracts/mindmap-container-contract.md): MindMap container 계약
- [`contracts/node-taxonomy-contract.md`](./contracts/node-taxonomy-contract.md): Sticker, Sticky note를 포함한 canonical node taxonomy 계약
- [`contracts/edge-connection-contract.md`](./contracts/edge-connection-contract.md): edge, port, implicit hierarchy edge 계약
- [`contracts/frame-group-contract.md`](./contracts/frame-group-contract.md): frame/group 구분과 persisted contract
- [`contracts/markdown-wysiwyg-contract.md`](./contracts/markdown-wysiwyg-contract.md): markdown source와 WYSIWYG 편집 계약
- [`contracts/media-asset-contract.md`](./contracts/media-asset-contract.md): image, markdown image, workspace asset reference 계약
- [`contracts/source-provenance-contract.md`](./contracts/source-provenance-contract.md): sourceMeta, frameScope, edit-routing provenance 계약
- [`contracts/workspace-contract.md`](./contracts/workspace-contract.md): workspace, file tree, tabs, quick open, search 계약
- [`contracts/markdown-link-contract.md`](./contracts/markdown-link-contract.md): markdown 기반 내부 링크 계약
- [`contracts/adapter-widget-contract.md`](./contracts/adapter-widget-contract.md): adapter-backed widget node 계약
- [`contracts/plugin-registry-contract.md`](./contracts/plugin-registry-contract.md): plugin/adapter registry와 capability 계약
- [`contracts/storage-model-comparison.md`](./contracts/storage-model-comparison.md): 단일 DB 파일과 sharded JSON files 비교 및 선택 기준

## 이번 단계 범위

이번 기획 단계에서 아래 기능은 schema 관점에서 고려하고 계약을 고정한다.

- 스티커
- 와시테이프
- 마인드맵
- 캔버스
- 도형 / 텍스트 / 이미지
- 엣지 / 포트
- 프레임
- 그룹
- 스티키노트
- 시퀀스 다이어그램
- 마크다운 및 WYSIWYG
- 에셋 / 미디어 레퍼런스
- source provenance / edit routing metadata
- 어댑터 / 플러그인 기반 위젯
- 워크스페이스
- 마크다운 기반 링크

이번 단계에서 고려하지 않아도 되는 기능:

- AI 채팅

## 목표

- FigJam 스타일의 웹 편집을 제품 레벨에서 정의한다
- direct manipulation 결과를 AST patch가 아니라 문서 mutation으로 저장하는 방향을 연다
- 기존 Canvas/MindMap mental model을 유지하면서도 확장 가능한 board schema를 설계한다
- 기존 TSX 중심 워크플로우를 즉시 제거하지 않고, one-way import 기반 전환 경로를 마련한다
- 외부 차트/그래프/커스텀 시각화는 adapter/plugin 기반 widget 경로로 수용한다

## 비목표

- 웹 편집 결과를 TSX로 다시 쓰는 round-trip을 v1 범위에 넣지 않는다
- AI 채팅 스펙을 이번 schema 설계에 포함하지 않는다
- arbitrary TSX 컴포넌트를 웹 편집의 editable native object 모델로 채택하지 않는다
- 협업 CRDT/OT 설계를 이번 문서에서 확정하지 않는다
- 마이그레이션 세부 일정까지 지금 고정하지 않는다

## 다음 기획 단계 질문

- board document 파일 확장자와 workspace registry 규칙을 어떻게 정할 것인가
- canonical storage를 단일 DB 파일로 둘지, sharded JSON files로 둘지 어떤 기준으로 확정할 것인가
- frame을 editor에서 직접 생성 가능한 persisted object로 열지, 우선 import/provenance container로만 둘 것인가
- markdown link의 cross-file navigation을 v1에 포함할 것인가
- 시퀀스 다이어그램을 독립 container로 볼지, structured node family로 볼지
- adapter widget이 허용하는 serialized props/data contract를 어디까지 표준화할 것인가
- plugin registry의 trust/security boundary를 어떻게 정의할 것인가
- Canvas/MindMap 외의 추가 container family를 언제 열 것인가

## 정리

버려야 하는 것은 파일 시스템 기반 철학이 아니다. 버려야 하는 것은 TSX를 웹 직접 편집의 canonical document로 유지하려는 가정이다.

이제 메인 README는 방향 문서로 유지하고, 실제 schema 결정은 `contracts/` 아래 문서들에서 영역별로 고정한다.
