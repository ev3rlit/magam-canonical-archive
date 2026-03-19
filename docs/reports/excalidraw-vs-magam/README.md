# Excalidraw 종합 검토와 magam 비교 보고서

작성일: 2026-03-18  
대상:
- Excalidraw repo: `/Users/danghamo/Documents/gituhb/excalidraw`
- magam repo: `/Users/danghamo/Documents/gituhb/magam-feature-database-first-canvas-platform`

## 검토 범위

이 문서는 Excalidraw의 구조와 아키텍처, 시스템 디자인, UX 사용성, 저장 방식, 협업 구조, 복잡한 메뉴를 단순하게 처리하는 방식 등을 로컬 저장소 기준으로 검토하고, 현재 magam과 비교한 결과를 정리한다.

이번 검토는 코드/문서 읽기 기반이다. 실제 런타임 프로파일링, 사용성 테스트, 네트워크 부하 측정까지 수행한 것은 아니다.

## 한 줄 결론

Excalidraw는 "직접 조작 중심의 성숙한 협업 화이트보드"이고, magam은 "코드와 AI를 중심에 둔 캔버스 워크스페이스"다. 둘은 겉보기 캔버스는 비슷하지만, 시스템의 중심 추상화와 UX 우선순위가 다르다.

magam이 Excalidraw를 그대로 따라가면 안 된다. 대신 Excalidraw의 검증된 UI 단순화 원칙과 모바일 분기 전략은 가져오고, 저장/편집/AI 경로는 magam의 file-backed + canonical DB + agent orchestration 방향으로 재설계하는 편이 맞다.

## 핵심 비교 표

| 항목 | Excalidraw | magam | 시사점 |
| --- | --- | --- | --- |
| 핵심 추상화 | scene/elements/appState | source code/render graph/canonical object | magam은 "도형 편집기"보다 "구조화된 지식 캔버스"로 정의하는 편이 일관적 |
| 제품 중심 | direct manipulation | AI-mediated authoring + workspace shell | magam은 채팅을 보조 기능이 아니라 주된 입력 계층으로 승격해야 함 |
| 렌더링 구조 | editor package 내부의 자체 캔버스/씬 엔진 | `@magam/core` custom reconciler -> render graph -> `parseRenderGraph()` -> React Flow | magam은 파이프라인이 강력하지만 계층이 길어 디버깅/일관성 비용이 큼 |
| 편집 모델 | 메모리 내 scene mutation | 캔버스 이벤트 -> edit command -> WS JSON-RPC -> AST patch -> 파일 반영 | magam은 "아카이브 가능한 코드" 장점이 있으나 반응성과 실패면 관리가 중요 |
| 저장 방식 | localStorage + IndexedDB + `.excalidraw` JSON + Firebase | TSX 파일이 현재 주 저장소, 자산 파일 별도 저장, canonical PGlite 계층이 병행 성장 중 | magam은 file-first와 database-first를 어떻게 수렴시킬지 빨리 정해야 함 |
| 협업 | 실시간 다중 사용자, 커서/idle/follow, E2EE | 현재는 파일 동기화와 agent workflow 쪽이 강함, human realtime presence는 약함 | magam은 먼저 "agent collaboration"을 명확히 정의한 뒤 human collab을 선택적으로 확장하는 편이 낫다 |
| 모바일 | 별도 MobileMenu/MobileToolBar 보유 | 반응형 요소는 있으나 전용 모바일 정보구조는 약함 | mobile second라도 shell 분리는 초기에 설계해야 함 |
| 메뉴 단순화 | 햄버거 + context-sensitive actions + command palette + responsive toolbar collapse | 헤더/사이드바/탭바/컨텍스트 메뉴/플로팅 툴바/검색/AI 패널이 분산 | magam은 "기능은 많지만 진입점이 흩어진" 인상을 줄 수 있음 |

## 1. Excalidraw 구조와 아키텍처

### 1.1 저장소 구조

Excalidraw는 monorepo 구성이 매우 명확하다.

- `packages/excalidraw`: 재사용 가능한 에디터 패키지
- `excalidraw-app`: 실제 호스팅 앱 셸
- `packages/common`, `packages/element`, `packages/math`, `packages/utils`: 하위 공통 모듈

