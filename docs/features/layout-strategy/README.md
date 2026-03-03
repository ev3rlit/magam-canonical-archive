# Layout Strategy 아키텍처

MindMap 레이아웃을 유연하게 교체/추가할 수 있도록 Strategy 패턴으로 개선합니다.

## 레이아웃 문제 정의

### 1. 기계적 배치 — "자동 정렬"은 되지만 "읽히는 배치"가 아님

ELK layered 알고리즘이 균일한 그리드처럼 배치합니다.
계층 깊이와 중요도 구분 없이 동일한 간격으로 나열되어, 사람이 그린 마인드맵의 "흐름"이 없습니다.

### 2. 과도한 크기/여백 — 정보 밀도가 낮음

현재 레이아웃 수치:

| 항목 | 값 | 비고 |
|------|-----|------|
| node-node 간격 | 20px | `elk.spacing.nodeNode` |
| layer 간격 | 40px | `elk.layered.spacing.nodeNodeBetweenLayers` |
| group spacing | 60px | `useLayout.ts` 기본값 |
| fallback 노드 크기 | 150×50px | 텍스트 한 줄에도 이 크기 |
| Sticky min | 160×96px | |
| Shape min | 144×80px (9rem×5rem) | |

노드 10개만 있어도 화면을 가득 채움 → 전체 구조를 한눈에 파악 불가.

### 3. 동일 계층 자식 과다 시 정보 전달력 저하

한 부모에 자식이 많으면 한 방향으로 길게 늘어집니다.
시선이 분산되고, 어떤 자식이 중요한지 구분이 안 됩니다.

```
                    ┌─ child1
                    ├─ child2
                    ├─ child3
root ───────────────├─ child4      ← 세로로 길게 늘어짐
                    ├─ child5
                    ├─ child6
                    └─ child7
```

### 4. 가변 크기 컴포넌트 공존 (Polymorphic Children 도입 시)

Polymorphic children이 도입되면 한 MindMap 안에 크기가 크게 다른 요소들이 공존합니다.

| 컴포넌트 | 예상 크기 | 비고 |
|----------|----------|------|
| Node (텍스트) | ~150×40 | 현재 기준, 균일 |
| Sticky | ~200×200 | Node 대비 ~5배 면적 |
| Sequence | ~600×300+ | Participant 수에 비례, 가변 |
| 중첩 MindMap | 가변 | 서브트리 전체 크기에 의존 |
| Shape (diamond) | ~100×100 | 고정적 |

## 현재 구현 상태

Strategy 패턴 리팩토링 완료:

```
app/utils/strategies/
├── types.ts                   ← LayoutStrategy 인터페이스
├── treeStrategy.ts            ← ELK tree (구현 완료)
├── bidirectionalStrategy.ts   ← ELK bidirectional (구현 완료)
├── registry.ts                ← layoutType → strategy 매핑
└── index.ts                   ← barrel export

app/utils/elkUtils.ts          ← ELK 전용 코드 (layoutUtils에서 분리)
app/utils/layoutUtils.ts       ← 범용 유틸만 유지
app/hooks/useLayout.ts         ← 파이프라인 훅 (useElkLayout 대체)
```

---

## 레이아웃 알고리즘 후보군 비교 분석

### 총괄 비교 테이블

