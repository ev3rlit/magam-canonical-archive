# Workspace `className` Runtime

## 1. 배경

현재 Magam은 workspace `.tsx` 안의 `className` 문자열을 통해 Tailwind 유틸리티 스타일을 표현할 수 있다. 하지만 이 지원 방식은 앱 UI용 Tailwind build와 workspace 파일 감시를 직접 연결하고 있어서, 웹 편집 경험과 개발자 경험 모두에 부담을 준다.

직전 단계에서 확인된 직접 원인은 앱 레벨 file sync가 아니라 Tailwind JIT의 `content` 감시였다.

- 당시 `app/tailwind.config.js`가 `../examples/**/*`를 `content`에 포함하고 있었다.
- 그 결과 웹 편집으로 example TSX가 변경되면 Next dev가 CSS/HMR rebuild를 다시 수행했다.
- 사용자가 원하는 것은 "workspace `className`을 강하게 지원하는 것"이지, workspace 파일 변경마다 앱 전체 Tailwind build가 다시 도는 것이 아니다.

`7932903`에서는 이 문제를 완화하기 위해 workspace 파일을 `content`에서 제거하고, dev 시작 시 target dir 기준 Tailwind safelist를 생성하는 중간 단계가 도입되었다.

- 수정: `app/tailwind.config.js`
- 추가: `scripts/generate-tailwind-workspace-safelist.mjs`
- 추가: `app/tailwind.workspace-safelist.cjs`
- 연동: `scripts/dev/app-dev.ts`

이 변경으로 "workspace 파일 수정 시 Next rebuild를 최소화한다"는 단기 목표는 달성했지만, 제품 요구사항의 종착점은 아니다.

## 2. 문제 정의

현재 방식은 아래 두 문제를 동시에 안고 있다.

### 사용자 관점 문제

1. workspace에서 `className`을 자유롭게 바꾸고 싶어도, 지원 범위가 Tailwind build와 safelist 생성 방식에 종속된다.
2. arbitrary value, variant, 동적 조합을 넓게 허용하려면 safelist가 빠르게 비대해지거나 누락 위험이 커진다.
3. 사용자는 "캔버스 객체를 실시간으로 스타일링"하고 싶은데, 실제 구현은 "앱 CSS 빌드가 workspace를 재해석"하는 형태라 피드백 루프가 무겁다.

### 시스템 관점 문제

1. 앱 UI styling과 workspace object styling이 같은 Tailwind build 파이프라인에 묶여 있다.
2. workspace 파일 변경이 앱 dev server rebuild를 유발할 수 있다.
3. class 유틸리티 지원 범위를 넓힐수록 Tailwind config, safelist, watcher 복잡도가 증가한다.
4. build-time CSS 생성 방식은 향후 웹 편집, AI 편집, runtime preview에 필요한 즉시성을 해친다.

## 3. 제품 방향

workspace `className`은 앱 UI용 Tailwind build와 분리된 별도 runtime interpreter 경로로 처리한다.

핵심 방향은 다음과 같다.

- 앱 UI는 기존 Tailwind build를 계속 사용한다.
- workspace object의 `className`은 별도 runtime interpreter가 해석한다.
- workspace 파일 변경은 renderer/WS update만 유발하고, Next CSS rebuild를 직접 유발하지 않아야 한다.
- v1은 build-time 완전 자동 추론보다, 명시적이고 예측 가능한 runtime 해석 경로를 우선한다.
- 초기 PoC는 `Twind` 또는 동급 runtime utility interpreter를 우선 검토한다.

이 문서는 "workspace styling 경로를 Tailwind build에서 분리하는 v1 기능"의 제품 요구사항을 정의한다.

## 4. 목표

1. workspace `className` 변경이 앱 Tailwind rebuild 없이 캔버스 스타일에 반영된다.
2. 앱 UI styling과 workspace styling의 책임 경계를 명확히 분리한다.
3. 사용자가 workspace `.tsx`에서 `className` 기반 스타일링을 계속 사용할 수 있게 한다.
4. v1 범위 안에서 supported utility set과 unsupported syntax가 예측 가능하게 동작한다.
5. 이후 arbitrary value, variant, node coverage를 단계적으로 확장할 수 있는 구조를 만든다.

## 5. 비목표