이 구조의 장점은 코어 에디터와 제품 셸이 분리된다는 점이다. 기능을 앱에 넣을지, 재사용 가능한 editor primitive로 넣을지 경계가 비교적 선명하다.

magam은 반대로 앱 셸, 파일 동기화, canvas runtime, AI chat, AST patch, canonical DB transition이 하나의 제품 흐름 안에서 더 촘촘하게 엮여 있다. 지금 단계에서는 빠르지만, 장기적으로는 경계가 Excalidraw보다 덜 분리되어 있다.

### 1.2 시스템 디자인

Excalidraw의 중심은 scene과 element 컬렉션이다.

- `packages/excalidraw/components/App.tsx`는 에디터의 중심 런타임이다.
- `packages/excalidraw/components/LayerUI.tsx`는 툴바, 메뉴, selected actions, dialog, sidebar를 모으는 UI composition layer다.
- `excalidraw-app/App.tsx`는 앱 셸에서 local-first loading, collaboration, share/import/export, AI entry를 조립한다.

중요한 점은 편집기의 진실 공급원이 "파일"이 아니라 "현재 scene 메모리 상태"라는 것이다. export/import/storage는 이 상태를 둘러싼 adapter다. 이 덕분에 직접 조작 도구에서 latency가 낮고, UI 반응성이 좋다.

magam은 반대로 진실 공급원이 점점 이원화되고 있다.

- 현재 사용자 체감 기준 primary source는 TSX 파일과 render graph다.
- `libs/core/src/renderer.ts`와 `libs/core/src/reconciler/hostConfig.ts`는 React component tree를 graph container로 만드는 custom reconciler를 제공한다.
- `app/features/render/parseRenderGraph.ts`는 그 graph를 canvas 편집용 노드/엣지와 canonical metadata로 다시 해석한다.
- 편집은 `app/features/editing/commands.ts` -> `app/hooks/useFileSync.ts` -> `app/ws/methods.ts` -> `app/ws/filePatcher.ts` 경로로 파일에 환원된다.

즉, Excalidraw는 memory-first editor이고, magam은 source-first editor에 가깝다. 여기에 `libs/shared`와 `libs/cli/README.md`에서 보이는 canonical DB/PGlite 계층이 더해지며 database-first 전환도 동시에 진행 중이다.

이 차이는 중요하다. Excalidraw는 interaction 비용이 낮고, magam은 archiveability와 machine-readability가 높다.

## 2. Excalidraw UX와 사용성

### 2.1 사용자 관점에서 잘 된 점

Excalidraw의 UX는 매우 일관되다.

- 사용자는 "도구 선택 -> 캔버스 조작"이라는 단일 정신 모델만 유지하면 된다.
- hand-drawn 스타일이 정밀 제어 부담을 줄여 준다.
- local-first autosave가 기본이라 저장 불안이 작다.
- collaboration/session sharing이 제품 흐름 안에서 자연스럽다.
- main menu, selected actions, command palette, mobile toolbar가 역할 분담을 명확히 가진다.

특히 "직접 그리기 시작하는 데 필요한 시간"이 짧다. 진입 장벽이 낮고, 기능은 많지만 기본 흐름은 단순하다.

### 2.2 복잡한 메뉴를 단순하게 처리하는 방식

Excalidraw는 복잡한 기능을 다음 방식으로 눌러 담는다.

1. 항상 보이는 1차 도구를 제한한다.  
   모바일에서는 `packages/excalidraw/components/MobileToolBar.tsx`에서 selection, freedraw, eraser, rectangle, arrow 같은 핵심 도구만 바깥에 놓고, 나머지는 extra tools로 접는다.

2. 비슷한 도구는 그룹화한다.  
   selection/lasso, rectangle/diamond/ellipse, arrow/line이 툴 팝오버로 묶여 있다.

3. 문맥형 패널을 사용한다.  
   `LayerUI.tsx`의 selected shape actions는 선택 상태일 때만 깊은 옵션을 보여 준다.

4. 범용 메뉴는 햄버거와 command palette로 보낸다.  
   자주 안 쓰는 기능은 `MainMenu`와 `CommandPalette`가 흡수한다.

