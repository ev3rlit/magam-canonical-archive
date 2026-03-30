# Next Surface Design: Post-`group-hover` / Image / Washi

## Purpose

방금 구현된 `group-hover:`와 `ImageNode` / `WashiTapeNode` surface 이후에 남는 후속 확장 방향을 정리한다.

## Status

- `group-hover:`: implemented for `groupId`-backed surfaces
- `ImageNode` `className`: implemented on wrapper/frame surface
- `WashiTapeNode` `className`: implemented on tape body surface

## 1. `group-hover:` next expansion

### Current constraint

- 현재 runtime interaction state는 각 node root의 local state(`hover`, `focus`, `active`)와 store-level `groupId` hover registry로 존재한다.
- `group-hover:`가 의미를 가지려면 "다른 node가 hover 중인지"를 현재 node가 알 수 있어야 한다.
- 현재 그룹 개념은 `groupId`가 있는 mindmap/member 계열에서 우선 동작한다.

### Required runtime surface

일반화된 `group-hover:` 확장을 위해서는 아래 surface가 추가로 필요하다.

1. **Stable group identity**
- 각 node가 styling 관점에서 어떤 group에 속하는지 식별 가능해야 한다.
- 우선 후보는 이미 존재하는 `data.groupId`.
- 단, `groupId`가 없는 일반 canvas object에는 `group-hover:`를 허용하지 않는 편이 안전하다.

2. **Shared interaction registry**
- 현재 `hoveredNodeIdsByGroupId`는 구현돼 있다.
- 다음 단계는 이를 arbitrary container/group abstraction으로 일반화할지 결정하는 것이다.

3. **Interpreter/runtime evaluation rule**
- `group-hover:*` 토큰은 "자기 자신이 아니라 동일 group 내 다른 eligible member가 hovered인지"를 기준으로 active/inactive가 결정되어야 한다.
- 자기 자신 hover를 포함할지 제외할지는 명시적으로 고정해야 한다.
  - 추천: **포함**
  - 이유: Tailwind 사용자의 기대와 가장 가깝고 설명이 단순하다.

4. **Unsupported diagnostics**
- `groupId` 없는 node에서 `group-hover:*`를 쓰면 unsupported diagnostic이 나와야 한다.
- group surface가 있지만 registry가 비활성화된 경우도 조용히 무시하지 않는다.

### Recommended architecture

#### Current rollout

- `BaseNode`가 `data.groupId`가 있는 경우 hover enter/leave 때 store registry를 갱신한다.
- interpreter는 `group-hover`를 별도 interaction layer로 유지하고, grouped node에서만 적용한다.

#### Next rollout question

- `groupId` 없는 일반 canvas subtree도 styling group으로 볼 것인지
- 아니면 `group-hover:`를 계속 explicit group-backed node로 한정할 것인지

### Why not support it immediately everywhere

- 현재 repo의 group 개념은 layout/editing 중심이지 styling group abstraction이 아니다.
- 임의의 container/frame subtree 전체를 styling group으로 해석하기 시작하면 source-of-truth가 불명확해진다.
- 그래서 first cut은 `groupId` 기반 제한 rollout이 맞다.

## 2. `ImageNode` next expansion

### Current state

- `ImageNode`는 wrapper/frame surface에 대해 `className`을 받는다.
- runtime payload는 `BaseNode` 경로를 통해 frame styling에 적용된다.

### Recommended direction

`ImageNode`는 비교적 쉬운 확장 대상이다.

1. `ImageNodeData`에 `className?: string` 추가
2. render/parser/core surface에서 이 필드를 node data로 전달
3. 초기 적용 범위는 **image frame/wrapper styling**으로 제한

### Why wrapper-first

- 현재 `ImageNode`는 이미지 자체보다 wrapper border/padding/shadow가 UX적으로 더 의미 있는 surface다.
- `className`을 wrapper에만 적용해도 `border`, `rounded`, `shadow`, `ring`, interaction variant 대부분이 바로 가치가 있다.
- `<img>` 자체에 utility를 직접 적용하려면 `object-fit`, `filter`, `mix-blend`, crop semantics까지 얽혀서 scope가 불필요하게 커진다.

### Safe initial contract

- 지원: border, radius, shadow, outline/ring, opacity, background, interaction variants
- 비지원: 이미지 픽셀 자체의 blend/filter utility 전반

### Implementation slice

1. core/render surface에 `className` 추가
2. `ImageNodeData` 타입 추가
3. example/quick smoke 추가
4. capability matrix를 `ImageNode: Yes`로 승격

## 3. `WashiTapeNode` next expansion

### Current state

- `WashiTapeNode`는 `className`을 tape body surface에서 직접 소비한다.
- wrapper가 아니라 inner tape surface에 runtime payload가 적용된다.

### Recommended direction

`WashiTapeNode`는 `ImageNode`와 다르게 **wrapper-first보다 tape-surface-first**가 맞다.

#### Option A: outer wrapper `className`

- 장점: 구현이 빠르다.
- 단점: 실제 tape 시각보다 바깥 box에만 영향이 커서 기대치가 낮다.

#### Option B: primary tape surface `className` (Recommended)

- `className`을 내부 tape div 스타일에 매핑한다.
- runtime payload가 `background`, `opacity`, `shadow`, `outline`, 일부 text-related styling을 tape surface에 직접 반영한다.
- 이 방식이 "washi tape를 꾸민다"는 사용자 기대와 맞다.

### Suggested contract

초기 계약은 다음이 안전하다.

- `className`: tape body surface
- optional future: `labelClassName`: overlay text surface

### Rollout warning

- washi는 geometry/texture/pattern이 강해서 모든 utility를 그대로 받으면 preset 의미가 깨질 수 있다.
- 그래서 first cut은 아래만 허용하는 편이 낫다.
  - opacity
  - shadow / ring / outline
  - width/height-like scaling이 아닌 safe visual subset
  - background/tint 계열은 preset과 합성 규칙을 먼저 정해야 한다

## 4. Recommended next order

1. generalized `group-hover:` beyond `groupId`
2. `ImageNode` pixel-surface styling subset
3. `WashiTapeNode` label/tint sub-surface split

이 순서가 맞는 이유:

- `ImageNode`는 이미 BaseNode/runtime 소비 경로가 있어서 입력만 열면 된다.
- `group-hover:`는 구조 설계가 필요하지만 node family 추가보다 제품 가치가 더 크다.
- `WashiTapeNode`는 시각 계약이 가장 까다로워 마지막이 안전하다.

## 5. Explicit non-goal for next slice

- `group-hover:`를 arbitrary container subtree 전체로 일반화하지 않는다.
- `WashiTapeNode`에서 preset/pattern 의미를 덮어쓰는 무제한 styling은 다음 slice에 포함하지 않는다.