1. 앱 전체 스타일링 시스템을 Tailwind에서 다른 체계로 교체하지 않는다.
2. 모든 Tailwind utility와 plugin 생태계를 v1에서 완전 호환하지 않는다.
3. workspace `className`을 위해 정적 전체 CSS 번들을 미리 생성하는 방향을 v1 기본 전략으로 채택하지 않는다.
4. runtime interpreter 도입과 동시에 모든 노드/컨테이너 컴포넌트를 한 번에 이관하지 않는다.
5. variant 전체를 v1 필수로 확정하지 않는다. 현재는 제한된 `hover:`/`focus:`/`active:`/`group-hover:`/`dark:`/`md:`/`lg:`/`xl:`/`2xl:` subset만 우선 지원한다.

## 6. 사용자 스토리

- As a workspace author, I want to edit `className` in my `.tsx` file so that canvas styling updates without triggering an app rebuild.
- As an AI-assisted editor user, I want generated `className` strings to render predictably in the canvas so that I can rely on styling suggestions.
- As a maintainer, I want app UI styling and workspace styling to be isolated so that workspace edits do not destabilize Next dev performance.
- As a maintainer, I want unsupported class patterns to fail in a diagnosable way so that styling bugs are easy to trace.
- As a product engineer, I want a narrow v1 runtime styling surface so that we can ship a reliable baseline before broader Tailwind compatibility work.

## 7. 요구사항

### Must Have (P0)

#### P0-1. Styling 책임 분리

- 앱 UI용 Tailwind build는 workspace 파일을 `content` 감시 대상으로 사용하지 않는다.
- workspace object styling은 별도 runtime interpreter 경로를 통해 적용된다.

수용 기준:

- Given dev server가 실행 중이고 workspace 파일이 열려 있을 때
- When workspace TSX의 `className` 문자열만 수정하면
- Then Next CSS/HMR rebuild 없이 workspace update만 반영된다

#### P0-2. class category 중심의 runtime styling

- v1 지원 기준은 특정 node family 이름보다, 현재 styling 또는 size 관련 props를 이미 지원하는 오브젝트 capability를 우선으로 잡는다.
- 즉, 현재 `className` 또는 styling/size props를 통해 시각 변경이 가능한 오브젝트가 runtime class 해석의 1차 대상이다.
- 최소한 PoC 단계에서는 "어떤 오브젝트가 eligible한가"와 "어떤 class category를 우선 지원하는가"가 문서화되어야 한다.
- node family 확장은 2차 문제로 두고, v1은 class category별 예측 가능성을 먼저 확보한다.

수용 기준:

- v1 eligible object 규칙이 문서와 구현에서 일치한다
- eligible object의 `className`은 runtime interpreter를 통해 시각 결과에 반영된다

#### P0-3. 예측 가능한 utility 지원 범위

- v1은 지원하는 utility 범위를 명시한다.
- 지원하지 않는 문법은 조용히 성공한 것처럼 보이지 않아야 한다.
- 최소한 개발자가 문제를 추적할 수 있는 진단 경로가 있어야 한다.
- v1 우선 지원 기준은 "현재 지원 props와 자연스럽게 대응되는 class category"다.

v1 우선 지원 class category:

1. size: `w-*`, `h-*`, `min/max-*` 등 현재 사이즈 변경과 직접 대응되는 범위
2. spacing/layout basics: padding, margin, gap, flex/grid의 기본 배치 범위 중 현재 오브젝트 표면에 안전하게 대응 가능한 범위
3. visual styling basics: background, text color and size, font weight/family/style, tracking, border, radius, opacity
4. shadow/elevation: 일반 shadow 계열과 시각 강조 계열
5. outline/emphasis: 특히 sticker outline처럼 현재 제품에서 자주 쓰는 강조 표현

추가 원칙:

- 현재 지원하는 styling/size props와 의미가 겹치는 class category를 최우선으로 지원한다.
- size와 styling은 v1의 최우선 범위다.
- sticker outline, shadow, border emphasis처럼 사용자 체감이 큰 표현은 별도 검토 항목이 아니라 우선 검토 대상이다.

수용 기준:

- 지원 utility 카테고리와 제외 항목이 문서화된다
- unsupported class 패턴 발생 시 디버그 로그 또는 일관된 진단 경로가 제공된다

#### P0-4. 기존 safelist 완화책과의 호환

- runtime interpreter가 완전히 대체되기 전까지, 현재 safelist 기반 완화책은 롤백 없이 공존할 수 있어야 한다.
- 전환 단계에서 dev bootstrap이 깨지지 않아야 한다.
- 이 공존성은 문서 설명 수준이 아니라, 실제 dev 실행/검증 플로우에서 계속 확인되어야 한다.

수용 기준:

- runtime 경로를 켠 상태와 끈 상태 모두 dev 실행이 가능하다
- 기존 `7932903` 기반 개발 플로우가 회귀하지 않는다
- safelist 생성/bootstrap 경로가 runtime 도입 때문에 깨지지 않는다

#### P0-5. 캐시와 업데이트 일관성

- 같은 workspace 파일에서 `className` 변경 시 해석 결과가 stale cache 없이 갱신되어야 한다.
- 동일 class 조합은 재사용 가능해야 하지만, 파일 변경이 반영되지 않는 일은 없어야 한다.

수용 기준:

- 동일 session에서 `className`을 연속 수정하면 최신 값 기준으로 스타일이 반영된다
- 이전 class 해석 결과가 잘못 남아 시각 상태가 꼬이지 않는다

### Nice to Have (P1)

- arbitrary value 일부 지원 (`w-[320px]`, `bg-[#1f2937]` 등)
- variant 추가 확장 (`peer-hover:` 등 상호작용 variant와 더 넓은 responsive subset)
- runtime class 결과 캐시 최적화
- 지원되지 않는 class를 UI에서 더 직접적으로 노출하는 개발자 도구

### Future Considerations (P2)

- Tailwind plugin 호환 범위 확대
- node/component별 styling capability schema
- workspace-level theme/token bridge
- server-side precomputation과 client-side runtime 해석의 혼합 전략

## 8. 기술 방향 제안

### 8.1 경계 분리

- 앱 UI styling: 기존 `app/tailwind.config.js`와 build-time Tailwind CSS 유지
- workspace styling: renderer/canvas 레이어에서 `className`을 runtime 해석

### 8.2 후보 아키텍처

1. Workspace render 단계에서 `className` 문자열을 interpreter에 전달한다.
2. interpreter는 style object 또는 atomic CSS rule 결과를 반환한다.
3. 반환 결과를 canvas node DOM에 적용한다.
4. 앱 UI styling 경로와 workspace styling 경로는 설정과 캐시를 분리한다.

### 8.3 PoC 우선안

- `Twind` 기반 PoC를 먼저 수행한다.
- 이유:
  - runtime 해석 경로를 빠르게 검증할 수 있다.
  - utility coverage와 arbitrary value 실험이 비교적 쉽다.
  - "workspace 변경이 build를 건드리지 않는다"는 핵심 가설을 검증하기 좋다.

PoC 종료 시 확인해야 할 것:

1. 실제 node DOM 적용이 충분히 단순한가
2. 현재 node/component 구조와 충돌이 없는가
3. class 변경 빈도가 높을 때 성능 비용이 허용 범위인가
4. variant/arbitrary value 확장 경로가 현실적인가

## 9. 성공 지표

### Leading Indicators

1. dev 중 workspace `className` 수정 시 Next rebuild 발생률이 사실상 0에 수렴한다.
2. v1 대상 node family에서 `className` 적용 성공률이 높게 유지된다.
3. 지원 범위 내 class 사용 시 스타일 반영 실패 보고가 현저히 줄어든다.

### Lagging Indicators

1. 사용자가 workspace styling을 위해 별도 prop이나 우회 패턴을 덜 사용한다.
2. AI가 생성한 `className` 제안이 실제 렌더 결과로 이어지는 비율이 높아진다.
3. safelist 유지보수 부담이 줄어들고, Tailwind config 변경 빈도가 감소한다.

## 10. 오픈 질문

### Blocking

1. v1에서 arbitrary value를 어디까지 지원할 것인가
2. 현재 지원하는 `hover:`/`focus:`/`active:`/`group-hover:`/`dark:`/`md:`/`lg:`/`xl:`/`2xl:` 이후에 어떤 pseudo/responsive variant까지 확장할 것인가
3. class category별로 "현재 지원 props와 1:1 대응되는 범위"를 어디까지 볼 것인가
4. runtime interpreter 결과를 inline style 중심으로 적용할지, 별도 stylesheet 삽입으로 적용할지 무엇이 더 안전한가

## 10.1 Current Capability Matrix