5. 모바일은 별도 정보구조를 갖는다.  
   `MobileMenu.tsx`가 상단바/하단바/스크롤 복귀 등 모바일 상호작용을 전용 설계로 처리한다.

이 방식의 핵심은 "기능을 줄이는 것"이 아니라 "노출 시점을 줄이는 것"이다.

## 3. Excalidraw 저장 방식과 협업 구조

### 3.1 저장 방식

Excalidraw의 저장 설계는 분리형이다.

- scene/appState는 `excalidraw-app/data/LocalData.ts`, `excalidraw-app/data/localStorage.ts`를 통해 localStorage에 저장된다.
- 이미지 파일과 라이브러리 데이터는 IndexedDB를 사용한다.
- 외부 공유용 포맷은 `packages/excalidraw/data/json.ts`의 `.excalidraw` JSON이다.
- export 시 PNG/SVG에 scene metadata를 embed할 수도 있다.

좋은 점은 저장 대상별 특성을 분리했다는 것이다.

- 빠른 autosave: localStorage
- 큰 바이너리: IndexedDB
- 사용자 파일 교환: `.excalidraw`
- 협업 원격 동기화: Firebase

이 구조는 browser-first 제품에 매우 적합하다.

### 3.2 협업 구조

Excalidraw의 협업은 단순한 "파일 변경 감지" 수준이 아니다.

- `excalidraw-app/collab/Collab.tsx`가 협업 세션 수명주기를 관리한다.
- `excalidraw-app/collab/Portal.tsx`가 socket transport와 broadcast를 담당한다.
- `excalidraw-app/data/firebase.ts`가 encrypted scene/files 저장을 담당한다.

구조적으로 보면:

- socket은 presence와 incremental scene update를 전달한다.
- Firebase는 durable shared state 저장소다.
- scene payload는 암호화되어 전송/저장된다.
- cursor, idle status, follow, visible bounds 같은 협업 보조 신호도 별도로 다룬다.

즉, Excalidraw 협업은 "실시간 공동 편집 제품"으로서 필요한 최소 세트를 이미 갖추고 있다.

## 4. magam 구조와 현재 상태

### 4.1 현재 제품 정체성

magam은 Excalidraw와 비슷한 화이트보드처럼 보이지만, 실제로는 더 IDE에 가깝다.

- `README.md`는 "programmable whiteboard for AI agent collaboration"을 전면에 둔다.
- `app/components/editor/WorkspaceClient.tsx`는 canvas만이 아니라 sidebar, tabs, search, quick open, chat, error overlay를 포함한 workspace shell을 구성한다.
- `app/components/ui/Header.tsx`에서 AI Chat이 상단 주요 액션으로 노출된다.
- `app/components/chat/ChatPanel.tsx`와 `app/store/chat.ts`는 provider/model/reasoning/session/group/permission mode까지 관리한다.

즉, magam은 drawing tool이 아니라 "AI가 다루는 구조화된 작업 공간"으로 가고 있다.

### 4.2 렌더링 및 편집 아키텍처

magam의 가장 큰 차별점은 코드 기반 왕복 편집이다.

- `libs/core/src/renderer.ts`: React component tree를 graph container로 렌더링
- `app/features/render/parseRenderGraph.ts`: graph를 canvas UI와 canonical metadata로 해석
- `app/features/editing/editability.ts`: 어떤 노드가 어떤 방식으로 수정 가능한지 정의
- `app/features/editing/commands.ts`: 편집 intent를 typed command envelope로 정리
- `app/hooks/useFileSync.ts`: 클라이언트 JSON-RPC bridge
- `app/ws/methods.ts`: 서버 mutation handler
- `app/ws/filePatcher.ts`: Babel AST 기반 TSX patch

이 구조의 장점:

- 시각 결과가 코드로 보존된다.
- AI가 생성/수정하기 좋은 surface를 가진다.
- 구조적 편집과 provenance를 추적하기 쉽다.
- canonical object/capability 방향으로 확장하기 좋다.

이 구조의 비용:

- mutation 경로가 길다.
- UI에서 보이는 객체와 source AST 사이의 불일치가 생기기 쉽다.
- 실시간 다중 사용자 협업으로 확장할 때 conflict 모델이 더 복잡해진다.
- file-first와 canonical DB-first가 동시에 존재하면 product mental model이 흔들릴 수 있다.