| 알고리즘 | 공간 효율 | 계층 가독성 | 가변 노드 크기 | JS 라이브러리 성숙도 | 구현 난이도 | 마인드맵 적합도 |
|:---------|:---------:|:----------:|:-------------:|:------------------:|:----------:|:--------------:|
| **Layered/ELK** (현재) | ★★★☆☆ | ★★★★★ | 우수 | elkjs (성숙) | 완료 | 좋음 |
| **Compact Tree** (flextree) | ★★★★☆ | ★★★★☆ | 우수 | d3-flextree | 낮음 | **최적** |
| **Treemap** | ★★★★★ | ★★☆☆☆ | 모델 불일치 | d3-hierarchy | 중간 | 부적합 |
| **Bin Packing** | ★★★★★ | ★☆☆☆☆ | 우수 | maxrects-packer | 낮음 | 단독 부적합 |
| **Force-Directed** | ★★☆☆☆ | ★★☆☆☆ | 부분적 | d3-force, Cola.js | 중간 | 낮음 |
| **Radial Tree** | ★★★☆☆ | ★★★☆☆ | 열악 | d3+커스텀 필요 | 높음 | 제한적 |
| **Orthogonal** | ★★★★☆ | ★★★☆☆ | 좋음 | MSAGL.js (제한적) | 매우 높음 | 낮음 |
| **Indented/Outline** | ★★☆☆☆ | ★★★★☆ | 우수 | 불필요 (~30줄) | 매우 낮음 | 틈새용 |
| **Hybrid: flextree+bidir** | ★★★★☆ | ★★★★☆ | 우수 | d3-flextree | 낮음 | **최적** |

---

### 1. Layered / Sugiyama (ELK) — 현재 구현

**원리**: 5단계 파이프라인 — 순환제거 → 레이어 배정 → 교차 최소화 → 노드 배치 → 엣지 라우팅

```
Layer 0     Layer 1     Layer 2     Layer 3
  root ───→ branch1 ──→ leaf1
         ├→ branch2 ──→ leaf2
         └→ branch3 ──→ leaf3
```

| 장점 | 단점 |
|------|------|
| 계층 방향이 명확 (부모→자식 흐름) | 레이어 기반이라 공간 낭비 多 |
| 140+ 옵션으로 세밀 조정 가능 | 가변 노드 크기 시 같은 레이어에서 빈 공간 발생 |
| 엣지 교차 최소화 내장 | 번들 크기 ~800KB (elkjs) |
| 4방향 지원 (LEFT/RIGHT/UP/DOWN) | 순수 트리에 과도한 알고리즘 |

