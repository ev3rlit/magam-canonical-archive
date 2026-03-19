# Milestones

이 폴더는 [로드맵 문서](/Users/danghamo/Documents/gituhb/magam-feature-database-first-canvas-platform/docs/reports/magam-completion-architecture-roadmap/README.md)를 마일스톤 단위로 분해한 문서 트리다.

- 기준 문서: `docs/reports/magam-completion-architecture-roadmap/README.md`
- 각 마일스톤은 release-oriented 묶음이다.
- 각 피쳐 폴더는 구현 task가 아니라 roadmap bundle 단위다.

## 우선순위

| 우선순위 | 의미 |
| --- | --- |
| `P0` | 해당 마일스톤의 핵심 경로를 여는 필수 피쳐 |
| `P1` | 마일스톤 품질과 차별성을 강화하는 중요 피쳐 |
| `P2` | 후속 확장 또는 backlog 성격이 강한 피쳐 |

## 현재 최우선 관리 축

- FigJam, Freeform, Miro, Excalidraw를 benchmark baseline으로 삼아 `workspace -> document -> canvas -> object editing` core loop 완성도를 최우선으로 관리한다.
- external proposal, host reliability, share/review 같은 후속 surface도 이 core authoring baseline을 강화하거나 그 위에서 닫히는 경우에만 `P0`로 취급한다.

## 마일스톤 목록

| Code | Target Date | Status | Goal | Folder |
| --- | --- | --- | --- | --- |
| `R0` | `2026-03-26` | Proposed | mobile/web share에서 personal agent host를 호출하고 proposal 승인까지 닫는다 | `docs/milestones/R0-agent-handoff-v0/` |
| `R1` | `2026-04-16` | Proposed | workspace/document/canvas/object core authoring convergence를 최우선으로 끌어올리고 external proposal beta 기반을 묶는다 | `docs/milestones/R1-external-agent-beta/` |
| `R2` | `2026-05-14` | Proposed | R1에서 연 core authoring baseline을 1.0 품질로 polish하고 share/review, plugin minimum, export reliability를 완성한다 | `docs/milestones/R2-magam-1-0-fast-path/` |
| `R3` | `post-1.0` | Backlog | presence-lite, realtime pilot, legacy TSX migration tooling을 후속 버전으로 분리한다 | `docs/milestones/R3-1-1-collaboration-expansion/` |
