# Object Capability Composition

## 배경

현재 Magam의 object surface는 `Node`, `Shape`, `Sticky`, `Image`, `Markdown` 같은 공개 컴포넌트로 분리되어 있다. 이 분리는 사용자에게는 익숙하지만, 내부 구현에서는 공통 geometry, content, editability, patching, rendering 규칙이 여러 타입 분기로 반복되는 비용을 만든다.

특히 `Sticky`는 독립적인 근본 객체라기보다 paper material, texture, attach placement, sticky defaults의 조합에 가깝다. 반대로 `Image`는 단순 스타일 조합이 아니라 media source, fit, intrinsic size, export/render pipeline 같은 content contract를 가진다.

이번 feature의 목표는 "모든 것을 하나의 거대한 prop bag으로 합치는 것"이 아니라, 단일 `Object` 기반 위에 capability를 조합하는 방향으로 object model을 재정의하는 것이다.

## 문제 정의

현재 구조는 다음 문제를 만든다.

1. semantic role과 render implementation이 컴포넌트 타입에 과도하게 결합되어 있다.
2. `Sticky` 계열 기능을 다른 object family에 재사용하기 어렵다.
3. editor/patcher/editability 판단이 JSX tag 이름 분기에 의존하기 쉬워 새 object family 추가 비용이 커진다.
4. `Node`와 `Shape`처럼 실제 contract 차이가 작은 객체들도 서로 다른 타입처럼 유지되어 모델이 비대해진다.
5. content 종류와 visual style 종류가 같은 축에서 취급되어 boundary가 흐려진다.

## 목표

1. 모든 일반 canvas object가 공통 `Object Core` 계약을 공유한다.
2. 재질, 텍스처, attach, frame 같은 visual/placement 기능을 capability prop으로 재사용 가능하게 만든다.
3. `Sticky`를 별도 base object가 아니라 preset/alias object family로 재정의한다.
4. `Image`와 `Markdown`처럼 content contract가 강한 객체는 semantic boundary를 유지한다.
5. renderer, editor, patcher가 JSX tag 기반 분기 대신 capability/contract 기반 판단으로 이동할 수 있게 한다.

## 비목표

1. 이번 단계에서 모든 공개 컴포넌트를 제거하지 않는다.
2. arbitrary TSX component를 editable native object 모델에 포함하지 않는다.
3. image crop/filter/video 같은 media editing 범위를 이번 문서에 포함하지 않는다.
4. sequence diagram의 structured content 계약을 이번 단계에서 일반 content capability로 평탄화하지 않는다.
5. 기존 파일 포맷 전체를 한 번에 마이그레이션하는 계획을 확정하지 않는다.

## 핵심 방향

### 1. Base Object는 하나로 수렴한다

일반적인 canvas object는 하나의 내부 base type으로 정규화한다.

- 공통 필드: `id`, `position`, `relations`, `children`, `className`, `sourceMeta`
- 이 base type은 semantic role을 직접 대체하지 않는다.
- semantic role과 capability는 base type 위의 metadata로 관리한다.

### 2. Capability는 opt-in 조합이다

아무 object나 아무 prop을 받을 수 있게 두지 않는다. 대신 capability 단위로 명시적으로 opt-in 한다.

- `frame`
- `material`
- `texture`
- `attach`
- `ports`
- `bubble`
- `content`

이 방식은 prop soup를 막고 editability/serialization contract를 좁게 유지한다.

### 3. Semantic role과 content kind를 분리한다

object가 무엇을 "의미하는지"와 무엇을 "담는지"는 다른 축이다.

- semantic role 예: `topic`, `shape`, `sticky-note`, `image`
- content kind 예: `text`, `markdown`, `media`, `sequence`

예를 들어 topic object도 markdown content를 가질 수 있고, shape object도 plain text를 가질 수 있다.

### 4. Sticky는 preset/alias로 축소한다

`Sticky`는 base object 위에 아래 capability를 조합한 별칭으로 본다.

- `material`
- `texture`
- `attach`
- `frame`(optional sticky shape preset)

즉 Sticky는 독립적인 runtime primitive가 아니라, 잘 알려진 preset family다.

### 5. Image는 media semantic을 유지한다

이미지는 단일 base object 위에 구현할 수 있지만, semantic/content boundary는 유지해야 한다.

- `src`, `alt`, `fit`
- intrinsic size
- loading/export behavior
- asset reference contract

따라서 `Image`는 없애기보다 `Object + media content alias`로 유지하는 편이 바람직하다.

## Capability Matrix

