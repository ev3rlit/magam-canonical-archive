# Hardcoded Text Audit

## 개요

본 문서는 코드베이스 전반에서 하드코딩된 텍스트 데이터 사용처를 탐색한 결과를 정리합니다.
목적은 향후 i18n, UI hardening, 메시지 분리, 기본 생성값 정비 작업의 입력 문서를 만드는 것입니다.

## 스캔 범위

- 포함: `app/`, `libs/`, `desktop/`, `scripts/`
- 제외: `examples/`, `docs/`, `specs/`, `*.test.*`, `*.spec.*`, `__fixtures__/`
- 기준:
  - UI에 직접 노출되는 라벨, 버튼명, placeholder, title, aria text
  - 메뉴/툴바/컨텍스트 메뉴 액션 라벨
  - 기본 생성 텍스트와 샘플 콘텐츠
  - API/서버/CLI/MCP 계층의 에러 메시지 및 상태 메시지

## 수집 결과

총 58개 파일을 개선 후보로 수집했습니다.

## 진행 상태

- 완료: 중앙 locale dictionary 도입 (`app/features/i18n/`)
- 완료: UI/workspace/canvas authoring 문자열의 1차 이관
- 완료: 기본 생성 텍스트 분리 (`app/features/editing/defaultContent.ts`)
- 완료: API/CLI 메시지 모듈 스캐폴딩 (`app/app/api/_shared/messages.ts`, `libs/cli/src/messages.ts`)
- 정책: 앱 UI는 locale dictionary를 사용하고, CLI는 영어 고정 정책을 유지합니다.

### 앱 UI / 화면 카피

- `app/components/ExportDialog.tsx`
- `app/components/BackgroundSelector.tsx`
- `app/components/FontSelector.tsx`
- `app/components/ui/Header.tsx`
- `app/components/ui/QuickOpenDialog.tsx`
- `app/components/ui/SearchOverlay.tsx`
- `app/components/ui/StickerInspector.tsx`
- `app/components/ui/ThemeModeToggle.tsx`

### 워크스페이스 / 대시보드 카피

- `app/features/workspace/components/DashboardHeader.tsx`
- `app/features/workspace/components/DashboardSidebar.tsx`
- `app/features/workspace/components/WorkspaceCard.tsx`
- `app/features/workspace/components/WorkspaceListItem.tsx`
- `app/features/workspace/components/CanvasCard.tsx`
- `app/features/workspace/components/CanvasListItem.tsx`
- `app/features/workspace/pages/WorkspaceDashboardPage.tsx`
- `app/features/workspace/pages/WorkspaceDetailPage.tsx`

### 메뉴 / 툴바 / 액션 라벨

- `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarActions.ts`
- `app/features/canvas-ui-entrypoints/canvas-toolbar/toolbarSections.ts`
- `app/features/canvas-ui-entrypoints/node-context-menu/nodeMenuItems.ts`
- `app/features/canvas-ui-entrypoints/pane-context-menu/paneMenuItems.ts`
- `app/features/canvas-ui-entrypoints/selection-floating-menu/controlInventory.ts`
- `app/features/canvas-ui-entrypoints/selection-floating-menu/SelectionFloatingMenu.tsx`
- `app/processes/canvas-runtime/bindings/toolbarPresenter.ts`

### 기본 생성값 / 샘플 콘텐츠

- `app/features/editing/createDefaults.ts`
- `app/features/plugin-runtime/examples/index.ts`
- `app/features/plugin-runtime/examples/chart/index.tsx`

### API / 서버 / RPC 메시지

- `app/app/api/app-state/preferences/route.ts`
- `app/app/api/app-state/session/route.ts`
- `app/app/api/app-state/recent-canvases/route.ts`
- `app/app/api/app-state/workspaces/route.ts`
- `app/app/api/workspaces/route.ts`
- `app/app/api/canvases/route.ts`
- `app/app/api/render/route.ts`
- `app/app/api/file-tree/route.ts`
- `app/app/api/assets/file/route.ts`
- `app/app/api/assets/upload/route.ts`
- `app/ws/server.ts`
- `app/ws/filePatcher.ts`
- `app/ws/rpc.ts`

### CLI / MCP / 헤드리스 메시지

- `libs/cli/src/bin.ts`
- `libs/cli/src/commands/dev.ts`
- `libs/cli/src/commands/init.ts`
- `libs/cli/src/commands/new.ts`
- `libs/cli/src/commands/render.ts`
- `libs/cli/src/commands/validate.ts`
- `libs/cli/src/commands/image.ts`
- `libs/cli/src/commands/workspace.ts`
- `libs/cli/src/commands/canvas.ts`
- `libs/cli/src/commands/canvas-node.ts`
- `libs/cli/src/commands/object.ts`
- `libs/cli/src/commands/mutation.ts`
- `libs/cli/src/commands/search.ts`
- `libs/cli/src/commands/surface.ts`
- `libs/cli/src/mcp/tools.ts`
- `libs/cli/src/mcp/resources.ts`
- `libs/cli/src/mcp/utils.ts`
- `libs/cli/src/server/http.ts`
- `libs/cli/src/server/websocket.ts`

## 메모

- 실행 코드 기준으로 영어/한국어 문자열이 혼재되어 있습니다.
- `app/ws/rpc.ts`, `app/ws/filePatcher.ts`는 UI 카피보다는 에러 코드/메시지 계층에 가깝습니다.
- `app/features/plugin-runtime/examples/*`는 런타임 예제이지만 `examples/` 디렉터리 외부에 있으므로 이번 문서에는 포함했습니다.

## 다음 정리 단계

- 사용자 노출 UI 문자열과 내부 운영 메시지를 분리합니다.
- i18n 대상과 의도된 기본 샘플 텍스트를 분리합니다.
- 우선순위가 높은 화면부터 메시지 키 또는 번역 리소스로 이동합니다.
