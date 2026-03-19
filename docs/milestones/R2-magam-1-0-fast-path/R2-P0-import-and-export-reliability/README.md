# R2-P0 Import and Export Reliability

## 개요

JSON, PNG, SVG, document export-import를 안정화해 canonical DB 기반 문서를 안전하게 가져오고 내보낼 수 있게 한다.

## 왜 이 마일스톤인가

1.0에서는 canonical truth를 유지하면서도 실제 문서를 이동, 백업, 공유할 수 있어야 한다.

## 범위

- JSON export/import
- PNG export
- SVG export
- document export

## 비범위

- legacy TSX migration tooling 전체
- marketplace package distribution
- file-first canonical path 복귀

## 핵심 결정 / 계약

- export는 projection이고 canonical DB가 truth다.
- import/export는 shape-local block body와 plugin 최소 경로를 잃지 않아야 한다.
- 외부 AI 입력 경로와 독립적으로 동작해야 한다.

## 의존성

- `R2-P0-plugin-runtime-productization-minimum/README.md`
- `R2-P1-composable-block-body-v2/README.md`

## 완료 기준

- JSON/PNG/SVG/document export-import가 안정적이다.
- object-local block body와 widget 최소 경로가 손실 없이 보존된다.
- canonical truth와 projection의 경계가 유지된다.
