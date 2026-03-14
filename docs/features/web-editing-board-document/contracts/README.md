# Contract Set: Web Editing Board Document

## 목적

웹 네이티브 편집 전환에 필요한 schema contract를 영역별로 분리해 관리한다.

이 폴더의 문서는 다음 역할을 가진다.

- board document의 canonical 저장 계약을 정의한다
- 기존 TSX import와 레거시 호환 경계를 명시한다
- Canvas, MindMap, Sticker, Sticky note, frame, group, markdown, workspace, link 같은 개념의 책임을 분리한다

## 공통 원칙

- 웹 편집의 canonical source of truth는 board document다
- 기존 TSX 파일은 one-way import 대상이며 read-only reference다
- 파일 시스템 기반 워크플로우는 유지한다
- schema는 normalized storage를 기본으로 한다
- runtime-only state는 저장 문서에 넣지 않는다
- schema evolution은 additive change를 기본으로 하고 breaking change는 `schemaVersion`으로 관리한다
- core consumer가 이해하지 못하는 extension payload는 보존해야 한다

## 문서 목록

- [`board-document-core-contract.md`](./board-document-core-contract.md)
- [`canvas-surface-contract.md`](./canvas-surface-contract.md)
- [`mindmap-container-contract.md`](./mindmap-container-contract.md)
- [`node-taxonomy-contract.md`](./node-taxonomy-contract.md)
- [`edge-connection-contract.md`](./edge-connection-contract.md)
- [`frame-group-contract.md`](./frame-group-contract.md)
- [`markdown-wysiwyg-contract.md`](./markdown-wysiwyg-contract.md)
- [`media-asset-contract.md`](./media-asset-contract.md)
- [`source-provenance-contract.md`](./source-provenance-contract.md)
- [`workspace-contract.md`](./workspace-contract.md)
- [`markdown-link-contract.md`](./markdown-link-contract.md)
- [`adapter-widget-contract.md`](./adapter-widget-contract.md)
- [`plugin-registry-contract.md`](./plugin-registry-contract.md)
- [`storage-model-comparison.md`](./storage-model-comparison.md)

## 이번 단계 포함 범위

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

## 이번 단계 제외 범위

- AI 채팅
