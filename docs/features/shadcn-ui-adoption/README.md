# shadcn/ui 도입 전략

## 개요

이 문서는 magam 앱에 `shadcn/ui`를 도입할 때의 범위, 원칙, 교체 대상, 토큰 통일 작업, 단계별 실행 순서를 정의합니다.

현재 앱은 이미 `Next.js + Tailwind + CSS variables + Lucide + app/components/ui` 구조를 갖추고 있어서 `shadcn/ui`를 받아들이기 좋은 상태입니다. 다만 도입 방식은 전면 교체가 아니라, 앱 셸과 표준 인터랙션 계층에 한정한 선택적 도입이어야 합니다.

핵심 원칙은 다음과 같습니다.

- 제품 고유 영역인 캔버스 렌더링과 노드 표현은 bespoke UI로 유지한다.
- 표준 앱 UI는 `shadcn/ui`의 접근성, 구조, 상태 패턴을 기준으로 재정렬한다.
- 새 컴포넌트를 붙이기 전에 토큰 체계를 먼저 통일한다.
- `shadcn/ui` 예제를 그대로 복붙하지 않고 현재 테마/상태/레이아웃 경계에 맞게 흡수한다.

## 왜 도입하는가

현재 UX 품질이 들쭉날쭉한 핵심 원인은 컴포넌트 레벨의 품질 기준이 화면마다 다르기 때문입니다.

- 일부 화면은 현재 테마 토큰과 다른 클래스 체계를 사용한다.
- 버튼, 입력, 토글, 카드, 메뉴가 페이지별로 조금씩 다르게 구현되어 있다.
- 접근성 기본값이 빠진 요소가 있다.
- 상호작용 밀도와 레이아웃 간격이 일관되지 않다.

`shadcn/ui`는 이 문제를 해결하는 데 적합합니다.

- 접근성과 구조가 정리된 기본 패턴을 제공한다.
- 프로젝트 내부에 컴포넌트를 소유하는 방식이라 현재 `app/components/ui` 구조와 잘 맞는다.
- Tailwind + CSS variable 기반이라 현재 테마 방식과 결합하기 쉽다.
- Sidebar, Dialog, Dropdown Menu, Command, Tabs, Sheet, Form 계열에서 특히 효과가 크다.

## 도입 범위

### 포함

- 워크스페이스 대시보드
- 워크스페이스 상세 화면
- 앱 셸 헤더/사이드바/패널
- 채팅 패널 및 관련 표준 컨트롤
- 검색, 퀵오픈, 컨텍스트 메뉴, 다이얼로그, 시트, 토스트
- 폼 입력, 선택, 탭, 배지, 카드, 테이블형 정보 표현

### 제외

- `GraphCanvas`
- 노드 렌더링 (`StickyNode`, `ShapeNode`, `MarkdownNode`, `StickerNode` 등)
- React Flow 기반 캔버스 오버레이의 핵심 좌표/드래그 인터랙션
- 캔버스 안에서만 의미가 있는 도메인 특화 프레젠테이션 로직

즉, `shadcn/ui`는 "앱 셸 표준화"를 위한 도입이고, "제품 전체의 렌더링 시스템 교체"가 아닙니다.

## 현재 구조에서의 적합성 평가

### 적합한 이유

- `app/app/globals.css` 에 이미 CSS variable 기반 색상 토큰이 존재한다.
- `app/tailwind.config.js` 가 semantic color alias 를 확장하고 있다.
- `app/components/ui` 에 이미 primitive 계층이 존재해 단계적 교체가 가능하다.
- `lucide-react` 를 이미 사용하고 있다.
- `app` 패키지가 독립된 Next.js 앱이라 `shadcn/ui` CLI 구성 범위를 제한하기 쉽다.

### 주의할 점

- 현재 `background/foreground/card/border` 계열과 `surface/on-surface` 계열이 혼재한다.
- 일부 화면은 토큰 정의 없이 Material 3 스타일 이름을 직접 사용하고 있다.
- 이미 존재하는 커스텀 `ThemeProvider` 와 충돌하지 않도록 다크모드 연동 방식을 유지해야 한다.
- `shadcn/ui` 기본 스타일만 쓰면 캔버스 제품 특유의 인상이 약해질 수 있다.

## 도입 원칙

### 1. Primitive 우선 교체

