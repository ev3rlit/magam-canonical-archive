# Shape 중심 Lucide 조합 리팩터링 PRD

## 1) 배경
현재 아이콘 기능은 노드 `icon` prop 기반으로 빠르게 구현되어 있습니다. 이 방식은 단기적으로는 편하지만, 아래 한계가 있습니다.

- 노드당 아이콘 1개 중심으로 설계가 고정됨
- 아이콘을 오브젝트처럼 배치/조합하는 React 스타일과 거리가 있음
- Shape/Sticky/MindMapNode/Sticker 간 일관된 표현 모델이 부족함

이번 리팩터링의 핵심은 다음입니다.

1. **내부 공통 오브젝트 계층은 코어 내부 전용으로 유지**
2. 사용자/문서 레벨의 범용 오브젝트는 **Shape**를 사용
3. 아이콘은 prop이 아니라 **children으로 선언** (`<Bug />`, `<Rocket />`)
4. Shape/Sticky/MindMapNode/Sticker 어디서든 자식으로 Lucide를 구성 가능

---

## 2) 문제 정의

### 사용자 관점
- “아이콘 설정”이 아니라 “컴포넌트 조합”으로 쓰고 싶다.
- 노드 타입과 무관하게 같은 방식으로 아이콘을 넣고 싶다.
- 코드에서 읽히는 의미가 명확해야 한다 (`<Bug />` 자체 선언).

### 제품/아키텍처 관점
- 공통 베이스(선택/레이아웃/핸들/앵커)는 내부에서 일관 관리해야 한다.
- 외부 API는 단순해야 한다(Shape 중심).
- 기존 `icon` prop 문서를 단계적으로 정리할 필요가 있다.

---

## 3) 목표와 비목표

### 목표 (Goals)
1. Shape를 범용 오브젝트로 공식화한다.
2. Lucide 컴포넌트를 children으로 선언해 렌더할 수 있다.
3. Shape/Sticky/MindMapNode/Sticker 모두 children 조합 모델을 지원한다.
4. 내부 공통 오브젝트 계층은 외부 노출 없이 내부 구현체로 유지한다.

### 비목표 (Non-Goals)
1. 이번 단계에서 다중 아이콘 편집 GUI 완성
2. Lucide 외 외부 아이콘 라이브러리 범용 어댑터 도입
3. 기존 모든 예제 파일의 즉시 전면 마이그레이션

---

## 4) 사용자 시나리오

### 시나리오 A: Shape 내부 아이콘
```tsx
<Shape id="svc-auth" x={240} y={140}>
  <Bug size={16} />
  <Text>Auth Service</Text>
</Shape>
```

### 시나리오 B: Sticky 내부 아이콘
```tsx
<Sticky id="memo-1" x={80} y={80}>
  <Rocket size={14} />
  배포 체크
</Sticky>
```

### 시나리오 C: MindMap Node 내부 아이콘
```tsx
<Node id="mindmap-0.backend" from="mindmap-0.stack">
  <Cpu size={14} />
  Backend
</Node>
```

### 시나리오 D: Sticker 내부 아이콘
```tsx
<Sticker id="st-1" x={520} y={180}>
  <Sparkles size={18} />
  Highlight
</Sticker>
```

---

## 5) 기능 요구사항

### FR-1. Shape 범용 오브젝트화
- 문서 및 예제에서 범용 오브젝트 표현은 Shape 중심으로 안내
- Shape는 children 렌더를 우선 모델로 사용

**Acceptance Criteria**
- Shape children으로 텍스트 + Lucide 동시 렌더 가능
- Shape 단일 label prop 없이도 정상 표현 가능

### FR-2. Lucide children 선언 지원
- `<Bug />`, `<Rocket />` 같은 컴포넌트 직접 선언 허용
- 문자열 name 기반이 아닌 컴포넌트 선언형 우선

**Acceptance Criteria**
- 렌더러가 Lucide child를 인식해 노드 내부에 표시
- 아이콘 크기/색상 기본값이 테마와 충돌 없이 표현됨

### FR-3. 다중 노드 타입 children 일관성
- Shape/Sticky/MindMapNode/Sticker에 동일 children 파이프라인 적용

**Acceptance Criteria**
- 4개 타입 모두에서 Lucide child 렌더 동작
- 타입별 렌더 차이는 스타일만 다르고 선언 규칙은 동일

### FR-4. 내부 공통 오브젝트 계층 내부 전용 유지
- 내부 공통 오브젝트 계층은 공개 API/문서에서 직접 사용하지 않음
- 내부 공통 동작(선택/핸들/레이아웃)만 담당

**Acceptance Criteria**
- 사용자 문서/예제에서 내부 공통 오브젝트 계층 노출 없음
- 내부 컴포넌트는 공통 오브젝트 계층을 통해 동작 일관성 유지

### FR-5. icon prop 완전 제거
- 기존 `icon` prop 경로를 제거한다.
- 아이콘 표현은 children 선언형만 허용한다.