### 4.3 저장 방식

현재 magam의 저장 전략은 과도기적이다.

1. 현재 런타임 기준  
   TSX source file이 핵심 저장소다. 사용자는 사실상 "코드를 편집하고 그 결과를 캔버스로 본다."

2. 자산 저장  
   업로드된 asset은 workspace 파일로 저장된다.

3. 동기화/버전  
   `app/ws/server.ts`와 `useFileSync.ts`가 sha256 version과 file watch를 활용해 변경을 전달한다.

4. 미래 방향  
   `libs/cli/README.md`, `libs/shared/src/lib/canonical-persistence/*`는 `.magam/canonical-pgdata` 기반 canonical persistence가 이미 병행 도입되고 있음을 보여 준다.

따라서 현재 magam은 엄밀히 말해 "file-backed app 위에 database-first headless layer가 자라나는 상태"다.

이건 위험이 아니라 기회다. 다만 제품/아키텍처 레벨에서 다음 질문에 빨리 답해야 한다.

- 최종 authoritative source는 file인가 canonical DB인가?
- 둘이 공존한다면 어느 쪽이 user-facing truth인가?
- AI와 UI와 CLI는 동일 mutation API를 쓰는가?

## 5. magam UX 비교

### 5.1 Excalidraw보다 강한 점

1. AI entry가 훨씬 중심적이다.  
   Excalidraw의 AI는 `excalidraw-app/components/AI.tsx`, `TTDDialog`처럼 부가 모듈에 가깝다. magam은 헤더와 별도 패널에서 AI가 1급 인터페이스다.

2. 파일/탭/검색/워크스페이스 맥락이 강하다.  
   Excalidraw는 single-canvas mental model에 강하고, magam은 multi-file knowledge work에 더 맞다.

3. 결과의 보존성과 재활용성이 높다.  
   코드/구조/향후 canonical object까지 이어지는 경로가 있다.

4. plugin/runtime/capability 확장 방향이 더 명시적이다.  
   `app/features/plugin-runtime/*`, `app/features/render/canonicalObject.ts`는 확장성과 머신 조작성을 염두에 둔다.

### 5.2 Excalidraw보다 약한 점

1. 초심자 관점의 즉시성  
   Excalidraw는 열자마자 그리면 된다. magam은 파일, 탭, 검색, AI, 툴바, 컨텍스트 메뉴가 동시에 보이기 쉬워 초기 인지 부하가 높다.

2. 직접 조작의 단순함  
   magam은 구조적 editing power는 높지만, 사용자가 "지금 당장 쉽게 하나 추가/수정"하는 감각은 Excalidraw보다 덜 가볍다.

3. 모바일 준비도  
   Excalidraw는 mobile-specific shell이 있다. magam은 반응형은 있으나 모바일 전용 IA는 아직 약하다.

4. 협업의 명확성  
   Excalidraw는 "여럿이 같이 그린다"가 명확하다. magam은 "AI/agent와 협업한다"는 메시지는 강하지만, human-to-human collaboration 모델은 아직 흐리다.

### 5.3 복잡한 메뉴 처리 관점의 비교

현재 magam은 기능을 숨기기보다 분산시키는 쪽에 가깝다.

- 좌측 Explorer
- 상단 Header
- 상단/중앙 Search, Quick Open
- 하단 FloatingToolbar
- 캔버스 ContextMenu
- 우측 ChatPanel
- 탭 ContextMenu

구조적으로는 `canvas-runtime` slot/contribution 기반이라 꽤 잘 설계돼 있다. 하지만 사용자 관점에서는 진입점이 많아 "무엇을 어디서 해야 하는지"가 Excalidraw보다 즉시적이지 않다.

즉, 내부 아키텍처는 발전적이지만, 외부 정보구조는 아직 수렴이 덜 됐다.

## 6. magam이 Excalidraw에서 배워야 할 것

### 6.1 반드시 가져와야 할 것

1. 역할 분리된 UI 계층  
   Excalidraw처럼 항상 노출되는 1차 액션, 선택 시만 보이는 2차 액션, 깊은 기능용 3차 액션을 분리해야 한다.

