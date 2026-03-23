# Workspace Registry + Document Sidebar PRD

작성일: 2026-03-20  
상태: Draft  
결정: `multi-workspace registry + single active workspace`

## 1. 배경

현재 앱 셸은 사실상 "폴더를 열고 `.tsx` 파일 트리를 탐색하는 편집기"에 가깝다.

- `app/components/ui/Sidebar.tsx`는 `/api/file-tree` 기반으로 파일 트리를 로드한다.
- 현재 사이드바의 primary navigation은 document list가 아니라 `.tsx` 파일 목록이다.
- `WorkspaceClient`의 `new-document`도 아직 file path 생성과 file-based flow를 중심으로 이어져 있다.

하지만 현재 제품 방향은 이미 달라졌다.

- `database-first-canvas-platform` 문서군은 `workspace -> document -> canvas -> object`를 제품 기본 루프로 본다.
- `.tsx` file-first는 호환 경로이지 primary authoring truth가 아니다.
- 로컬 사용자 소유 데이터를 유지하면서도, 앱 안에서 workspace와 document를 직접 만들 수 있어야 한다.

이번 feature의 목적은 "폴더 기반 파일 탐색기"를 "workspace/document shell"로 전환하는 제품 기준을 고정하는 것이다.

## 2. 문제 정의

### 사용자 관점 문제

1. 사용자는 앱을 열었을 때 "내가 작업 중인 workspace"보다 "어떤 폴더의 어떤 `.tsx`를 보고 있는가"를 먼저 이해해야 한다.
2. 사용자는 결과물을 로컬에 소유하고 싶지만, 현재 UX는 로컬 소유 모델보다 개발자용 파일 트리 모델을 더 강하게 드러낸다.
3. 여러 작업 공간을 오가려면 앱 내부의 workspace 개념이 아니라 외부 폴더 열기 행위에 의존하게 된다.
4. 새 문서를 만든다는 행동이 사용자의 mental model에서는 document 생성인데, 구현상으로는 파일 생성/경로 선택처럼 보이기 쉽다.

### 제품 관점 문제

1. current sidebar가 file tree를 primary 정보구조로 사용하면 database-first 방향과 충돌한다.
2. workspace identity가 단순 폴더 basename이나 현재 열린 파일 집합에 종속되면 registry, recent, reopen, search, restore 설계가 불안정해진다.
3. file-first 진입 모델이 계속 전면에 남으면 canonical DB/PGlite가 제품 중심 저장소라는 메시지가 흐려진다.
4. 여러 workspace를 오가는 데스크톱 앱 경험을 만들기 어렵다.

## 3. 핵심 결정

### 3.1 폴더와 워크스페이스를 분리한다

- `폴더`는 OS permission과 사용자 소유 위치를 확보하는 acquisition primitive다.
- `워크스페이스`는 앱이 기억하고 다시 여는 logical unit이다.
- 사용자는 폴더를 선택하지만, 앱은 그 절대 경로를 workspace registry에 등록한다.

즉 UX 문장으로는 "워크스페이스를 추가한다"가 맞고, 구현 수단으로는 folder picker를 사용한다.

### 3.2 여러 workspace를 등록하되, 한 번에 하나만 active로 둔다

- 앱은 여러 absolute path 기반 workspace를 등록할 수 있다.
- 동시에 hydration/render/edit 대상이 되는 workspace는 하나만 유지한다.
- document list, search, recent restore, canvas context는 active workspace 범위 안에서만 동작한다.

이 결정으로 얻는 이점:

- single-open-folder보다 재방문성과 전환성이 좋다.
- 다중 활성 workspace가 만드는 selection/state/mutation 혼선을 피할 수 있다.
- 향후 multi-window 또는 multi-active 확장 여지를 남긴다.

### 3.3 로컬 파일 소유를 제품 원칙으로 둔다

- 각 workspace는 사용자가 고른 로컬 경로를 root로 가진다.
- workspace 데이터는 해당 root 아래의 로컬 PGlite 저장소와 workspace metadata로 유지한다.
- 앱 전역에는 registry, 최근 항목, UI state 같은 lightweight metadata만 저장한다.

