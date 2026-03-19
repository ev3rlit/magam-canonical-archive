# R1-P0 Workspace Document Canvas Authoring Convergence

## 개요

FigJam, Freeform, Miro, Excalidraw가 제공하는 기본 authoring 완성도를 benchmark baseline으로 삼아 `workspace -> document -> canvas -> object editing` core loop를 beta 수준으로 수렴시킨다.

## 왜 이 마일스톤인가

현재 roadmap은 external agent와 proposal flow가 선명하지만, 사용자가 매일 직접 만지는 core authoring 완성도를 별도 `P0` 번들로 관리하지 않고 있다. 이 축이 약하면 DB-first와 AI orchestration 방향도 제품이 아니라 demo처럼 보인다. 따라서 R1에서는 agent surface보다 먼저, 또는 최소한 같은 우선순위로 core authoring baseline을 닫아야 한다.

## 범위

- workspace shell에서 document create/open/switch/save 흐름 정리
- canonical DB 기준 document lifecycle을 primary UX로 고정
- empty canvas에서 첫 object를 만들고 selection, move, duplicate, delete를 수행하는 기본 동선 정리
- object quick style / content edit를 primary flow로 노출
- canvas toolbar, selection floating action, context menu의 고빈도 조작 경로 정리
- desktop과 mobile이 같은 editing truth를 공유하도록 핵심 편집 동선 정렬

## 비범위

- realtime collaboration
- facilitation template, voting, timer 같은 whiteboard 확장 기능
- plugin marketplace
- desktop/mobile 완전 동일 UI 강제

## 핵심 결정 / 계약

- benchmark는 UI 모사가 아니라 core authoring completeness 기준선으로만 사용한다.
- magam의 차별점은 canonical DB, object-local block body, external proposal flow이며, 이 차별점은 기본 편집이 충분히 매끄러운 상태에서 드러나야 한다.
- workspace, document, canvas, object editing은 따로 놀지 않고 하나의 core loop로 관리한다.
- mobile은 desktop 축소판이 아니지만, 같은 canonical document editing truth를 사용해야 한다.
- AI surface는 이 core authoring loop를 대체하지 않고 그 위에 올라간다.

## 의존성

- `../R1-P0-canonical-app-convergence/README.md`
- `../R1-P0-mobile-full-editing-shell/README.md`
- `docs/features/database-first-canvas-platform/README.md`
- `docs/features/database-first-canvas-platform/canvas-ui-entrypoints/README.md`
- `docs/features/canvas-editing/README.md`

## 완료 기준

- workspace에서 document create/open/switch가 primary path로 자연스럽게 연결된다.
- empty canvas에서 first object create 후 selection, move, duplicate, delete가 끊기지 않는다.
- object quick style / content edit가 숨은 보조 기능이 아니라 기본 흐름으로 보인다.
- desktop과 mobile 모두에서 canonical document editing path가 같은 제품 원칙으로 설명된다.
- FigJam, Freeform, Miro, Excalidraw와 비교했을 때 core authoring의 큰 빈 구멍이 더 이상 `P0` blocker로 남지 않는다.
