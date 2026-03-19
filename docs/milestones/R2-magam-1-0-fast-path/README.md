# R2 magam 1.0 Fast Path

## 개요

- Target Date: `2026-05-14`
- 기준 문서: `docs/milestones/README.md`, `docs/reports/magam-completion-architecture-roadmap/README.md`
- 이 마일스톤은 R1에서 연 core authoring baseline과 primary flow를 제품 품질까지 끌어올리는 첫 완성 버전이다.

## 목표

- R1에서 연 workspace/document/canvas/object core authoring baseline을 1.0 수준으로 polish한다.
- external proposal flow를 안정적 운영 도구로 만든다.
- desktop/mobile editing UX를 1.0 수준으로 정리한다.
- share/review, plugin minimum, import/export reliability를 완성한다.

## 포함 피쳐

| Priority | Folder | Goal |
| --- | --- | --- |
| `P0` | `R2-P0-revision-and-approval-backbone-hardening` | revision, audit, rollback, compare를 단단히 만든다 |
| `P0` | `R2-P0-desktop-authoring-ux-convergence` | desktop authoring shell을 정리한다 |
| `P0` | `R2-P0-mobile-full-editing-polish` | mobile full editing ergonomics를 polish한다 |
| `P0` | `R2-P0-share-and-review-links` | read-only/review 링크를 연다 |
| `P0` | `R2-P0-plugin-runtime-productization-minimum` | chart/table 중심 plugin minimum을 완성한다 |
| `P0` | `R2-P0-import-and-export-reliability` | JSON/PNG/SVG/document export-import를 안정화한다 |
| `P1` | `R2-P1-composable-block-body-v2` | block body UX를 1.0 수준으로 다듬는다 |

## 완료 기준

- BYO Agent Runtime이 stable하다.
- mobile share -> host execution -> proposal -> approval -> revision 흐름이 안정적이다.
- canonical DB path가 primary UX로 완전히 보인다.
- external proposal console이 실제 운영 도구 역할을 한다.
- shape-local composable block editing이 제품 핵심 경험으로 보인다.
- 최소 2종 widget이 production 수준으로 동작한다.

## 이번 마일스톤에서 하지 않는 것

- realtime presence/follow
- plugin marketplace
- legacy TSX migration tooling 완성
- enterprise-grade permission matrix