현재 구현 정렬:

- registered workspace list
- active workspace
- workspace별 last active document

위 상태는 app-global `PGlite`에 저장되고, renderer `localStorage`는 legacy import source 또는 bootstrap cache로만 남는다.

이 구조에서 사용자는 "내 데이터가 앱 내부 어딘가"가 아니라 "내가 고른 폴더 안"에 결과물을 소유한다.

## 4. prior art 해석

- Miro/FigJam은 team/project/file browser 중심의 cloud model이다. 로컬 export는 가능하지만 primary ownership 모델은 아니다.
- Excalidraw는 local-first 성향이 강하지만 기본 경험은 browser/editor 중심이며, Plus에서 cloud workspace를 확장한다.
- Magam은 이 둘을 그대로 따라가기보다 "local-owned workspace registry"를 명시적으로 채택하는 편이 더 일관적이다.

요약하면:

- Miro/FigJam처럼 cloud workspace를 제품 중심에 두지 않는다.
- Excalidraw처럼 local-first 감각은 가져오되, 더 명시적인 workspace registry와 document shell을 제공한다.

## 5. 목표

1. 사용자가 앱 안에서 새 workspace를 만들고, 기존 workspace를 등록하고, 다시 열 수 있다.
2. 사용자가 앱 안에서 새 document를 만들고 바로 canvas authoring으로 진입할 수 있다.
3. 사이드바의 primary navigation을 file tree가 아니라 active workspace의 document list로 전환한다.
4. workspace 데이터가 사용자가 지정한 로컬 경로에 유지된다는 사실을 UX에서 분명히 드러낸다.
5. `.tsx`/폴더 기반 편집 경로를 primary authoring path에서 compatibility/import path로 낮춘다.

## 6. 비목표

1. v1에서 여러 workspace를 동시에 한 화면에 열지 않는다.
2. remote sync, team permission, shared cloud workspace를 도입하지 않는다.
3. legacy `.tsx` compatibility path를 즉시 삭제하지 않는다.
4. workspace 내부의 모든 파일 시스템 탐색기를 완전히 없애는 것을 v1 필수로 두지 않는다.
5. workspace/document schema 전체를 이 문서 하나로 확정하지 않는다. 이 문서는 shell과 UX 기준을 고정하는 데 집중한다.

## 7. 사용자 스토리

- As a first-time user, I want to create a workspace in a folder I choose so that my data lives in a location I control.
- As a returning user, I want the app to remember multiple workspaces so that I can switch projects without reopening folders manually.
- As an active user, I want one workspace to be clearly active so that documents, search, and canvas actions have an unambiguous scope.
- As an author, I want to create a new document from the sidebar and land directly in its canvas so that I can start working immediately.
- As a cautious user, I want to reveal the workspace folder in Finder and copy its path so that I trust where my data is stored.
- As a user whose drive is missing or renamed, I want the app to clearly show an unavailable workspace state so that I can reconnect it instead of losing it.

## 8. 정보 구조

### 8.1 사이드바 역할 재정의

현재:

- root folder name
- `.tsx` file tree
- file count

변경 후:

- workspace switcher
- active workspace summary
- document list
- document create entrypoint
- workspace utilities

### 8.2 제안 레이아웃

```text
┌────────────────────────────────────┐
│ Workspace Switcher                 │
│  Acme Product ▾                    │
│  /Users/.../Acme Product           │
│  [New Workspace] [Add Existing]    │
├────────────────────────────────────┤
│ Documents                          │
│  + New Document                    │
│  Search documents                  │
│  Product Brief                     │
│  IA Draft                          │
│  Canvas Experiments                │
├────────────────────────────────────┤
│ Workspace                          │
│  Show in Finder                    │
│  Copy Path                         │
│  Reconnect / Remove                │
└────────────────────────────────────┘
```

### 8.3 원칙