먼저 공통 primitive 를 정리하고, 그 다음 화면 단위로 확산합니다.

- `Button`
- `Input`
- `Textarea`
- `Select`
- `Badge`
- `Card`
- `Dialog`
- `Dropdown Menu`
- `Tooltip`
- `Tabs`
- `Command`
- `Sheet`

### 2. 표준 인터랙션 우선

다음 조건을 만족하는 UI부터 우선 교체합니다.

- 폼/입력 중심
- 모달/오버레이 중심
- 탐색/전환 중심
- 키보드 접근성이 중요한 UI

### 3. Canvas Bespoke 유지

캔버스 내부의 시각 언어는 현재 제품 고유성이 있는 영역이므로 `shadcn/ui`로 평탄화하지 않습니다.

### 4. Generated Code는 시작점일 뿐

`shadcn/ui`에서 가져온 코드는 최종본이 아닙니다.

- 현재 토큰 이름에 맞게 수정
- 현재 `cn` 유틸과 import 경로에 맞게 수정
- 기존 상태 모델과 이벤트 경계에 맞게 수정
- 필요 없는 variant 나 props 는 줄이기

## 교체 대상 컴포넌트 목록

아래는 현재 코드 기준의 우선 교체/재구성 후보입니다.

| 우선순위 | 현재 파일 | 권장 방향 | 비고 |
|---|---|---|---|
| P0 | `app/components/ui/Button.tsx` | shadcn `button` 기반 재구성 | 전체 화면에 영향 |
| P0 | `app/components/ui/Input.tsx` | shadcn `input`/`textarea` 패턴 흡수 | 폼 품질 기준점 |
| P0 | `app/components/ui/Select.tsx` | shadcn `select` 또는 `native select` 기준으로 재구성 | 현재 native select 래퍼 단순화 필요 |
| P0 | `app/components/ui/Card.tsx` | shadcn `card` 계열 구조로 정리 | 카드 헤더/콘텐츠 계층 일관화 |
| P0 | `app/components/ui/Menu.tsx` | shadcn `dropdown-menu`/`context-menu` 로 분리 | 현재 menu 추상화가 넓고 모호함 |
| P1 | `app/components/ui/Sidebar.tsx` | shadcn `sidebar` 패턴 참고해 재구성 | 워크스페이스 셸 중심 |
| P1 | `app/components/ui/QuickOpenDialog.tsx` | shadcn `command` + `dialog` 조합으로 정리 | 검색/커맨드 품질 개선 |
| P1 | `app/components/ui/SearchOverlay.tsx` | `command`, `dialog`, `input` 조합 사용 | 키보드 UX 강화 |
| P1 | `app/components/ui/ErrorOverlay.tsx` | `alert-dialog` 또는 `dialog` 패턴 검토 | 오류 노출 일관화 |
| P1 | `app/components/chat/ChatInput.tsx` | field/button/menu/select 조합 정리 | 상호작용 밀도 개선 |
| P1 | `app/components/chat/ChatPanel.tsx` | sheet/panel 구조 정리 | 레이아웃/상태 정돈 |
| P1 | `app/features/workspace/components/DashboardHeader.tsx` | input/button/toggle-group 기반 재구성 | 접근성 누수 해소 |
| P1 | `app/features/workspace/components/DashboardSidebar.tsx` | sidebar/navigation-menu 패턴 흡수 | 탐색 구조 정리 |
| P1 | `app/features/workspace/components/WorkspaceCard.tsx` | card/badge/button-link 패턴 정리 | 클릭 가능한 div 제거 |
| P1 | `app/features/workspace/components/WorkspaceListItem.tsx` | list row 패턴 정리 | 키보드/hover 상태 정리 |
| P2 | `app/components/ui/Header.tsx` | primitive 교체 후 미세조정 | 현재 구조는 비교적 양호 |
| P2 | `app/components/ui/Footer.tsx` | badge/separator/text token 정리 | 정보 밀도만 다듬기 |
| P2 | `app/components/ui/Badge.tsx` | shadcn `badge` 스타일과 토큰 통합 | 영향 낮음 |

## 새로 도입할 shadcn/ui 후보

현재 프로젝트에서 실제 가치가 큰 후보만 정리합니다.