**라이브러리**: [elkjs](https://github.com/kieler/elkjs) (성숙), [dagre](https://github.com/dagrejs/dagre) (미유지보수), [MSAGL.js](https://github.com/microsoft/msagljs)

**상태**: `TreeStrategy`, `BidirectionalStrategy`로 구현 완료

---

### 2. Compact Tree (Reingold-Tilford / van der Ploeg) ⭐ 최우선 후보

**원리**: 상향식 알고리즘 — 서브트리를 독립적으로 배치 → 윤곽(contour) 비교로 최대한 가깝게 밀착 → 부모를 자식 위에 중앙 배치. van der Ploeg (2014) 변형은 **가변 노드 크기를 O(n)에** 처리.

```
ELK layered (현재):            Compact Tree (목표):

     ┌─ leaf1                    root
     │                          ┌──┴──┐
root ┼─ leaf2 (같은 레이어)     b1    b2
     │                         ┌┴┐  ┌┴┐
     └─ leaf3                 l1 l2 l3 l4
                              ↑ 서브트리가 틈새에 밀착
```

| 장점 | 단점 |
|------|------|
| **가변 노드 크기에 최적** (van der Ploeg) | 트리 전용 (일반 그래프 불가) |
| O(n) 선형 시간 — ELK보다 빠름 | 단일 루트 가정 |
| 동기 실행 가능 (Web Worker 불필요) | 단방향만 지원 (양방향은 래퍼 필요) |
| 서브트리 밀착 배치로 공간 효율 ↑ | 엣지 교차 최소화 없음 (트리라 불필요) |
| ~15KB (vs ELK 800KB) | |

**라이브러리**:
- [**d3-flextree**](https://github.com/Klortho/d3-flextree) — 가변 노드 크기, 커스텀 간격 함수, ~15KB ⭐
- [non-layered-tidy-tree-layout](https://www.npmjs.com/package/non-layered-tidy-tree-layout) — van der Ploeg 논문 직접 구현
- [zxch3n/tidy](https://github.com/zxch3n/tidy) — Rust/WASM 구현, JS 대비 100x+ 성능

**구현 스케치**:
```typescript
class CompactTreeStrategy implements LayoutStrategy {
    async layoutGroup(context: LayoutContext) {
        const tree = buildHierarchy(context.nodes, context.edges);
        const layout = flextree()
            .nodeSize(node => [node.data.width + context.spacing, node.data.height + context.spacing]);
        const root = layout(tree);
        const positions = new Map();
        root.each(node => positions.set(node.data.id, { x: node.x, y: node.y }));
        return positions;
    }
}
```

---

### 3. Treemap (Squarified)

**원리**: 사각형 영역을 가중치 비율로 재귀 분할. 포함 관계로 계층 표현.

```
┌──────────────────────────────────┐
│              root                │
├──────────────┬───────────────────┤
│    branch1   │     branch2      │
├──────┬───────┤  ┌──────┬──────┐ │
│ leaf1│ leaf2 │  │leaf3 │leaf4 │ │
└──────┴───────┘  └──────┴──────┘ │
└──────────────────────────────────┘
```

| 장점 | 단점 |
|------|------|
| 공간 100% 사용 | **엣지(선) 없음** — 마인드맵 아님 |
| 비중/비율 비교에 최적 | 노드 크기가 OUTPUT (가중치 기반), INPUT 아님 |
| 잘 확립된 라이브러리 | 3단계 이상 중첩 시 가독성 급감 |

**모델 충돌**: Magam은 노드 크기가 컨텐츠에 의해 결정 (Markdown, 테이블 등). Treemap은 알고리즘이 크기를 결정. 근본적으로 **방향이 반대**.

**결론: 마인드맵에 부적합.** 대시보드/비중 비교 등 별도 시각화에만 적합.

---

### 4. Bin Packing (MaxRects / Guillotine)

**원리**: 가변 크기 사각형들을 컨테이너에 빈 공간 최소화하여 배치.

| 장점 | 단점 |
|------|------|
| 이종 크기 사각형에 특화 | **계층 개념 없음** |
| 95%+ 공간 활용률 | 부모-자식이 멀리 배치될 수 있음 |
| O(n log n) 빠른 속도 | 엣지가 전부 교차 |

**라이브러리**: [maxrects-packer](https://github.com/soimy/maxrects-packer), [rectangle-packer](https://www.npmjs.com/package/rectangle-packer)

**결론: 단독 사용 부적합.** 하이브리드의 서브 알고리즘으로 활용 가능 — 예: 다수의 MindMap 그룹을 캔버스에 컴팩트 배치할 때.

---

### 5. Force-Directed (d3-force / Cola.js)

**원리**: 노드를 하전 입자, 엣지를 스프링으로 모델링. 반복 시뮬레이션으로 평형 도달.

| 장점 | 단점 |
|------|------|
| 유기적, 미려한 배치 | 비결정적 (실행마다 다른 결과) |
| 교차 링크/비트리 구조에 자연스러움 | 계층이 시각적으로 불분명 |
| Cola.js: 사각형 비겹침 제약 지원 | 대형 그래프에서 느림 (O(n²)/반복) |
| | 가변 크기에서 큰 노드가 배치 왜곡 |

**라이브러리**: [d3-force](https://github.com/d3/d3-force), [Cola.js/WebCola](https://github.com/tgdwyer/WebCola), [MSAGL.js IPSepCola](https://github.com/microsoft/msagljs)

**결론: 마인드맵 주 레이아웃으로 부적합.** 비계층 "네트워크 뷰" 옵션으로는 고려 가능.

---

### 6. Radial Tree

**원리**: 루트를 중심에 놓고 동심원(ring) 위에 자식 배치. 각 서브트리에 각도 구간 배분.

| 장점 | 단점 |
|------|------|
| 루트 중심 → 탐색에 자연스러움 | **가변 노드에 매우 불리** (큰 노드가 각도 독점) |
| 프레젠테이션용으로 아름다움 | 텍스트 회전/가독성 문제 |
| Magam 타입 시스템에 이미 존재 (`radial`) | 깊은 트리에서 외곽 원 너무 큼 |
| | 가변 크기 + 각도 배분 = 커스텀 충돌 회피 필요 |

**결론: 균일 크기 트리에만 제한적으로 적합.** Markdown/테이블 포함 가변 노드에서는 문제 多.

---

### 7. Orthogonal

**원리**: 모든 엣지를 수평/수직 직각 선분으로 라우팅. Topology-Shape-Metrics 3단계 파이프라인.

| 장점 | 단점 |
|------|------|
| 깔끔하고 전문적 (UML/회로도 느낌) | 구현 극도로 복잡 (NP-hard 포함) |
| 대각선 엣지 없어 추적 용이 | JS 구현체 부족 |
| | 마인드맵과 미학적 불일치 |

**결론: 비추천.** ELK의 `elk.edgeRouting: "ORTHOGONAL"` 옵션으로 엣지만 직각화 가능.

---

### 8. Indented / Outline Tree

**원리**: 파일 탐색기처럼 한 줄에 한 노드, 깊이에 따라 들여쓰기.

```
Root
  ├─ Branch 1
  │   ├─ Leaf 1
  │   └─ Leaf 2
  └─ Branch 2
      └─ Leaf 3
```

| 장점 | 단점 |
|------|------|
| 구현 ~30줄 | 2D 공간 활용 안 함 (리스트) |
| 텍스트 중심 컨텐츠에 최적 | 넓은 트리에서 깊은 들여쓰기 |
| 가변 노드 높이 완벽 지원 | 시각적 임팩트 없음 |

**결론: 디버그/아웃라인 뷰로 유용.** 주 레이아웃은 아님.

---

## 하이브리드 후보

### A. Compact Tree + Bidirectional Split ⭐⭐ 최우선

기존 `BidirectionalStrategy`의 좌/우 분할 로직 + d3-flextree의 컴팩트 배치.

```
현재 (ELK bidirectional):          하이브리드 (flextree bidirectional):

         ┌─ c1                            c3 ─┐   ┌─ c4
         ├─ c2                            c2 ─┤   ├─ c5
root ────┤                         root ──────┤   │
         ├─ c3                            c1 ─┘   └─ c6
         └─ c4                         ↑ 서브트리 밀착     ↑ 서브트리 밀착
```

**장점**: ELK 대비 공간 효율 대폭 향상, 기존 분할 로직 재사용, 번들 크기 절감
**구현**: `runElkLayout()` → `runFlextreeLayout()` 교체만으로 가능

### B. Tree + Bin Packing (글로벌 그룹 배치)

각 MindMap 그룹은 tree/compact로 내부 배치 → 그룹들 간 배치에 MaxRects bin packing 적용.

**장점**: 현재 ELK 메타노드 기반 글로벌 배치보다 컴팩트
**용도**: `globalLayoutResolver.ts`의 대안

### C. Depth-Hybrid (L1 Grid + L2+ Compact Tree) ⭐ 신규 후보

**원리**: 깊이에 따라 다른 알고리즘 적용. 루트의 직속 자식(L1)은 **그리드/공간 채움 배치**, 그 이하(L2+)는 **compact tree**.

**2-pass 알고리즘**:
1. **Bottom-up**: 각 L1 자식의 서브트리를 compact tree로 배치 → 바운딩 박스 획득
2. **Top-down**: 바운딩 박스들을 루트 주위에 그리드 패턴으로 배치

```
현재 ELK tree:                      Depth-Hybrid:

                ┌─ leaf1              root
                ├─ leaf2            ┌──────┬──────┐
root ─── b1 ───┤                   │  b1  │  b2  │  ← L1: 그리드 배치
                └─ leaf3           │┌─┬─┐│┌─┬─┐│
         ├── b2 ── leaf4           ││l1│l2│││l4│l5││  ← L2+: compact tree
         ├── b3 ── leaf5           │└─┴─┘│└─┴─┘│
         └── b4 ── leaf6           ├──────┼──────┤
                                   │  b3  │  b4  │
         ↑ 세로로 길게 늘어짐       │ ┌─┐  │ ┌─┐  │
                                   │ │l5│  │ │l6│  │
                                   │ └─┘  │ └─┘  │
                                   └──────┴──────┘
                                    ↑ 컴팩트 + 구조 유지
```

**L1 배치 변형**:

| 변형 | L1 배치 | 특성 |
|------|---------|------|
| Grid | `ceil(√n)` 균일 그리드 | 예측 가능, 구현 쉬움 |
| Weighted Grid | 서브트리 바운딩 박스 기반 가변 셀 | 큰 서브트리에 넓은 영역 |
| Masonry | Pinterest식 열 기반 | 가변 높이에 최적 |
| Adaptive | 자식 4개 이하 → 1열, 5개+ → 그리드 | 자동 전환 |

**장점**: L1 fan-out 문제 해결 (자식 多 = 길게 늘어짐 방지), L2+ 계층/엣지 유지, 정보 밀도 극대화
**단점**: 루트↔L1 엣지 표현 방식 설계 필요, Grid 변형 선택이 결과에 큰 영향

**구현**: d3-flextree (L2+) + 커스텀 그리드 배치 (L1). 라이브러리 불필요.

### D. Tree + Force-Directed 보정

트리 레이아웃으로 초기 배치 → Cola.js로 몇 회 반복하여 균형 미세 조정.

**장점**: 유기적인 느낌, 교차 링크 자연스러움
**위험**: 튜닝 어려움, 트리 구조 파괴 가능성

---

## 구현 우선순위

### Tier 1: 즉시 구현 (고효과, 저노력)

| # | 전략 | 라이브러리 | 노력 | 효과 |
|---|------|-----------|------|------|
| 1 | **CompactTreeStrategy** | d3-flextree (~15KB) | 낮음 | 가변 노드 밀착 배치, ELK 대비 공간 50%+ 절감 |
| 2 | **BidirectionalCompactStrategy** | d3-flextree | 낮음 | 하이브리드 A. 좌우 분할 + 컴팩트 |
| 3 | **DepthHybridStrategy** | d3-flextree + 커스텀 그리드 | 중간 | 하이브리드 C. L1 그리드 + L2+ 컴팩트 |

### Tier 2: 필요 시 구현 (중간 효과)

| # | 전략 | 라이브러리 | 효과 |
|---|------|-----------|------|
| 4 | **IndentedStrategy** | 없음 (~30줄) | 아웃라인/디버그 뷰 |
| 5 | **Bin Packing 글로벌 배치** | maxrects-packer | 다중 그룹 컴팩트 배치 |

### Tier 3: 추후 검토 (전문 용도)

| # | 전략 | 비고 |
|---|------|------|
| 6 | Radial | 균일 크기 트리 전용, 가변 크기 문제 해결 필요 |
| 7 | Force-Directed (Cola.js) | 비계층 네트워크 뷰 |

### Skip

| 전략 | 사유 |
|------|------|
| Treemap (단독) | 노드 크기 모델 충돌 (OUTPUT vs INPUT) |
| Orthogonal | 구현 극도로 복잡, 마인드맵과 불일치 |

---

## 사용법 (목표)

```tsx
<MindMap layout="tree">...</MindMap>              // ELK layered (현재)
<MindMap layout="bidirectional">...</MindMap>      // ELK 양방향 (현재)
<MindMap layout="compact">...</MindMap>            // Compact Tree (신규)
<MindMap layout="compact-bidir">...</MindMap>      // Compact 양방향 (신규)
```

## 핵심 참고 자료

- [d3-flextree](https://github.com/Klortho/d3-flextree) — van der Ploeg 가변 크기 트리 레이아웃
- [van der Ploeg 2014 논문](https://onlinelibrary.wiley.com/doi/abs/10.1002/spe.2213) — Non-layered tidy trees
- [zxch3n/tidy](https://github.com/zxch3n/tidy) — Rust/WASM 고성능 구현
- [elkjs](https://github.com/kieler/elkjs) — 현재 사용 중
- [maxrects-packer](https://github.com/soimy/maxrects-packer) — Bin packing
- [Cola.js/WebCola](https://github.com/tgdwyer/WebCola) — 제약 기반 force-directed