2. 모바일 전용 shell  
   mobile second라도 `desktop shell`과 `mobile shell`은 분기해야 한다. 같은 UI를 줄인다고 해결되지 않는다.

3. progressive disclosure  
   모든 기능을 동시에 노출하지 말고, 문맥과 viewport 크기에 따라 단계적으로 보여 줘야 한다.

4. 협업 상태의 가시화  
   Excalidraw는 공유/방/협업 상태가 제품 흐름 안에서 자연스럽다. magam도 AI 작업 상태, sync 상태, multi-actor status를 더 명시적으로 드러낼 필요가 있다.

### 6.2 그대로 가져오면 안 되는 것

1. Excalidraw의 도구 중심 mental model  
   magam은 도구보다 intent, object, document, agent가 중요하다.

2. scene-only 저장 모델  
   magam의 강점은 code/archive/canonical queryability다. 이걸 포기하면 제품 차별성이 사라진다.

3. AI를 부가 패널로 다루는 방식  
   magam에서 AI는 add-on이 아니라 authoring backbone이어야 한다.

## 7. AI-first, mobile-second를 기준으로 한 권고안

### 7.1 제품 원칙

magam은 아래처럼 정의하는 것이 좋다.

- Excalidraw: "사람이 직접 조작하는 협업 화이트보드"
- magam: "AI와 사람이 함께 구조화된 시각 지식을 만들고 운영하는 캔버스 워크스페이스"

이 정의를 기준으로 보면 우선순위가 달라진다.

- 1순위: intent capture, structured mutation, provenance, reusable objects
- 2순위: direct manipulation polish
- 3순위: freeform drawing breadth

### 7.2 시스템 디자인 권고

1. single mutation backbone을 만든다.  
   UI, AI, CLI, plugin runtime이 결국 동일한 canonical mutation contract를 타게 해야 한다. 현재의 file patch path는 adapter가 되고, 최종 중심은 command/canonical layer가 되는 편이 맞다.

2. file-first와 database-first의 관계를 명시한다.  
   추천은 다음 둘 중 하나다.

   - 옵션 A: canonical DB가 truth, 파일은 export/projection
   - 옵션 B: 파일이 truth, canonical DB는 index/query cache

   지금 상태에서 가장 위험한 것은 두 계층이 모두 truth처럼 행동하는 것이다.

3. human collaboration보다 agent collaboration을 먼저 제품화한다.  
   Excalidraw 수준의 실시간 공편집은 비싸다. magam은 먼저 "AI가 만든 변경 제안, 사용자 승인, provenance, rollback"을 협업 모델의 핵심으로 삼는 편이 낫다.

4. AST patcher는 단기 bridge로 보고, 중장기적으로는 semantic mutation path를 강화한다.  
   지금의 `filePatcher.ts`는 매우 유용하지만, 제품이 커질수록 fragile point가 된다.

### 7.3 UX 권고

1. 1차 진입점을 세 개로 줄인다.  
   추천은 `Ask AI`, `Create`, `Navigate` 세 축이다.

2. Search, Quick Open, Command, AI를 하나의 universal command surface로 수렴한다.  
   지금은 기능이 나뉘어 있지만, 사용자 입장에서는 "무엇을 하고 싶은가"가 먼저다.

3. ChatPanel을 sidecar가 아니라 action console로 재정의한다.  
   단순 대화보다 다음이 보여야 한다.
   - 제안된 변경
   - 영향받는 노드/파일
   - 승인/거절
   - 되돌리기

4. selection-based contextual UI를 강화한다.  
   Excalidraw처럼 선택 상태일 때만 노출되는 action strip을 더 적극적으로 쓰는 편이 좋다.

5. 모바일은 편집 축소판이 아니라 review/approve/capture shell로 설계한다.  
   mobile second에서 중요한 것은 desktop parity가 아니라 핵심 작업 시나리오 최적화다.

### 7.4 모바일 구체 제안

mobile second 관점에서 magam은 Excalidraw처럼 많은 도구를 억지로 넣기보다 다음 흐름에 집중하는 편이 좋다.

- 음성/텍스트로 의도 입력
- AI가 제안한 구조 preview
- 카드/노드 단위 승인
- 코멘트/수정 요청
- 빠른 검색과 점프
- 최소한의 직접 조작