- file tree는 primary navigation이 아니다.
- document는 workspace 안의 핵심 탐색 단위다.
- empty workspace에서는 "첫 document 만들기"가 가장 강하게 보여야 한다.
- active workspace 경로는 숨기지 말고, 신뢰를 주는 수준으로 노출한다.

### 8.4 v1 추천안: Workspace-first sidebar

v1은 `Workspace-first` IA를 기본으로 채택한다.

이유:

- active workspace 경계가 가장 명확하다.
- 로컬 경로 기반 ownership 메시지를 가장 잘 전달한다.
- `workspace -> document -> canvas` 진입 흐름을 자연스럽게 유지한다.
- multi-workspace registry를 지원하면서도 single active workspace 제약과 충돌하지 않는다.

추천 구조:

```text
[Workspace Switcher]
Acme Product
/Users/.../Acme Product
New Workspace
Add Existing Workspace

[Documents]
New Document
Search documents
Product Brief
IA Draft
Canvas Experiments

[Workspace]
Show in Finder
Copy Path
Reconnect / Remove
```

비추천 v1 구조:

- `Recents-first` sidebar
- global mixed workspace/document list
- file tree를 documents보다 먼저 두는 hybrid explorer

이 구조들은 revisit에는 유리할 수 있지만, v1에서는 active workspace 경계를 흐리게 만들 가능성이 더 크다.

### 8.5 empty state 기준

#### First-run empty state

상황:

- 등록된 workspace가 하나도 없다.

보여줄 것:

- `New Workspace`
- `Add Existing Workspace`
- "데이터는 선택한 로컬 폴더에 저장됩니다" 메시지

보여주지 않을 것:

- fake sample file tree
- `.tsx` 파일 생성 중심 카피

#### Empty workspace state

상황:

- active workspace는 있지만 document가 없다.

보여줄 것:

- workspace name
- local path
- `New Document`
- 필요 시 `Import from TSX` 같은 compatibility CTA

핵심 메시지:

- "이 워크스페이스에 첫 document를 만드세요"

#### Missing workspace state

상황:

- registry에는 있지만 root path가 현재 접근 불가하다.

보여줄 것:

- unavailable status
- last known path
- `Reconnect`
- `Remove`

보여주지 않을 것:

- 자동 임시 workspace 전환
- silent fallback

### 8.6 workspace switcher 동작 규칙

1. switcher는 registered workspace 목록만 보여준다.
2. 목록에서 하나를 선택하면 즉시 active workspace가 바뀐다.
3. active workspace 변경 시 document list, current canvas context, recent document scope를 함께 전환한다.
4. unavailable workspace는 목록에 남기되 구분된 상태로 표시한다.
5. `New Workspace`와 `Add Existing Workspace`는 switcher 근처에 둔다.
6. switcher는 최근 문서 목록보다 workspace identity를 우선 노출한다.

### 8.7 document list 동작 규칙

1. document list는 active workspace 범위 안에서만 보여준다.
2. 기본 정렬은 최근 수정 순 또는 최근 열람 순 중 하나로 고정한다.
3. `New Document`는 list 최상단의 primary CTA로 둔다.
4. document를 클릭하면 해당 document의 main canvas로 바로 진입한다.
5. v1에서는 file path보다 document title을 먼저 보여준다.
6. 필요 시 path/provenance는 secondary metadata로만 노출한다.

## 9. 요구사항

### Must Have (P0)

#### P0-1. Workspace 생성/등록

- 사용자는 앱 안에서 새 workspace를 만들 수 있어야 한다.
- 사용자는 절대 경로 기반으로 기존 workspace를 등록할 수 있어야 한다.
- 새 workspace 생성 시 데이터 저장 root는 사용자가 선택하거나 생성한 로컬 폴더여야 한다.

수용 기준:

- Given 사용자가 첫 실행 상태일 때
- When `New Workspace` 또는 `Add Existing Workspace`를 실행하면
- Then 앱은 folder picker를 통해 로컬 경로를 확보하고 workspace registry에 등록한다

