# 기능 명세: 표준화된 사이즈 언어

**기능 브랜치**: `001-standardized-sizes`  
**작성일**: 2026-03-05  
**상태**: Draft  
**입력**: 사용자 설명: "xs-xl 토큰과 단일 prop 계약으로 노드 사이즈를 표준화하고, Markdown 1D/2D 동시 지원, 일관된 warning+fallback 동작, 명시적 범위 제외를 포함한다."

## 확인 사항

### 세션 2026-03-05

- Q: 미지원 토큰 fallback 정책은 무엇인가? → A: 카테고리 기본값으로 fallback (`typography=m`, `space=m`, `object2d=auto`).
- Q: 미지원 레거시 사이즈 API는 런타임에서 어떻게 처리하는가? → A: warning을 남기고 해당 입력을 무시한다(하드 에러 없음).
- Q: 2D 사이즈 입력이 충돌하면 어떻게 처리하는가? → A: invalid로 처리하고 warning 후 카테고리 기본값으로 fallback한다.
- Q: 숫자 호환 범위는 어디까지인가? → A: `fontSize={number}`, `Markdown size={number}`, `Sticky/Shape size={number}`를 허용하며, 2D 구조화된 width/height 숫자 입력도 함께 지원한다. `Sticky/Shape size={number}`는 primitive token과 동일한 해석 경로(컴포넌트 기본 ratio)를 따른다.
- Q: 2D size ratio의 공식 값은 무엇인가? → A: `landscape | portrait | square`만 허용한다.

## 기본 수치 기준

`m`은 typography에서 `1rem(16px)`를 기준으로 잡고, 2D는 같은 리듬으로 확장한다.

| Token | Typography (Tailwind) | Line Height | Space | Object2D Landscape (W x H) | Object2D Square |
| ----- | --------------------- | ----------- | ----- | -------------------------- | --------------- |
| `xs`  | `text-xs` = 12px      | 16px        | 8px   | 128 x 80                   | 80 x 80         |
| `s`   | `text-sm` = 14px      | 20px        | 12px  | 160 x 96                   | 96 x 96         |
| `m`   | `text-base` = 16px    | 24px        | 16px  | 192 x 120                  | 120 x 120       |
| `l`   | `text-lg` = 18px      | 28px        | 24px  | 256 x 160                  | 160 x 160       |
| `xl`  | `text-xl` = 20px      | 28px        | 32px  | 320 x 200                  | 200 x 200       |

- `portrait`는 `landscape`의 폭/높이를 스왑해 계산한다.
- 2D 기본 ratio는 `landscape`이며, 도형 타입 정책에 따라 `square`를 기본으로 쓰는 경우가 있다.

## 사용자 시나리오 및 테스트 _(필수)_

### 사용자 스토리 1 - 핵심 노드에서 의미 기반 사이즈 사용 (우선순위: P1)

콘텐츠 작성자는 텍스트/블록 노드를 만들 때 raw 숫자를 기억하지 않고 의도 기반(`xs`~`xl`)으로 크기를 선택할 수 있다.

**우선순위 이유**: 이 기능의 핵심 가치이며 표준 사이즈 언어 도입의 직접적인 목적이다.

**독립 테스트**: 지원 대상 노드를 의미 토큰만으로 생성해 시각 위계가 숫자 미세 조정 없이 일관되게 형성되는지 검증할 수 있다.

**수용 시나리오**:

1. **Given** 작성자가 지원되는 텍스트 콘텐츠를 편집 중일 때, **When** 의미 기반 사이즈 라벨을 선택하면, **Then** 렌더 결과가 기대한 위계 레벨을 반영한다.
2. **Given** 작성자가 지원되는 2D 블록을 편집 중일 때, **When** 서로 다른 노드 타입에 동일한 의미 토큰을 적용하면, **Then** 모듈러 스케일이 일관되게 적용된다.

---

### 사용자 스토리 2 - Markdown을 단일 사이즈 인터페이스로 제어 (우선순위: P2)

콘텐츠 작성자는 입력 형태에 따라 Markdown의 텍스트 밀도(1D)와 블록 치수(2D)를 하나의 size 인터페이스로 제어할 수 있다.

**우선순위 이유**: Markdown은 사용 빈도가 높은 작성 표면이며, 분리된 옵션 없이 가독성과 영역 제어를 함께 제공해야 한다.