**Acceptance Criteria**
- `icon` prop 사용 시 렌더/파싱 단계에서 명확한 오류 또는 차단이 발생한다.
- 새 예제/문서는 children 방식만 포함한다.

### 🚨 Breaking Change (명시)
- `Shape`, `Sticky`, `MindMap Node`, `Sticker`의 `icon` prop은 제거되었다.
- 이제 아이콘은 반드시 children으로 선언해야 한다.

```tsx
// ❌ 제거됨
<Shape id="auth" icon="bug" label="Auth Service" />

// ✅ 신규 표준
<Shape id="auth">
  <Bug size={16} />
  Auth Service
</Shape>
```

---

## 6) 비기능 요구사항

1. 성능
- 기존 대비 렌더 성능 열화가 체감되지 않아야 함 (노드 갱신 최소화)

2. 유지보수성
- 노드 타입별 중복 코드 감소(공통 렌더 파이프라인 확보)

3. 일관성
- 노드 타입 간 children 해석 규칙 통일

4. 문서성
- 사용자 관점에서 API가 단순(Shape + children)

---

## 7) UX/API 원칙

- **보이는 API는 단순하게:** Shape + children
- **내부 구조는 강하게:** 내부 공통 오브젝트 계층으로 공통화
- **표현은 조합형:** 아이콘/텍스트/배지 등 child 조합으로 확장

---

## 8) 기술 설계 개요

### 8.1 레이어
- Public Layer: `Shape`, `Sticky`, `Node(MindMap)`, `Sticker`
- Internal Layer: private object primitive (코어 내부 전용)
- Renderer Layer: children 파싱(텍스트/Lucide/기타 child)

### 8.2 권장 선언 방식
```tsx
import { Bug, Rocket, Cloud } from 'lucide-react';

<Shape id="s1"><Bug size={16} />API</Shape>
<Shape id="s2"><Cloud size={16} />Cloud</Shape>
<Sticky id="m1"><Rocket />Deploy</Sticky>
```

### 8.3 제거 정책
- `icon` prop: 지원 완전 제거
- 아이콘 선언은 children 컴포넌트 방식만 허용

---

## 9) 성공 지표

1. 신규 예제/문서의 80% 이상이 children 선언형 사용
2. 노드 타입별 아이콘 렌더 구현 중복 감소
3. 사용자 피드백에서 “선언이 직관적” 평가 증가

---

## 10) 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| children 파싱 복잡도 증가 | 런타임 오류 가능 | 타입 가드 + 테스트 강화 |
| 기존 icon prop 사용자 혼선 | 마이그레이션 비용 | 제거 공지 + 자동 변환 가이드 + 예제 치환 |
| 노드 타입별 스타일 차이 | 일관성 저하 | 공통 오브젝트 계층 슬롯 규약 명시 |

---

## 11) 마이그레이션 노트 스니펫

### 스니펫 A: Shape
```tsx
// Before
<Shape id="svc" icon="cloud" label="Service" />

// After
<Shape id="svc">
  <Cloud size={16} />
  Service
</Shape>
```

### 스니펫 B: Sticky
```tsx
// Before
<Sticky id="todo" icon="rocket">Deploy</Sticky>

// After
<Sticky id="todo">
  <Rocket size={14} />
  Deploy
</Sticky>
```

### 스니펫 C: MindMap Node
```tsx
// Before
<Node id="backend" from="stack" icon="cpu">Backend</Node>

// After
<Node id="backend" from="stack">
  <Cpu size={14} />
  Backend
</Node>
```

## 12) 릴리스 노트 문안(초안)
- **Breaking**: 노드 계열 컴포넌트의 `icon` prop 지원이 제거되었습니다.
- **신규 표준**: Lucide 아이콘은 children 선언형(`<Bug />`, `<Rocket />`)으로만 지원됩니다.
- **마이그레이션**: 기존 `icon="name"` 구문은 아이콘 컴포넌트 child + 텍스트 child로 변경하세요.

## 13) 오픈 질문

1. `Text` child 컴포넌트를 권장 표준으로 둘지, 문자열 child를 기본으로 둘지?
2. Sticker 타입을 Shape 변형(alias)으로 통합할지?
3. 제거 이후 구문 오류 메시지 형식(친절한 migration hint 포함)을 어떻게 표준화할지?
## 14) QA 회귀 체크리스트 (#68)

- [ ] `extractNodeContent`가 children 기반으로 label/icon을 안정적으로 파싱한다.
- [ ] legacy `icon` prop payload가 들어와도 children 파싱 결과를 오염시키지 않는다.
- [ ] `renderNodeContent`가 Lucide + text 순서를 유지하고 unknown icon은 안전하게 무시한다.
- [ ] `patchFile`에서 `icon: null` 업데이트 시 JSX `icon` attribute가 제거된다.
- [ ] focused test suite(`nodeContent`, `renderableContent`, `filePatcher`)가 모두 통과한다.
