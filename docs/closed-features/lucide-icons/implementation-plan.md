# Lucide 아이콘 기능 구현 계획서

## 1. 문서 목적 및 범위
- 본 문서는 `docs/features/lucide-icons/README.md`(PRD)를 구현 가능한 엔지니어링 계획으로 구체화한다.
- 1차 릴리스 범위:
  - 노드 단위 Lucide 아이콘 선택/변경/제거
  - 이름 기반 검색 + 최근 사용(최대 8개)
  - 노드 데이터(`icon`) 저장/로드 일관성
  - 접근성(키보드 탐색/라벨) 및 성능 가드
- 제외 범위:
  - 커스텀 SVG 업로드
  - 아이콘 애니메이션
  - 다중 선택 일괄 적용

## 2. PRD 정렬 요약
- FR-1 아이콘 적용: 노드별 0~1개 아이콘 적용, 즉시 렌더
- FR-2 검색: 대소문자 비구분 이름 검색, 최대 50개
- FR-3 최근 사용: 최대 8개 로컬 유지
- FR-4 데이터 모델: `NodeData.icon?: string` 저장/복원
- FR-5 접근성: 키보드 탐색 + a11y 라벨
- NFR: 성능/안정성/테마 대비/번들 관리

## 3. 아키텍처 및 데이터 모델

### 3.1 타입(초안)
```ts
type LucideIconName = string;

type NodeData = {
  label: string;
  // ...existing fields
  icon?: LucideIconName | null;
};

type IconPickerState = {
  query: string;
  selectedName: LucideIconName | null;
  visibleResults: LucideIconName[];
  recentIcons: LucideIconName[]; // max 8
};
```

### 3.2 불변 조건(Invariants)
- `icon`은 허용 목록(lucide name set) 내 문자열 또는 미설정(null/undefined)
- 최근 사용 목록은 중복 없음, 최신 순, 최대 8개 유지
- 아이콘 미설정 노드는 기존 렌더 경로와 100% 동일하게 동작

### 3.3 저장 계약
- 노드 저장 시 `icon` 필드 직렬화
- 노드 로드 시 유효하지 않은 icon 값은 안전하게 제거(fallback)
- 문서 포맷 호환성: 기존 파일(`icon` 없음) 정상 로드

## 4. UI/UX 구현 설계

### 4.1 진입점
- 노드 속성 패널 > Appearance > Icon

### 4.2 Icon Picker 구성
- 검색 input
- 최근 사용 섹션(존재 시)
- 결과 그리드(최대 50)
- "아이콘 제거" 액션

### 4.3 최근 아이콘 저장 정책 (v1)
- 저장 위치: 전역 `localStorage`
- storage key: `magam.icons.recent.v1`
- 저장 개수: 최대 8개
- 규칙: 중복 제거 + 최신순 정렬

### 4.3 상호작용
- 입력: 실시간 필터링(디바운스 80~120ms)
- 선택: 클릭/엔터로 적용
- 제거: 즉시 `icon` unset

### 4.4 접근성
- 검색 input `aria-label="아이콘 검색"`
- 결과 항목 `role="option"`, 목록 `role="listbox"`
- 활성 항목 `aria-selected=true`
- 키보드: `↑/↓` 이동, `Enter` 적용, `Esc` 패널 닫기

## 5. 렌더링/성능 설계

### 5.1 아이콘 레지스트리 전략
- `lucide-react`에서 사용할 아이콘 목록을 레지스트리로 관리
- name -> React 컴포넌트 매핑 함수 제공
- 매핑 실패 시 null 렌더(크래시 금지)

### 5.2 성능 가드
- 노드 컴포넌트 memo 유지 (icon 변경 노드만 리렌더)
- 검색 결과 상한 50개
- 패널 열기 시 레이지 렌더(필요 시)

### 5.3 테마 대응
- 아이콘 색상은 테마 토큰 사용
- 다크/라이트 대비 기준 사전 점검

## 6. 단계별 구현(Phases)

## Phase 0. 설계 고정
- 산출물:
  - `icon` 필드 스키마 확정
  - 아이콘 레지스트리/검색 정책 확정
  - telemetry 이벤트 명세 확정
- 종료 기준:
  - 리뷰 승인

## Phase 1. 데이터/유틸 기반 구축
- 작업:
  - `lucide-react` 의존성 추가
  - icon registry + validate 유틸 구현
  - 최근 사용 관리 유틸 구현(pushUnique, trim)
- 테스트:
  - 유틸 단위 테스트
- 종료 기준:
  - 유효성/정렬/최근 사용 로직 테스트 통과

## Phase 2. 노드 저장/로드 연동
- 작업:
  - NodeData `icon` 필드 반영
  - 저장/로드 직렬화 경로 연결
  - invalid icon fallback 처리
