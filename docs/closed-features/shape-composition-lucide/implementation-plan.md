# Shape 중심 Lucide 조합 리팩터링 구현 계획서

## 1) 문서 목적
`docs/features/shape-composition-lucide/README.md` PRD를 구현 가능한 작업 단위로 분해합니다.

핵심 원칙:
- 내부 공통 오브젝트 계층은 내부 전용
- 범용 오브젝트는 Shape
- Lucide는 children 선언형

---

## 2) 범위 요약

### 포함
1. children 기반 아이콘 렌더 파이프라인 도입
2. Shape/Sticky/MindMapNode/Sticker 공통 조합 모델 반영
3. 기존 icon prop 완전 제거 + 마이그레이션 가이드 제공
4. 문서/예제 가이드 전환

### 제외
1. 아이콘 GUI 편집기 고도화
2. 타 라이브러리 아이콘 범용 어댑터
3. 대규모 예제 일괄 자동 변환

---

## 3) 아키텍처 계획

### 3.1 공통 모델
- `RenderableChild` 개념 도입
  - `text`
  - `lucide-icon`
  - (향후) badge/sticker/meta

### 3.2 내부 계층
- private object primitive: internal-only
  - selection state
  - handles/ports
  - anchor positioning
  - common wrapper layout
- Node-level wrappers (Shape/Sticky/MindMap/Sticker)
  - private object primitive 위에 스타일/기본 spacing만 제공

### 3.3 파싱 규칙
- JSX children를 파싱해 `RenderableChild[]`로 정규화
- Lucide child는 컴포넌트 이름 기반으로 식별
- 문자열/숫자 child는 text로 합성

---

## 4) 단계별 구현

## Phase 0. 계약 확정
- children 파싱 스펙 정의
- icon prop deprecate 정책 확정
- 내부 공통 오브젝트 계층 공개 금지 규칙 문서화

완료 기준:
- 팀 합의된 파싱/호환 스펙 문서화

## Phase 1. Children 파싱 유틸
- `app/utils/childComposition.ts`(신규) 추가
- 입력(RenderNode children) -> RenderableChild[] 변환
- Lucide component 식별 로직 추가

완료 기준:
- 단위 테스트 통과
- `text + lucide` 조합 안정 파싱

## Phase 2. Node 렌더 슬롯 통합
- Shape/Sticky/Text/Markdown/MindMapNode/Sticker 렌더 경로에 공통 child 슬롯 적용
- 아이콘/텍스트 렌더 순서 정책 적용(아이콘 선행 + 텍스트)

완료 기준:
- 4개 이상 노드 타입에서 동일 선언 문법 동작

## Phase 3. 제거/마이그레이션 계층
- 기존 `icon` prop 파싱 경로 제거
- `icon` prop 감지 시 명시적 오류 + migration hint 제공
- 코드모드 예제 변환 스크립트(또는 문서 가이드) 제공

완료 기준:
- `icon` prop 기반 구문은 모두 실패/차단되어 조기 발견 가능
- children 선언형으로 마이그레이션 경로가 문서화됨

## Phase 4. 문서/예제 전환
- docs/features의 신규 가이드 추가
- 최소 예제 3개를 children 선언형으로 업데이트

완료 기준:
- 사용자 문서에서 내부 공통 오브젝트 계층 직접 사용 예시 0건

## Phase 5. 품질/릴리스
- 회귀 테스트
- 성능 점검(노드 대량 렌더)
- 마이그레이션 안내 문서 배포

완료 기준:
- PRD FR 충족 + 릴리스 승인

---

## 5) 테스트 전략

### 5.1 단위 테스트
1. children 파싱
   - 문자열 only
   - Lucide only
   - 혼합(children + text)
2. 제거 검증
   - `icon` prop 사용 시 오류 메시지 + migration hint 검증

### 5.2 통합 테스트
1. Shape 내부 Lucide 렌더
2. Sticky 내부 Lucide 렌더
3. MindMap Node 내부 Lucide 렌더
4. Sticker 내부 Lucide 렌더
5. 기존 icon prop 예제 차단(오류 메시지 확인)

### 5.3 E2E/수동 테스트
1. 예제 파일 열기
2. 노드 선택/렌더 시 아이콘 표현 확인
3. 파일 저장/재로드 후 표현 유지 확인

---

## 6) 텔레메트리/로그

v2에서 최소 로깅:
- `icon_children_rendered`
- `icon_prop_removed_blocked`
- `icon_children_parse_failed`

공통 필드:
- `component_type` (shape/sticky/node/sticker)
- `success`
- `duration_ms`

---

## 7) 마이그레이션 가이드(초안)

### 제거 대상(이전 구문)
```tsx
<Shape id="s1" icon="bug" />
<Sticky id="m1" icon="rocket">Deploy</Sticky>
<Node id="backend" from="stack" icon="cpu">Backend</Node>
```

### 권장(신규 표준)
```tsx
<Shape id="s1">
  <Bug size={16} />
  Auth
</Shape>

<Sticky id="m1">
  <Rocket size={14} />
  Deploy
</Sticky>

<Node id="backend" from="stack">
  <Cpu size={14} />
  Backend
</Node>
```

정책:
- 기존 구문은 즉시 제거
- children 선언형만 허용
- 릴리스 노트에 **Breaking: icon prop removed** 문구를 고정 포함

---

## 8) 체크리스트

- [ ] children 파싱 유틸 구현
- [ ] Lucide child 식별 규칙 구현
- [ ] Shape/Sticky/MindMap/Sticker 렌더 통합
- [ ] icon prop 제거 + 차단 오류 구현
- [ ] 개발 경고 로그 추가
- [ ] 단위 테스트/통합 테스트 작성
- [ ] 문서 예제 전환 (children 선언형 only)
- [ ] 릴리스 노트/마이그레이션 노트 작성 (Breaking: icon prop removed 명시)

---

## 9) 의사결정 기록

1. 내부 공통 오브젝트 계층은 내부 전용으로 유지 (외부 공개 금지)
2. 범용 오브젝트는 Shape 기준으로 문서화
3. Lucide는 컴포넌트 직접 선언(`name` 문자열 방식 비권장)
4. 접두사 없는 원형 사용(`<Bug />`, `<Rocket />`)

---

## 10) 예상 일정(러프)

- Phase 0~1: 0.5~1일
- Phase 2~3: 1~2일
- Phase 4~5: 0.5~1일

총 2~4일 (리뷰/피드백 포함)