즉, mobile은 "authoring cockpit"이 아니라 "review and steer"에 가깝게 설계하는 편이 더 magam답다.

## 8. 우선순위 제안

### 단기

- `AI + Search + Quick Open` 통합 command surface
- selection/context 기반 액션 재정리
- 모바일 전용 navigation shell 초안 분리
- file truth vs canonical truth에 대한 ADR 수준 결정

### 중기

- canonical mutation backbone 정착
- ChatPanel을 action console로 개편
- agent collaboration 중심 workflow 확립
- plugin runtime과 canonical capability UI 연결 강화

### 장기

- human realtime collaboration 필요 여부 재평가
- 필요 시 Excalidraw식 presence/sync를 참고해 도입
- 다만 scene sync가 아니라 object/canonical mutation sync로 설계

## 최종 판단

Excalidraw는 magam의 경쟁자이면서도 좋은 교과서다. 하지만 교과서의 핵심은 "같이 생긴 UI"가 아니라 "복잡함을 드러내는 방식"에 있다.

magam이 가져와야 할 것은 다음이다.

- 명확한 계층화
- context-sensitive UI
- 모바일 전용 정보구조
- 저장/협업 경계의 선명함

magam이 지켜야 할 고유성은 다음이다.

- AI-first authoring
- code as archive
- canonical object/capability model
- agent collaboration 중심 사고

정리하면, Excalidraw를 reference product로 삼되 product center는 절대 Excalidraw처럼 두지 않는 것이 맞다. magam은 "더 똑똑한 Excalidraw"가 아니라 "AI와 구조화된 지식을 운영하는 canvas OS" 쪽으로 가야 한다.

## 참고한 주요 파일

### Excalidraw

- `/Users/danghamo/Documents/gituhb/excalidraw/README.md`
- `/Users/danghamo/Documents/gituhb/excalidraw/packages/excalidraw/components/App.tsx`
- `/Users/danghamo/Documents/gituhb/excalidraw/packages/excalidraw/components/LayerUI.tsx`
- `/Users/danghamo/Documents/gituhb/excalidraw/packages/excalidraw/components/MobileToolBar.tsx`
- `/Users/danghamo/Documents/gituhb/excalidraw/packages/excalidraw/components/MobileMenu.tsx`
- `/Users/danghamo/Documents/gituhb/excalidraw/packages/excalidraw/components/main-menu/MainMenu.tsx`
- `/Users/danghamo/Documents/gituhb/excalidraw/packages/excalidraw/data/json.ts`
- `/Users/danghamo/Documents/gituhb/excalidraw/excalidraw-app/App.tsx`
- `/Users/danghamo/Documents/gituhb/excalidraw/excalidraw-app/data/LocalData.ts`
- `/Users/danghamo/Documents/gituhb/excalidraw/excalidraw-app/data/localStorage.ts`
- `/Users/danghamo/Documents/gituhb/excalidraw/excalidraw-app/data/firebase.ts`
- `/Users/danghamo/Documents/gituhb/excalidraw/excalidraw-app/collab/Collab.tsx`
- `/Users/danghamo/Documents/gituhb/excalidraw/excalidraw-app/collab/Portal.tsx`
- `/Users/danghamo/Documents/gituhb/excalidraw/excalidraw-app/components/AI.tsx`

### magam

- `README.md`
- `package.json`
- `libs/core/src/renderer.ts`
- `libs/core/src/reconciler/hostConfig.ts`
- `app/features/render/parseRenderGraph.ts`
- `app/features/render/canonicalObject.ts`
- `app/features/editing/editability.ts`
- `app/features/editing/commands.ts`
- `app/features/editing/createDefaults.ts`
- `app/ws/server.ts`
- `app/ws/methods.ts`
- `app/ws/filePatcher.ts`
- `app/hooks/useFileSync.ts`
- `app/components/editor/WorkspaceClient.tsx`
- `app/components/GraphCanvas.tsx`
- `app/components/FloatingToolbar.tsx`
- `app/components/ui/Header.tsx`
- `app/components/ui/Sidebar.tsx`
- `app/components/ui/TabBar.tsx`
- `app/components/chat/ChatPanel.tsx`
- `app/store/chat.ts`
- `libs/cli/README.md`