- 테스트:
  - 파일 round-trip 테스트
- 종료 기준:
  - 재실행 후 아이콘 유지 확인

## Phase 3. Icon Picker UI 구현
- 작업:
  - 패널 UI(검색/결과/최근/제거)
  - 키보드 네비게이션 및 접근성 속성 반영
  - 결과 없음 상태 처리
- 테스트:
  - 컴포넌트 상호작용 테스트
- 종료 기준:
  - FR-2/FR-3/FR-5 충족

## Phase 4. 캔버스 렌더 적용
- 작업:
  - 노드 헤더에 아이콘 렌더
  - 크기/간격/색상 토큰 반영
  - 변경 노드 부분 업데이트 확인
- 테스트:
  - 통합 테스트(적용/변경/제거)
- 종료 기준:
  - FR-1/FR-4 충족

## Phase 5. 품질/관측/문서화
- 작업:
  - 성능 측정(패널 오픈/검색/캔버스 렌더)
  - telemetry 이벤트 연결
  - 사용자 문서/데모 갱신
- 테스트:
  - 회귀/접근성/성능 체크
- 종료 기준:
  - NFR 충족 + QA 승인

## 7. 테스트 전략

### 7.1 단위 테스트
- `isValidIconName(name)`
- `filterIcons(query)` (prefix 우선 정렬)
- `updateRecentIcons(list, name)` (중복 제거 + 8개 제한)

### 7.2 통합 테스트
- 아이콘 선택 시 노드 UI 즉시 반영
- 아이콘 변경/제거 동작
- 저장 후 재로드 시 아이콘 유지
- invalid icon 데이터 로드 시 fallback 동작

### 7.3 접근성 테스트
- 키보드-only로 검색/선택 가능
- listbox/option role 및 aria 상태 검증

### 7.4 성능 테스트
- 1,000+ 노드에서 아이콘 적용 시 프레임 드랍 체크
- 검색 입력 후 결과 갱신 p95 확인

## 8. Telemetry 이벤트(확정 v1)
- `icon_picker_opened`
- `icon_applied`
- `icon_removed`
- `icon_search_used` (query length, result count)
- `icon_render_fallback` (invalid key)

공통 payload 스키마:
- `icon_name`: string | null
- `source`: `search` | `recent` | `direct`
- `success`: boolean
- `duration_ms`: number

이벤트별 추가 필드:
- `icon_search_used`: `query_length`, `result_count`

## 9. 롤아웃 계획
1. 내부 개발 환경 on
2. dogfood 그룹 제한 배포
3. 기본 on 전환

롤백:
- feature flag off 시 아이콘 UI 숨김
- 기존 문서의 `icon` 필드는 무시하되 앱 동작 유지

## 10. 리스크 및 대응
- 아이콘 수 과다로 탐색 어려움
  - 대응: 검색 우선 + 최근 사용 상단 고정
- 번들 크기 증가
  - 대응: 레지스트리 기반 제한 import/트리셰이킹 검토
- 잘못된 icon 값 유입
  - 대응: 저장/로드 유효성 검사 + fallback
- 테마 대비 미흡
  - 대응: 테마 토큰 기반 색상 및 대비 점검

## 11. Definition of Done (DoD)
- PRD FR-1~FR-5 수용 기준 충족
- `icon` 저장/로드 round-trip 통과
- 키보드/접근성 테스트 통과
- 대규모 노드 환경에서 치명 성능 저하 없음
- telemetry 이벤트 기록 확인
- 문서(README + 구현 계획 + 간단 사용 가이드) 최신화

## 12. 구현 체크리스트
- [ ] `lucide-react` 의존성 추가
- [ ] icon registry / validate 유틸 추가
- [ ] NodeData `icon` 필드 반영
- [ ] 저장/로드 경로에 icon 직렬화/역직렬화 연결
- [ ] invalid icon fallback 처리
- [ ] Icon Picker UI(검색/결과/최근/제거) 구현
- [ ] 키보드 네비게이션 + aria 속성 적용
- [ ] 노드 헤더 아이콘 렌더 적용
- [ ] 테마 색상/크기/간격 스타일 반영
- [ ] 최근 사용 아이콘 저장 로직 구현
- [ ] 단위/통합/접근성/성능 테스트 작성 및 통과
- [ ] telemetry 이벤트 추가 및 검증
- [ ] 사용자 문서 예시 업데이트

## 13. 미해결 의사결정(Open Decisions)
- 아이콘 색상을 노드 색상과 동기화할지, 중립 고정으로 갈지
- 1차에 카테고리 필터를 포함할지
- 최근 아이콘 저장 범위를 전역/프로젝트 단위 중 무엇으로 할지
- fallback 정책을 "미표시"로 고정할지, 기본 아이콘을 둘지