**독립 테스트**: 단일 값 입력으로 Markdown 텍스트 밀도를 바꾸고, 상세 입력으로 Markdown 블록 치수를 바꾼 뒤 하나의 size 진입점으로 두 동작이 모두 동작하는지 검증할 수 있다.

**수용 시나리오**:

1. **Given** Markdown 블록이 있을 때, **When** 작성자가 단일 size 값을 입력하면, **Then** 시스템은 사전 정의된 1D 모듈러 스케일을 적용해 텍스트 밀도를 조정한다.
2. **Given** Markdown 블록이 있을 때, **When** 작성자가 상세 size 값을 입력하면, **Then** 시스템은 동일한 의미 토큰 언어로 2D width/height 사이징을 적용한다.

---

### 사용자 스토리 3 - 범위와 fallback 동작을 예측 가능하게 유지 (우선순위: P3)

제품 팀은 미지원 레거시 API를 명확히 배제하고 미지원 토큰 처리 방식을 일관되게 유지함으로써 기능을 안전하게 롤아웃할 수 있다.

**우선순위 이유**: 범위 경계와 오류 동작의 예측 가능성이 높을수록 롤아웃 혼선과 지원 비용이 줄어든다.

**독립 테스트**: 미지원 레거시 입력과 미지원 토큰을 실제로 넣어 보고, 문서화된 범위 경계와 warning+fallback 동작이 일치하는지 검증할 수 있다.

**수용 시나리오**:

1. **Given** 사용자가 미지원 토큰을 입력했을 때, **When** 콘텐츠가 렌더되면, **Then** 시스템은 warning을 남기고 모든 환경에서 동일한 fallback 동작을 적용한다.
2. **Given** 사용자가 통일 계약 바깥의 레거시 실험 API 사용을 시도할 때, **When** 최신 문서/예제를 따르면, **Then** 해당 API는 지원 옵션으로 제시되지 않는다.
3. **Given** 입력 콘텐츠에 미지원 레거시 사이즈 API가 남아 있을 때, **When** 렌더링하면, **Then** 시스템은 warning을 남기고 레거시 입력을 무시한다.
4. **Given** 2D size 입력에 충돌 모드가 동시에 포함될 때, **When** 렌더링하면, **Then** 시스템은 해당 입력을 invalid로 처리하고 warning 후 카테고리 기본값 fallback을 적용한다.
5. **Given** Sticky 또는 Shape에 primitive numeric size 입력이 들어올 때, **When** 렌더링하면, **Then** 시스템은 해당 입력을 지원하고 primitive token과 동일한 규칙(컴포넌트 기본 ratio)으로 해석한다.
6. **Given** 시퀀스 다이어그램과 스티커에 본 기능을 적용할 때, **When** 범위를 확인하면, **Then** 시퀀스 다이어그램 size 토큰화는 범위 밖이며 스티커는 콘텐츠 기반 사이즈를 유지한다.

---

### 엣지 케이스

- size 토큰이 미정의이거나 오탈자일 때 어떻게 동작하는가?
- 미정의/오탈자 토큰은 warning을 남기고 카테고리 기본값(`typography=m`, `space=m`, `object2d=auto`)으로 fallback해야 한다.
- Markdown에 2D를 의도했지만 단일 size 값이 전달된 경우 시스템은 어떻게 동작하는가?
- 정사각 기준 도형에서 사용자가 충돌하는 orientation 의도를 전달하면 어떻게 처리하는가?
- 2D ratio 값이 `landscape | portrait | square` 외 값이면 어떻게 처리하는가?
- 미지원 ratio 값은 warning을 남기고 기본 ratio(`landscape`)로 fallback해야 한다.
- 하나의 2D 입력에서 의미 토큰과 숫자 치수를 혼합하면 어떻게 동작하는가?
- 하나의 입력에 2D 충돌 모드가 있으면 invalid로 처리하고 warning + 카테고리 기본값 fallback으로 해석해야 한다.
- Sticky/Shape에 primitive numeric `size`가 전달되면 어떻게 처리하는가?
- Sticky/Shape의 primitive numeric `size`는 지원되며, primitive token과 동일한 규칙(컴포넌트 기본 ratio)으로 해석한다.
- 통일 계약 밖의 레거시 실험 사이즈 API가 들어오면 렌더링은 어떻게 동작하는가?
- 미지원 레거시 실험 사이즈 API 입력은 warning을 남기고 무시해야 하며 렌더링을 깨뜨리면 안 된다.

## 요구사항 _(필수)_

### 기능 요구사항

