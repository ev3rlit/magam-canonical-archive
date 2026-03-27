# Bottleneck File Inventory

아래 표는 코드 다이어트 후보를 도메인별로 정리한 인벤토리다. `AS-IS` 는 지금 파일이 실질적으로 하는 일, `TO-BE` 는 감량 후 기대 역할이다.

| 우선순위 | 도메인 | 파일 | 병목 유형 | AS-IS | TO-BE | 전환성 여부 |
|---|---|---|---|---|---|---|
| 1 | Canvas UI | `app/components/GraphCanvas.tsx` | 대형 파일/과잉 책임 | 캔버스 view 와 controller 가 한 파일에 섞여 있다. | view 와 controller hook 으로 나눈다. | Hybrid |
| 2 | Canvas UI | `app/features/editor/pages/CanvasEditorPage.tsx` | 중복 오케스트레이션 | 페이지 초기화와 편집 액션 orchestration 을 같이 맡는다. | 페이지는 bootstrap, 편집 제어는 controller 로 이동한다. | Hybrid |
| 3 | Canvas UI | `app/store/graph.ts` | 대형 파일/과잉 책임 | graph, workspace, overlay, text edit, optimistic state 를 함께 저장한다. | document store 와 shell/ui store 로 분리한다. | Hybrid |
| 4 | Canvas UI | `app/features/editing/actionRoutingBridge/registry.ts` | 오버엔지니어링 | intent registry 와 dispatch plan 빌더가 과밀하게 결합돼 있다. | intent metadata registry 로 축소한다. | Transitional |
| 5 | Canvas UI | `app/processes/canvas-runtime/bindings/actionDispatch.ts` | 불필요한 레이어 | registry 를 다시 만들고 envelope 를 다시 감싼다. | executor 호출 adapter 로 단순화한다. | Transitional |
| 6 | Canvas UI | `app/features/canvas-ui-entrypoints/pane-context-menu/paneMenuItems.ts` | 중복 오케스트레이션 | 생성 가능한 node 카탈로그를 직접 반복 정의한다. | shared create catalog 를 참조한다. | Transitional |
| 7 | Canvas UI | `app/features/canvas-ui-entrypoints/node-context-menu/nodeMenuItems.ts` | 중복 오케스트레이션 | child/sibling 생성 타입 목록을 별도로 복제한다. | pane/toolbar 와 동일 catalog 로 통합한다. | Transitional |
| 8 | Canvas UI | `app/components/editor/workspaceRegistry.ts` | 불필요한 레이어 | component 영역 아래에서 app-state adapter 와 migration 을 처리한다. | workspace shell feature 또는 host adapter 로 이동한다. | Transitional |
| 9 | Canvas UI | `app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.ts` | 불필요한 레이어 | 선택 메뉴용 얇은 contribution wrapper 가 남아 있다. | 실질적 확장 포인트가 생길 때까지 축소한다. | Transitional |
| 10 | Canvas UI | `app/processes/canvas-runtime/createCanvasRuntime.ts` | 오버엔지니어링 | 고정된 네 표면에 비해 slot/contribution runtime 이 상대적으로 크다. | 실제 확장 지점만 남기고 단순 runtime 으로 줄인다. | Hybrid |
| 11 | Runtime/WS | `app/ws/methods.ts` | 과도한 전환 계층 | RPC parsing, runtime mutation, compatibility patch 를 같이 수행한다. | runtime adapter 와 compatibility adapter 로 분리한다. | Transitional |
| 12 | Runtime/WS | `app/ws/filePatcher.ts` | 과도한 전환 계층 | whole-file AST patch 가 핵심 write 경로로 남아 있다. | shrink-only compatibility adapter 로 바꾼다. | Transitional |
| 13 | Runtime/WS | `app/hooks/useCanvasRuntime.ts` | 중복 오케스트레이션 | client 가 runtime command payload 와 source 해석을 다시 만든다. | shared codec 또는 server-native payload 를 소비한다. | Transitional |
| 14 | Runtime/WS | `app/features/render/parseRenderGraph.ts` | 과도한 전환 계층 | legacy graph parse 와 runtime overlay 를 같이 담당한다. | thin render adapter 로 축소한다. | Transitional |
| 15 | Runtime/WS | `app/features/render/aliasNormalization.ts` | 과도한 전환 계층 | app 쪽에서 alias 를 canonical capability 로 다시 변환한다. | shared domain 으로 이동하거나 제거한다. | Transitional |
| 16 | Runtime/WS | `libs/shared/src/lib/canonical-query/render-canvas.ts` | 중복 오케스트레이션 | runtime projection 이 있음에도 다시 legacy graph 를 만든다. | runtime-native snapshot surface 로 수렴한다. | Transitional |
| 17 | Runtime/WS | `libs/shared/src/lib/canvas-runtime/application/dispatchCanvasMutation.ts` | 대형 파일/과잉 책임 | translation, replay, snapshot 관련 책임이 한곳에 몰려 있다. | codec/history helper 로 나눠 runtime 핵심만 남긴다. | Core |
| 18 | Runtime/WS | `libs/shared/src/lib/canvas-runtime/projections/buildRenderProjection.ts` | 대형 파일/과잉 책임 | projection 별로 중복 로딩이 생긴다. | canvas snapshot 기반 파생 projection 으로 바꾼다. | Core |
| 19 | Runtime/WS | `libs/shared/src/lib/canvas-runtime/projections/buildEditingProjection.ts` | 대형 파일/과잉 책임 | editing projection 만을 위한 별도 조회/가공 경로가 있다. | shared loaded snapshot 위 계산으로 맞춘다. | Core |
| 20 | Runtime/WS | `libs/shared/src/lib/canvas-runtime/projections/buildHierarchyProjection.ts` | 대형 파일/과잉 책임 | hierarchy projection 도 중복된 canvas state 조회를 한다. | snapshot 파생 projection 으로 축소한다. | Core |
| 21 | CLI/Bootstrap | `libs/cli/src/bin.ts` | 대형 파일/과잉 책임 | legacy CLI 와 headless/server resource surface 가 한 router 에 섞여 있다. | single registry 와 alias 표면으로 정리한다. | Hybrid |
| 22 | CLI/Bootstrap | `cli.ts` | 과도한 전환 계층 | bun 기반 legacy dev bootstrap 이 별도로 존재한다. | 공식 CLI bootstrap 을 호출하는 thin alias 로 축소한다. | Transitional |
| 23 | CLI/Bootstrap | `scripts/dev/app-dev.ts` | 불필요한 레이어 | `cli.ts dev` 를 감싸는 wrapper 가 한 단계 더 있다. | 공식 dev bootstrap 함수 호출만 맡는다. | Transitional |
| 24 | CLI/Bootstrap | `scripts/desktop/dev.ts` | 문서-코드 드리프트 | 실제 기본 dev 경로지만 문서 기준점과 분리되어 있다. | 공식 시작 경로로 문서와 스크립트를 정렬한다. | Hybrid |
| 25 | CLI/Bootstrap | `libs/cli/src/headless/bootstrap.ts` | 오버엔지니어링 | headless 기준점은 맞지만 각 command 가 얇은 wrapper 로 중복된다. | declarative command registry 의 공통 bootstrap 으로 남긴다. | Core |
| 26 | CLI/Bootstrap | `libs/cli/src/commands/canvas.ts` | 문서-코드 드리프트 | 현재 bootstrap 옵션과 맞지 않는 호출이 남아 있다. | 실제 지원 surface 와 일치시키거나 제거한다. | Transitional |
| 27 | CLI/Bootstrap | `libs/cli/src/commands/init.ts` | 과도한 전환 계층 | `magam` alias 기반 초기화 서사를 계속 생성한다. | 단일 import identity 로 맞춘다. | Transitional |
| 28 | CLI/Bootstrap | `libs/cli/src/commands/new.ts` | 문서-코드 드리프트 | `@magam/core` 템플릿과 `init.ts` 스토리가 충돌한다. | 초기화와 생성 템플릿을 하나의 authoring story 로 합친다. | Transitional |
| 29 | CLI/Bootstrap | `libs/cli/src/core/executor.ts` | 불필요한 레이어 | temp file + require shim 기반 실행 경로를 추가로 가진다. | module resolution 표면을 하나로 줄인다. | Transitional |
| 30 | CLI/Bootstrap | `libs/core/src/index.ts` | 오버엔지니어링 | authoring DSL 과 internal/runtime helper 를 한 barrel 로 export 한다. | authoring-facing export 와 internal export 를 분리한다. | Hybrid |