- `button`
- `input`
- `textarea`
- `label`
- `select`
- `dialog`
- `alert-dialog`
- `dropdown-menu`
- `context-menu`
- `tooltip`
- `tabs`
- `sheet`
- `separator`
- `badge`
- `card`
- `command`
- `skeleton`
- `scroll-area`

필요 시 검토:

- `table`
- `popover`
- `collapsible`
- `hover-card`
- `breadcrumb`
- `drawer`

초기 도입에서 제외:

- chart 류
- calendar/date picker 류
- data table 대형 세트
- canvas 내부에만 쓰이는 복잡한 커스텀 제어

## 토큰 통일 작업

`shadcn/ui` 도입 전에 가장 먼저 해야 할 일은 토큰 통일입니다.

### 현재 문제

- `globals.css` 에는 `background`, `foreground`, `card`, `border`, `primary` 계열이 있다.
- 일부 워크스페이스 화면은 `surface`, `on-surface`, `surface-container-*`, `primary-container` 같은 별도 체계를 쓴다.
- 타입 스케일도 `text-sm`, `text-xs` 와 `text-headline-md`, `text-body-md` 식 이름이 혼재한다.

이 상태에서는 어느 컴포넌트를 도입해도 화면 간 시각 일관성이 유지되지 않습니다.

### 통일 원칙

- `shadcn/ui` 기본 semantic 토큰 이름을 기준으로 삼는다.
- 현재 제품에서 꼭 필요한 추가 토큰만 별도 확장한다.
- "화면별 전용 클래스 이름" 대신 "의미 기반 토큰" 으로 수렴한다.

### 권장 토큰 기준

#### Core semantic color

- `background`
- `foreground`
- `card`
- `card-foreground`
- `popover`
- `popover-foreground`
- `muted`
- `muted-foreground`
- `border`
- `input`
- `ring`
- `primary`
- `primary-foreground`
- `secondary`
- `secondary-foreground`
- `destructive`
- `destructive-foreground`
- `accent`
- `accent-foreground`

#### Product extension token

캔버스 제품 특성을 위해 아래 정도만 추가 유지합니다.

- `success`
- `success-foreground`
- `canvas-grid`
- `selection-glow`
- `overlay-scrim`
- `node.sticky`
- `node.surface`
- `node.border`
- `node.text`

### 정리 대상

아래 클래스/토큰은 제거 또는 매핑 대상입니다.

- `bg-surface`
- `text-on-surface`
- `text-on-surface-variant`
- `bg-surface-container`
- `bg-surface-container-low`
- `bg-surface-container-lowest`
- `bg-surface-container-high`
- `bg-surface-container-highest`
- `from-primary to-primary-container`
- `text-headline-md`
- `text-headline-sm`
- `text-title-lg`
- `text-body-md`
- `text-label-md`
- `font-inter`
- `font-manrope`

### Typography 통일 방향

- 본문 기본은 `font-family-ui`
- 강조 헤딩은 `font-family-display`
- Tailwind utility 는 의미 있는 최소 세트만 유지
- 화면별로 임의의 font class 를 직접 붙이지 않도록 공통 primitive 안에서 흡수

권장 타입 스케일:

- `text-xs`
- `text-sm`
- `text-base`
- `text-lg`
- `text-xl`
- `text-2xl`

필요 시 semantic alias:

- `text-ui-label`
- `text-ui-body`
- `text-ui-title`
- `text-ui-heading`

### Radius / Shadow / Spacing 정리

현재도 토큰화가 어느 정도 되어 있으므로 naming 만 안정화합니다.

- radius: `sm`, `md`, `lg`, `xl`, `full`
- shadow: `raised`, `floating`, `node`
- spacing: 4px 기반 유지
- motion duration: `fast`, `base`

## 단계별 실행 전략

### Phase 1. 토큰 정리

목표:

- `globals.css` 와 `tailwind.config.js` 의 토큰 기준을 단일화한다.
- 워크스페이스 화면에서 쓰는 비표준 토큰을 정리한다.

작업:

- `surface/on-surface` 계열을 `background/card/muted/foreground` 체계로 매핑
- `primary-container` 제거 또는 `accent` 계열로 재배치
- typography alias 정리
- 필요 없는 유틸 class naming 제거

완료 조건:

- 새 화면은 `surface-*` 토큰 없이 작성 가능
- 워크스페이스 화면과 기본 `ui` primitive 가 동일 토큰 체계를 공유

