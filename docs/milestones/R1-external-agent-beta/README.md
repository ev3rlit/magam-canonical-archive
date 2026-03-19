# R1 External Agent Beta

## 개요

- Target Date: `2026-04-16`
- 기준 문서: `docs/milestones/README.md`, `docs/reports/magam-completion-architecture-roadmap/README.md`
- 이 마일스톤은 R0를 single-path demo가 아니라 반복 사용 가능한 beta로 만들고, core authoring 완성도를 제품 중심에 다시 고정한다.

## 목표

- FigJam, Freeform, Miro, Excalidraw를 benchmark baseline으로 삼아 workspace/document/canvas/object editing core loop를 beta 수준으로 끌어올린다.
- 앱 내부 AI chat 없이 external proposal console을 제품의 주 AI surface로 올린다.
- mobile full editing shell과 host reliability를 함께 끌어올린다.
- canonical DB path를 실제 앱의 기본 경로로 수렴시킨다.

## 포함 피쳐

| Priority | Folder | Goal |
| --- | --- | --- |
| `P0` | `R1-P0-workspace-document-canvas-authoring-convergence` | workspace/document/canvas/object editing core loop를 benchmark baseline으로 수렴시킨다 |
| `P0` | `R1-P0-external-proposal-console` | proposal review/approval 중심의 AI surface를 만든다 |
| `P0` | `R1-P0-host-reliability-and-queue` | reconnect, queue, resume를 넣는다 |
| `P0` | `R1-P0-mobile-full-editing-shell` | mobile full editing shell을 정리한다 |
| `P0` | `R1-P0-canonical-app-convergence` | DB-backed open/save를 앱의 기본 path로 고정한다 |
| `P0` | `R1-P0-in-app-ai-chat-removal` | 기존 chat/session 진입점을 제거한다 |
| `P1` | `R1-P1-composable-block-body-v1` | object 내부 mixed block body v1을 연다 |
| `P1` | `R1-P1-universal-command-surface-minimum` | search/quick open/external handoff entry를 통합한다 |

## 완료 기준

- workspace에서 document create/open/switch가 primary UX로 자연스럽다.
- canvas에서 first object create 이후 selection, move, delete, quick edit 기본 흐름이 끊기지 않는다.
- 사용자가 외부에서도 mobile share로 작업을 던질 수 있다.
- desktop과 mobile에서 같은 proposal을 검토할 수 있다.
- 앱 내부에 AI chat/session 진입점이 없다.
- external proposal surface가 실제 작업 큐를 가진다.
- mobile에서 full canvas editing이 가능하다.
- object 내부에서 text/markdown/chart/table block을 함께 편집할 수 있다.

## 이번 마일스톤에서 하지 않는 것

- plugin runtime production hardening 전체
- realtime collaboration
- marketplace
- enterprise permission matrix