#### P0-2. Multi-workspace registry

- 앱은 여러 workspace entry를 기억해야 한다.
- 각 entry는 최소 `workspaceId`, `displayName`, `rootPath`, `status`, `lastOpenedAt` 수준의 정보를 가져야 한다.
- workspace identity는 단순 basename이나 현재 열린 파일 목록으로만 유도하지 않아야 한다.

#### P0-3. Single active workspace

- 한 번에 하나의 workspace만 active 상태가 된다.
- active workspace 변경 시 document list, recent document context, canvas hydration 범위가 함께 전환된다.
- 비활성 workspace의 runtime state가 active workspace action scope와 섞이지 않아야 한다.

#### P0-4. Document-first sidebar

- 사이드바는 active workspace의 document list를 primary surface로 보여야 한다.
- file tree는 v1에서 제거하거나 compatibility/import 영역으로 내려야 한다.
- active workspace에 document가 없으면 empty state와 `New Document` CTA를 보여야 한다.

#### P0-5. Document 생성과 즉시 진입

- 사용자는 sidebar 또는 command surface에서 새 document를 만들 수 있어야 한다.
- document 생성은 실제 persisted workspace data를 즉시 materialize해야 한다.
- 생성 직후 사용자는 해당 document의 main canvas에 진입해야 한다.

수용 기준:

- Given active workspace가 존재할 때
- When 사용자가 `New Document`를 누르면
- Then document summary와 초기 canvas가 생성되고 즉시 열린다

#### P0-6. Local ownership affordance

- 사용자는 active workspace의 실제 저장 위치를 확인할 수 있어야 한다.
- `Show in Finder`와 `Copy Path` 수준의 affordance를 제공해야 한다.
- 앱은 "이 데이터가 로컬에 저장된다"는 사실을 숨기지 않아야 한다.

#### P0-7. Missing path / reconnect state

- 등록된 workspace 경로가 사라지거나 접근 불가하면 unavailable 상태를 표시해야 한다.
- 사용자는 해당 entry를 reconnect, reveal, remove 중 하나로 처리할 수 있어야 한다.
- 조용한 fallback으로 다른 workspace나 임시 저장소를 쓰면 안 된다.

#### P0-8. Legacy compatibility boundary

- legacy `.tsx` path는 import/reference/compatibility surface로 남을 수 있다.
- 하지만 새 primary authoring loop는 `workspace -> document -> canvas`여야 한다.
- 새 사이드바와 onboarding copy는 `.tsx` file editing을 기본 메시지로 사용하지 않아야 한다.

### Nice to Have (P1)

- 최근 사용 workspace와 마지막 active document 자동 복원
- workspace alias rename
- document search / recent section
- legacy `.tsx` import entrypoint
- workspace root health check and repair messaging

### Future Considerations (P2)

- 여러 workspace를 동시에 여는 multi-window model
- workspace pin/favorite
- local backup/export/import wizard
- shared/cloud workspace sync

## 10. 개념 데이터 모델

### App-level registry

- `registeredWorkspace`
  - `workspaceId`
  - `displayName`
  - `rootPath`
  - `status`
  - `lastOpenedAt`
  - `lastActiveDocumentId?`

앱 레벨 registry는 lightweight shell metadata만 가진다.

### Workspace-local storage

- `workspace metadata`
  - workspace identity, schema version, createdAt, migration info
- `local PGlite store`
  - document/object/canvas data의 primary persisted source

원칙:

- registry와 document content를 같은 저장소 책임으로 섞지 않는다.
- app registry는 "어디에 무엇이 있는지"를 기억한다.
- workspace local store는 "실제 작업 데이터"를 가진다.

## 11. 설계 원칙

1. `폴더 선택`은 UI action이고, `workspace 활성화`는 product state다.
2. workspace는 경로에 anchored되지만 경로 그 자체와 동치가 아니다.
3. document는 파일명이 아니라 persisted authoring unit이다.
4. primary navigation은 file tree가 아니라 document list다.
5. local-first 신뢰를 위해 path visibility와 reveal affordance를 기본 제공한다.
6. 다중 workspace 지원은 registry에서 해결하고, editing complexity는 single active로 제한한다.