### Phase 2. Primitive 교체

목표:

- 공통 UI 품질 기준을 `app/components/ui` 에서 확정한다.

작업:

- `Button`, `Input`, `Select`, `Card`, `Badge` 재구성
- `Dialog`, `Dropdown Menu`, `Tooltip`, `Command`, `Sheet` 도입
- 접근성 기본값 정리

완료 조건:

- 새 화면이 primitive 조합만으로 일관되게 구현 가능
- 클릭 가능한 `div`, 라벨 없는 icon button, 페이지별 임의 input 스타일 감소

### Phase 3. Workspace Shell 적용

목표:

- 워크스페이스 대시보드/상세/사이드바를 새 기준으로 정리한다.

작업:

- `DashboardHeader`
- `DashboardSidebar`
- `WorkspaceCard`
- `WorkspaceListItem`
- `CanvasCard`
- `CanvasListItem`

완료 조건:

- 대시보드 계열 화면이 동일한 간격, 상태, 폰트, 토큰 규칙을 사용

### Phase 4. Overlay / Chat 적용

목표:

- 검색, 퀵오픈, 채팅 패널, 메뉴 계열을 정리한다.

작업:

- `SearchOverlay`
- `QuickOpenDialog`
- `ChatInput`
- `ChatPanel`
- 오류/확인 다이얼로그

완료 조건:

- 오버레이 계층의 시각 언어와 키보드 인터랙션이 통일

### Phase 5. Hardening

목표:

- 시각 통일 이후 접근성과 회귀 리스크를 줄인다.

작업:

- icon button `aria-label` 점검
- input label / description / error text 점검
- keyboard navigation 점검
- dark mode / contrast 점검
- 모바일 폭과 좁은 패널 레이아웃 점검

## 파일/디렉토리 제안

`shadcn/ui` 도입 시 권장 구조:

- `app/components/ui/*`
- `app/lib/utils.ts` 또는 기존 `app/utils/cn.ts` 유지
- `app/app/globals.css`
- `app/tailwind.config.js`
- `app/components.json`

권장 사항:

- `shadcn/ui` generated file 도 프로젝트 구조에 맞게 `app/components/ui` 로 수용
- `cn` 유틸은 기존 구현을 재사용
- `components.json` 은 `app` 패키지 기준으로만 관리

## 리스크

### 1. 반쯤 섞인 상태가 오래 지속될 위험

primitive 일부만 교체하고 화면 토큰을 방치하면 더 혼란스러워질 수 있습니다.

대응:

- 토큰 정리를 먼저 수행
- 화면 적용은 feature slice 단위로 마무리

### 2. 캔버스 제품성이 평범해질 위험

앱 셸은 정돈되지만 제품의 개성이 약해질 수 있습니다.

대응:

- 캔버스 내부는 bespoke 유지
- 브랜드 감도는 셸의 색/타이포/모션에서 제한적으로 반영

### 3. generated code 과다 유입 위험

불필요한 variant 와 의존성이 늘어날 수 있습니다.

대응:

- 필요한 컴포넌트만 도입
- 각 primitive 마다 public surface 를 최소화

## 성공 기준

- 워크스페이스/채팅/검색/오버레이가 동일한 primitive 집합으로 구성된다.
- 비표준 토큰인 `surface-*`, `on-surface-*`, `primary-container` 사용이 제거되거나 명확히 축소된다.
- 클릭 가능한 `div` 와 라벨 없는 인터랙션 요소가 제거된다.
- 새 UI를 만들 때 "페이지별 개별 스타일링"보다 "primitive 조합"이 기본 경로가 된다.
- 캔버스 내부 고유 UX는 손상되지 않는다.

## 최종 권장안

magam 에서 `shadcn/ui`는 도입 가치가 높습니다. 다만 제품 전면 교체가 아니라 다음 순서로 추진하는 것이 가장 안전합니다.

1. 토큰 체계 먼저 통일
2. 공통 primitive 정리
3. 워크스페이스 셸 적용
4. 오버레이/채팅 적용
5. 캔버스 내부는 별도 유지

즉, 이번 도입의 목표는 "예쁜 UI 라이브러리 도입"이 아니라 "앱 셸의 구조, 접근성, 상태 표현을 안정된 기준으로 정렬하는 것"입니다.