| Capability / Layer | 역할 | 대표 필드 | 재사용 범위 | semantic 구분 필요성 | 비고 |
|---|---|---|---|---|---|
| `Object Core` | 모든 object의 공통 뼈대 | `id`, `x`, `y`, `from`, `className`, `sourceMeta` | 전체 | 낮음 | 내부 단일 base |
| `content:text` | plain text 본문 | `text`, `fontSize` | 높음 | 높음 | 기본 content |
| `content:markdown` | markdown source 본문 | `source`, `size` | 높음 | 높음 | WYSIWYG 대상 |
| `content:media` | image/media 본문 | `src`, `alt`, `fit` | 중간 | 높음 | asset/render 계약 보유 |
| `content:sequence` | 구조화된 composite content | `participants`, `messages` | 낮음 | 높음 | 별도 structured contract |
| `frame` | 외곽 형상/프레임 | `shape`, `fill`, `stroke` | 높음 | 낮음 | shape family 재사용 |
| `material` | 종이/배경 소재 | `preset`, `pattern` | 높음 | 낮음 | sticky 전용일 필요 없음 |
| `texture` | 노이즈/광택/깊이감 | `noiseOpacity`, `glossOpacity` | 높음 | 낮음 | 시각 효과 축 |
| `attach` | 다른 object 기준 상대 배치 | `target`, `position`, `offset` | 높음 | 낮음 | sticky 외에도 사용 가능 |
| `ports` | edge 연결 포트 | `ports[]` | 중간 | 낮음 | shape/topic/image 공용 가능 |
| `bubble` | 축약/zoom fallback 표시 | `bubble` | 중간 | 낮음 | 표현 전략 |
| `editMeta` | 편집 허용 범위 계산 | `family`, `contentCarrier` | 전체 | 내부 필요 | tag 기반이 아니라 capability 기반으로 유도 |

## 공개 API 해석

| Public API | 내부 해석 | 유지 전략 |
|---|---|---|
| `Node` | `Object` + topic defaults | legacy alias 유지 |
| `Shape` | `Object` + frame defaults | 일반-purpose alias 유지 |
| `Sticky` | `Object` + material/texture/attach defaults | preset alias 유지 |
| `Image` | `Object` + `content:media` | explicit alias 유지 |
| `Markdown` | `Object`의 content capability | 독립 authoring surface는 유지 가능 |
| `Sticker` | decoration/label preset object | 별도 alias 유지 가능 |

## 설계 규칙

1. renderer는 JSX tag name보다 normalized capability 집합을 기준으로 node type과 UI behavior를 결정한다.
2. patcher/editability는 `Node`, `Shape`, `Sticky` 이름 자체가 아니라 허용 capability와 content carrier를 기준으로 판단한다.
3. `content:*`는 style capability와 다르게 semantic contract를 가진다. 특히 `media`, `markdown`, `sequence`는 별도 validation과 editor behavior를 유지한다.
4. preset alias는 authoring ergonomics를 위한 public sugar이며, canonical internal model을 늘리지 않는다.
5. 새 object family를 추가할 때는 "새 base type"이 아니라 "새 semantic role", "새 content kind", 또는 "새 capability" 중 어느 축인지 먼저 판별한다.

## 예시 모델

```tsx
<Object
  id="note-1"
  content={{ kind: 'text', value: 'Draft API' }}
  frame={{ shape: 'speech' }}
  material={{ preset: 'postit' }}
  texture={{ noiseOpacity: 0.08 }}
  attach={{ target: 'api-server', position: 'bottom', offset: 12 }}
/>
```

동일한 모델 위에서 아래 alias를 제공할 수 있다.

```tsx
<Sticky id="note-1" at={{ type: 'anchor', target: 'api-server', position: 'bottom' }}>
  Draft API
</Sticky>
```

```tsx
<Image id="diagram-1" src="./assets/flow.png" alt="Flow" fit="contain" x={320} y={120} />
```

## 마이그레이션 방향

### Phase 1. 정규화 레이어 도입

- 기존 public component는 유지한다.
- parser 내부에 normalized object model을 먼저 만든다.
- editability와 render routing에 capability metadata를 추가한다.

### Phase 2. preset alias화

- `Sticky`와 `Node`를 thin alias로 정리한다.
- `Shape`는 general-purpose object alias로 유지한다.
- `Image`는 media alias로 유지한다.

### Phase 3. capability 기반 편집

- style update whitelist를 tag name 기준에서 capability 기준으로 이동한다.
- create/patch command도 alias가 아니라 canonical object schema를 기준으로 생성한다.

## 성공 기준

1. 새 visual 기능 추가 시 기존 object family별 중복 구현 없이 capability 추가만으로 확장 가능하다.
2. `Sticky` 계열 기능을 `Shape` 또는 future object family에도 재사용할 수 있다.
3. editor/patcher에서 JSX tag 분기 수가 줄고 capability-based rule로 치환된다.
4. `Image`와 `Markdown`은 semantic/content 계약을 유지하면서도 동일 base object 위에서 동작한다.
5. public API 호환성을 유지한 채 내부 canonical model 수를 줄인다.

## 오픈 질문

1. canonical 저장 모델에서 semantic role 이름을 얼마나 세분화할 것인가
2. `Markdown`을 독립 alias로 유지할지, `Object` 내부 content declaration만으로 수렴시킬지
3. `Sticker`를 decoration capability 조합으로 흡수할지, 별도 semantic role로 유지할지
4. `Sequence`를 long-term에 별도 node family로 둘지, structured content family로 둘지
5. capability validation을 TypeScript type system과 runtime validator 중 어디까지 중복해서 강제할지

## 결론

Magam의 다음 object model은 "객체 종류를 계속 늘리는 방식"보다 "단일 object core 위에 capability를 조합하는 방식"으로 가는 편이 더 단순하고 확장 가능하다.

이 방향에서 중요한 예외는 content contract가 강한 객체들이다. `Sticky`는 base type이 아니라 preset alias로 줄일 수 있지만, `Image`는 `media content` semantic을 유지해야 하며, `Markdown`과 `Sequence`도 각자의 content boundary를 보존해야 한다.