- **FR-001**: 시스템은 지원 대상 1D/2D 사이징에 대해 의미 기반 사이즈 어휘(`xs`, `s`, `m`, `l`, `xl`)를 제공해야 한다.
- **FR-002**: 시스템은 통일 계약 범위 내 숫자 입력 호환을 유지해야 한다(`fontSize={number}`, `Markdown size={number}`, `Sticky/Shape size={number}`, 구조화된 2D width/height 숫자 입력 허용).
- **FR-003**: 시스템은 컴포넌트 패밀리별로 단일 size 진입점을 제공해 중복/경쟁 사이즈 prop을 피해야 한다.
- **FR-004**: 시스템은 지원 블록 컴포넌트에서 의미 토큰 preset과 orientation 의도를 사용한 모듈러 2D 사이징을 지원해야 하며, `auto` 토큰(또는 size 미지정)일 때 콘텐츠 기반 자동 크기를 사용해야 한다.
- **FR-004A**: 시스템은 2D orientation 의도값으로 `landscape | portrait | square`만 허용해야 한다.
- **FR-005**: 시스템은 사용자가 하나의 의미 값으로 width/height를 동시에 설정할 수 있어야 한다.
- **FR-006**: 시스템은 사용자가 preset이 아닌 커스텀 치수가 필요할 때 명시적 width/height 값을 제공할 수 있어야 한다.
- **FR-007**: Markdown은 단일 size 인터페이스에서 1D/2D를 모두 지원해야 하며, 단일 값 입력은 1D 모듈러 스케일로, 상세 입력은 2D 사이징으로 해석해야 한다.
- **FR-008**: 시퀀스 다이어그램 size 토큰화는 본 기능 버전 범위에서 제외되어야 한다.
- **FR-009**: Sticker 사이징은 콘텐츠 기반으로 유지되어야 하며 2D size token 대상에서 제외되어야 한다.
- **FR-010**: 통일 계약 밖 레거시 실험 사이즈 API는 본 기능 버전에서 미지원이어야 하며, 공식 문서/예제에서 안내되면 안 되고 런타임에서 발견 시 warning 후 무시해야 한다.
- **FR-011**: 미지원 size 토큰 입력 시 시스템은 모든 런타임 환경에서 일관되게 warning을 남기고 카테고리 기본값 fallback(`typography=m`, `space=m`, `object2d=auto`)을 적용해야 한다.
- **FR-012**: 동일 카테고리 안에서 동일 의미 토큰은 지원 컴포넌트 전반에 동일한 시각 결과로 해석되어야 한다.
- **FR-013**: 본 명세는 기존 토큰 의미를 깨지 않고 미래에 사이즈 어휘를 확장할 수 있어야 한다.
- **FR-014**: 공식 사용 가이드는 token-first 원칙을 유지하되, 필요한 호환 동작은 함께 문서화해야 한다.
- **FR-015**: 단일 2D size 입력에 충돌 모드가 포함되면 시스템은 invalid로 처리하고 warning 후 카테고리 기본값 fallback(`typography=m`, `space=m`, `object2d=auto`)을 적용해야 한다.
- **FR-016**: Sticky/Shape의 primitive numeric `size` 입력은 지원해야 하며, primitive token과 동일한 해석 경로(컴포넌트 기본 ratio)로 처리해야 한다. 구조화된 numeric width/height 입력도 2D 사이징으로 계속 지원해야 한다.
- **FR-017**: 미지원 2D ratio 값 입력 시 시스템은 warning을 남기고 기본 ratio(`landscape`)로 fallback해야 한다.

### 핵심 엔터티 _(데이터가 포함될 경우)_

- **Size Token**: 의도된 스케일 레벨을 표현하는 의미 라벨(예: `xs`~`xl`).
- **Size Category**: 토큰이 해석되는 도메인(예: 텍스트 위계, 공간 리듬, 2D 오브젝트 스케일).
- **Size Input Contract**: 컴포넌트 패밀리별 허용 입력 형태를 정의하는 계약.
- **Size Ratio**: 2D 사이즈 방향/형상을 표현하는 허용 값 집합(`landscape`, `portrait`, `square`).
- **Fallback Policy**: 미지원 토큰 입력 시 warning과 기본 동작을 정의하는 규칙.
- **Component Size Profile**: 컴포넌트별 지원/제외 사이징 모드를 구분하는 해석 경계.

### 가정

