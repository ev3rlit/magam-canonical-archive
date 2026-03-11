# Contract: MindMap Layout Prop

## 목적

사용자와 예제가 소비하는 공개 MindMap layout 선택 surface를 고정한다.

## 공개 인터페이스

`<MindMap />`는 다음 layout 입력을 지원한다.

```tsx
<MindMap layout="compact">
  ...
</MindMap>
```

## 계약

### 1) layout

- `layout="compact"`는 조밀한 신규 MindMap 레이아웃을 의미한다.
- 이 값은 사용자 작성 MindMap topology를 변경하지 않는다.
- 이 값은 형제 수에 따라 다른 layout family로 전환되지 않고, 하나의 일관된 배치 규칙으로 동작한다.

### 2) spacing

- `spacing`은 선택적인 고급 override 값이다.
- 기본 사용 방식에서는 `spacing`을 명시하지 않는 것을 전제로 한다.
- 사용자가 값을 주지 않으면 시스템은 기본 spacing 값 `50`을 사용한다.
- 값은 양수여야 한다.
- spacing을 명시한 경우에도, 깊은 subtree 때문에 형제 전체 공백이 동일 비율로 커지는 결과를 만들어서는 안 된다.

### 3) behavior guarantees

- 같은 입력 topology, 같은 콘텐츠 크기, 같은 layout 설정에서는 결과가 결정적이어야 한다.
- 최종 렌더 상태에서는 node-to-node overlap이 없어야 한다.
- 형제가 많은 가지는 단일 긴 수직열로 붕괴하지 않아야 한다.
- 깊은 subtree는 이웃 shallow subtree를 불필요하게 멀리 밀어내지 않아야 한다.
- 여러 루트가 있는 경우에도 각 root subtree와 root cluster는 같은 compact 규칙으로 배치되어야 한다.

## 비범위

- `layout="compact"`가 MindMap topology를 재작성하거나 가상 부모를 삽입하는 동작
- `compact` 내부에서 사용자가 인지할 수 있는 hard mode switch
- dense layout 전용 신규 public prop 추가
- 일반 사용자가 spacing 튜닝을 필수적으로 해야만 원하는 품질을 얻는 설계