## 12. 성공 지표

### Leading Indicators

1. 첫 실행 사용자가 folder tree 이해 없이 workspace 생성 후 첫 document까지 도달한다.
2. active workspace 전환 후 document reopening이 빠르고 명확하게 동작한다.
3. 새 document 생성이 fake path나 draft-only 상태 없이 즉시 persisted state로 연결된다.
4. 사용자가 workspace path를 확인하거나 Finder에서 여는 행동을 자연스럽게 수행할 수 있다.

### Lagging Indicators

1. `.tsx` file tree 중심 탐색보다 document 중심 탐색 사용 빈도가 높아진다.
2. workspace 재방문과 최근 문서 복원 성공률이 높아진다.
3. "내 데이터가 어디 저장되는가"에 대한 사용자 혼란과 지원 비용이 줄어든다.

## 13. 오픈 질문

### Blocking

1. workspace local metadata와 PGlite 파일을 root 바로 아래 둘지, 숨김 디렉터리(예: `.magam/`) 아래 둘지
2. 새 document 생성 시 기본 document type을 하나로 고정할지, 최소 선택 UI를 둘지
3. path 이동/이름 변경 시 reconnect를 `workspaceId` handshake로 복구할지, 경로 재지정만 허용할지

### Non-blocking

1. file tree compatibility surface를 sidebar 안에 남길지, 별도 import view로 옮길지
2. workspace switcher에서 recent와 pinned를 함께 보여줄지
3. document list에 recent/sorted/grouped presentation을 언제 도입할지

## 14. 권장 구현 순서

1. app-level workspace registry와 active workspace state를 먼저 고정한다.
2. sidebar를 file tree surface에서 workspace/document shell로 교체한다.
3. new workspace / add existing workspace flow를 연결한다.
4. new document creation을 persisted document bootstrap으로 전환한다.
5. legacy `.tsx` path는 import/reference surface로 후퇴시킨다.

## 15. 관련 문서

- `docs/features/database-first-canvas-platform/README.md`
- `docs/features/database-first-canvas-platform/USECASE.md`
- `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`
- `docs/reports/excalidraw-vs-magam/README.md`
- `app/components/ui/Sidebar.tsx`
- `app/components/editor/WorkspaceClient.tsx`

## 16. 구현 소스 링크

- shell orchestration: `app/components/editor/WorkspaceClient.tsx`
- presenter sidebar: `app/components/ui/Sidebar.tsx`
- workspace registry/session store: `app/store/graph.ts`
- registry/document APIs: `app/app/api/workspaces/route.ts`, `app/app/api/documents/route.ts`
- render/file-tree proxy routing: `app/app/api/render/route.ts`, `app/app/api/file-tree/route.ts`
- workspace-aware runtime backends: `app/ws/methods.ts`, `app/ws/server.ts`, `libs/cli/src/server/http.ts`
- desktop bridge contract + host scaffold: `app/lib/desktop/bridge-contract.ts`, `app/components/editor/desktopBridge.ts`, `desktop/preload.ts`, `desktop/main.ts`

## 17. 구현 완료 메모

- workspace registry는 app-level store와 localStorage restore guard를 통해 multiple entry + single active session으로 동작한다.
- render/ws mutation/file subscribe 경로는 active workspace root를 요청 단위로 전달받아 single `MAGAM_TARGET_DIR` 가정을 완화했다.
- sidebar primary IA는 document-first로 유지되고, legacy TSX tree는 compatibility section으로 후퇴했다.
- Electron/Desktop bridge는 browser fallback abstraction에서 끝나지 않고 preload/main scaffold까지 연결되었다.
- 자동 검증은 현재 로컬 환경의 dependency/type resolution 문제 때문에 전면 통과하지 못했고, quickstart 결과는 `specs/001-workspace-document-shell/quickstart.md`에 별도 메모로 남긴다.