- 주 사용자층은 숫자 미세 조정보다 의도 기반 사이즈 선택에 이점이 있는 콘텐츠 작성자다.
- 통일 계약 범위 내에서 기존 숫자 입력 자산은 계속 동작한다.
- 팀은 초기 5단계 토큰을 넘어서는 미래 확장 여지를 필요로 한다.
- 본 버전은 모든 노드 완전 커버보다 예측 가능한 범위와 동작을 우선한다.

### 의존성

- 제품 문서/예제가 통일된 사이즈 계약을 반영하도록 갱신되어야 한다.
- 디자인/콘텐츠 리뷰에서 의미 스케일 순서가 작성자에게 이해 가능함이 확인되어야 한다.
- 범위 제외 컴포넌트가 실수로 인스코프로 간주되지 않도록 노드 오너 간 범위 정렬이 유지되어야 한다.

### 요구사항 수용 기준

- **FR-001 수용**: 지원 사이징 표면에서 5개 의미 레벨이 모두 제공되고 기대 순서로 렌더된다.
- **FR-002 수용**: `fontSize={number}`, `Markdown size={number}`, `Sticky/Shape size={number}`, 구조화된 2D numeric width/height 입력이 기대 결과를 유지한다.
- **FR-003 수용**: 지원 컴포넌트 패밀리마다 공용 가이드에서 단일 size 진입 경로가 명확히 제시된다.
- **FR-004 수용**: 지원 블록 컴포넌트가 orientation 의도 기반 모듈러 2D 사이징을 수용한다.
- **FR-004A 수용**: 2D ratio 입력은 `landscape | portrait | square` 값만 유효하게 처리된다.
- **FR-005 수용**: 사용자가 하나의 의미 값으로 동일 width/height를 설정할 수 있다.
- **FR-006 수용**: 사용자가 필요 시 명시적 width/height 커스텀 값을 설정할 수 있다.
- **FR-007 수용**: Markdown의 단일 값 size는 텍스트 밀도를, 상세 값 size는 2D 영역을 변경한다.
- **FR-008 수용**: 시퀀스 다이어그램 사이즈 토큰화는 본 범위 밖으로 유지된다.
- **FR-009 수용**: Sticker는 2D 토큰 대상이 아니며 콘텐츠 기반 사이즈를 유지한다.
- **FR-010 수용**: 레거시 실험 사이즈 API는 지원 문서/예제에서 노출되지 않고, 런타임에서 발견 시 warning+ignore로 처리된다.
- **FR-011 수용**: 미지원 토큰은 항상 카테고리 기본값 기반 warning+fallback으로 처리된다.
- **FR-012 수용**: 동일 카테고리 내 토큰 의미가 지원 컴포넌트 전반에서 일관된다.
- **FR-013 수용**: 미래 토큰 확장이 기존 토큰 동작을 깨뜨리지 않는다.
- **FR-014 수용**: 공식 가이드가 일관되게 token-first 사용법을 제시한다.
- **FR-015 수용**: 2D 충돌 입력 케이스는 항상 카테고리 기본값 기반 warning+fallback으로 처리된다.
- **FR-016 수용**: Sticky/Shape의 primitive numeric `size`는 지원되며 primitive token과 동일한 규칙(컴포넌트 기본 ratio)으로 해석되고, 구조화된 numeric width/height도 허용된다.
- **FR-017 수용**: 미지원 2D ratio 입력은 warning을 남기고 기본 ratio(`landscape`)로 fallback된다.

## 성공 기준 _(필수)_

### 측정 가능한 결과

- **SC-001**: 고정된 AI Agent 출력 fixture 60건에서 인스코프 컴포넌트(`Text`, `Sticky`, `Shape`, `Markdown`)의 사이즈 입력이 단일 계약(`fontSize`/`size`)을 100% 준수하고 파서/렌더가 예외 없이 완료된다.
- **SC-002**: 수용 테스트에서 지원 컴포넌트의 `xs`~`xl` 시각 순서가 선언된 카테고리 내에서 100% 일관되게 유지된다.
- **SC-003**: 회귀 테스트에서 인스코프 숫자 호환 케이스가 100% 동작 회귀 없이 렌더된다.
- **SC-004**: 적합성 검토에서 미지원 토큰 케이스가 개발/운영 환경 모두에서 100% warning + 문서화된 fallback을 적용한다.
- **SC-005**: 문서 감사에서 신규 예제 100%가 token-first를 따르며 미지원 레거시 실험 사이즈 API를 안내하지 않는다.