| Surface | `className` input surface | Runtime base style | Runtime hover/focus | Responsive variants | Notes |
| --- | --- | --- | --- | --- | --- |
| `TextNode` | Yes | Yes | Yes | Yes | `app/components/nodes/TextNode.tsx` routes through `BaseNode` and carries `data.className`. |
| `MarkdownNode` | Yes | Yes | Yes | Yes | `app/components/nodes/MarkdownNode.tsx` uses `BaseNode` with `data.className`. |
| `ShapeNode` | Yes | Yes | Yes | Yes | `app/components/nodes/ShapeNode.tsx` uses `BaseNode` for both triangle and regular shape paths. |
| `StickyNode` | Yes | Yes | Yes | Yes | `app/components/nodes/StickyNode.tsx` passes `raw.className` through `BaseNode`. |
| `StickerNode` | Yes | Yes | Yes | Yes | `app/components/nodes/StickerNode.tsx` exposes `className` in data and renders through `BaseNode`. |
| `WashiTapeNode` | Yes | Yes | Yes | Yes | `app/components/nodes/WashiTapeNode.tsx` now applies runtime payloads on the inner tape surface instead of only the outer wrapper. |
| `ImageNode` | Yes | Yes | Yes | Yes | `app/components/nodes/ImageNode.tsx` now accepts `className` on the image frame/wrapper surface. |
| `SequenceDiagramNode` | Yes | Yes | Yes | Yes | `app/components/nodes/SequenceDiagramNode.tsx` now routes its outer frame through `BaseNode`, so runtime payload applies to the diagram container. |

## 10.2 Latest Runtime Smoke

- Added `examples/runtime_interactions.tsx` as the dedicated manual smoke surface for `hover:`, `focus:`, `active:`, and wider responsive variants.
- `group-hover:` is currently enabled only for `groupId`-backed surfaces, which in practice means grouped/mindmap-derived node families.
- Browser smoke on 2026-03-16 confirmed hover and focus state changes on the live canvas at `http://localhost:3005`.
- Hover diff versus baseline: `2.70%` pixels changed after hovering `Hover Surface`.
- Focus diff versus baseline: `2.70%` pixels changed after focusing the sticky surface, and the active element resolved to a `DIV` with `tabIndex=0`.
- Active diff versus baseline: `0.73%` pixels changed while pointer press was held on `Hover + Focus + Active + Responsive`.

## 10.3 Follow-On Design

- Remaining follow-on design after the current rollout is captured in `docs/features/workspace-classname-runtime/next-surface-design.md`.

### Non-Blocking

1. `Twind`가 최종 선택인지, PoC 이후 다른 interpreter로 교체 가능한 abstraction이 필요한가
2. 지원 범위를 class category 단위로 문서화할지, component capability matrix로 문서화할지
3. unsupported class 진단을 로그만으로 충분히 볼지, UI debug surface가 필요한지

## 11. 단계 제안

### Phase 0. Baseline 정리

- `7932903`의 safelist 완화책을 유지하고, runtime 도입 이후에도 bootstrap/dev 검증 경로를 계속 확인한다.
- 남아 있는 dirty example 또는 샘플 파일 처리 방식을 정리한다.
- 현재 `className` 사용 지점과, styling/size props를 가진 eligible object surface를 목록화한다.

### Phase 1. Runtime PoC

- `Twind` 기반 최소 interpreter를 붙인다.
- eligible object surface에 대해 class category 중심 runtime class 적용을 연결한다.
- workspace 파일 수정 시 rebuild 없이 시각 업데이트되는지 재검증한다.

### Phase 2. 지원 범위 고정

- v1 utility subset을 class category 기준으로 고정한다.
- unsupported syntax 진단 경로를 정리한다.
- 캐시 정책과 성능 한계를 측정한다.

### Phase 3. 제품화

- 대상 node family를 넓힌다.
- 기존 safelist 의존도를 축소하거나 제거한다.
- 문서와 QA 시나리오를 업데이트한다.

## 12. 관련 파일

- `app/hooks/useFileSync.ts`
- `app/components/GraphCanvas.tsx`
- `app/components/GraphCanvas.drag.ts`
- `app/components/editor/workspaceEditUtils.ts`
- `app/components/FloatingToolbar.tsx`
- `app/tailwind.config.js`
- `scripts/dev/app-dev.ts`
- `scripts/generate-tailwind-workspace-safelist.mjs`
- `app/tailwind.workspace-safelist.cjs`

## 13. 다음 세션 시작 포인트

다음 세션에서는 아래 순서로 바로 이어간다.

1. `7932903`의 취급 방식을 결정한다.
2. workspace `className` runtime 적용 대상 컴포넌트 우선순위를 확정한다.
3. `Twind` 기반 PoC를 붙여 "workspace 변경은 rebuild를 유발하지 않는다"는 가설을 재검증한다.
4. 이후 v1 utility/variant/arbitrary value 지원 범위를 고정한다.
