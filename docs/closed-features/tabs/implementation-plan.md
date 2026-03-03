# Magam Tabs 기능 구현 계획서

## 1. 문서 목적 및 범위
- 본 문서는 `docs/features/tabs/README.md`(PRD)를 구현 가능한 엔지니어링 계획으로 구체화한다.
- 1차 릴리스 범위:
  - 상단 탭 바 기반 다중 페이지 관리
  - 단축키 `Cmd/Ctrl+T`, `Cmd/Ctrl+W`
  - 탭 단위 뷰포트/선택 상태 복원
  - 더티(unsaved) 상태 UX 및 닫기 가드
  - 탭 수 제한(기본 10) 정책
  - telemetry 계측 및 점진 롤아웃
- 제외 범위(비목표 준수):
  - 멀티 윈도우 동기화
  - 협업 사용자 간 탭 상태 동기화
  - 탭 드래그 정렬

## 2. PRD 정렬 요약
- FR-1 탭 바: 탭 제목/더티 점/닫기 버튼/활성 강조 제공
- FR-2 탭 열기: `Cmd/Ctrl+T`로 페이지 선택기 오픈 후 탭 생성 또는 기존 탭 활성화
- FR-3 탭 닫기: `Cmd/Ctrl+W` 및 X 버튼 지원, 더티 탭은 확인 모달 필수
- FR-4 상태 복원: 탭별 viewport/selection 캐시 및 안전 복원
- FR-5 탭 제한: 10개 초과 시 교체 확인 UX
- NFR: 탭 전환 평균 150ms 이하, 접근성 속성, 안정성/관측성 확보

## 3. 아키텍처 및 상태 모델

### 3.1 핵심 타입(초안)
```ts
type TabId = string; // `${pageId}` 또는 내부 UUID
type PageId = string;

type ViewportState = {
  zoom: number;
  panX: number;
  panY: number;
};

type SelectionState = {
  nodeIds: string[];
  edgeIds: string[];
  updatedAt: number;
};

type TabState = {
  tabId: TabId;
  pageId: PageId;
  title: string;
  dirty: boolean;
  lastViewport: ViewportState | null;
  lastSelection: SelectionState | null;
  lastAccessedAt: number; // LRU 교체 판단
  createdAt: number;
};

type TabsStore = {
  openTabs: TabState[];
  activeTabId: TabId;
  maxTabs: number; // 기본 10
};
```

### 3.2 불변 조건(Invariants)
- `openTabs.length >= 1` 유지
- `activeTabId`는 항상 `openTabs` 내부 탭을 가리킴
- `pageId` 기준 중복 탭 생성 금지(동일 페이지 재오픈 시 activate)
- `dirty`는 기존 저장 파이프라인 이벤트를 단일 소스로 반영

### 3.3 액션 계약(Contract)
- `openTab(pageId)`
  - 이미 열린 페이지면 해당 탭 활성화
  - 미오픈 페이지면 새 탭 생성 후 활성화
  - 한도 초과 시 교체 확인 플로우 진입
- `activateTab(tabId)`
  - 현재 활성 탭 UI 상태 flush 후 대상 탭 복원
- `requestCloseTab(tabId, source)`
  - `dirty=false`면 즉시 close
  - `dirty=true`면 확인 모달 표시
- `closeTab(tabId, strategy)`
  - 닫힌 탭 옆 탭 우선 활성화, 없으면 최근 접근 탭
  - 마지막 탭 닫힘 시 fallback 페이지 탭 생성/활성화
- `markTabDirty(tabId, dirty)`
- `updateTabSnapshot(tabId, viewport, selection)`

## 4. 단축키 설계 (`Cmd/Ctrl+T`, `Cmd/Ctrl+W`)

### 4.1 키 매핑 정책
- macOS: `metaKey + t`, `metaKey + w`
- Windows/Linux: `ctrlKey + t`, `ctrlKey + w`
- 동일 핸들러 경로로 플랫폼 분기 최소화

### 4.2 이벤트 처리 원칙
- 입력 포커스 보호:
  - `input`, `textarea`, `contenteditable`, 코드 에디터 포커스 시 단축키 무시
- 앱 캔버스/셸 포커스 내부에서만 `preventDefault()` 수행
- 모달 오픈 시 단축키 우선순위:
  - 확인 모달이 활성화되어 있으면 탭 열기/닫기 단축키 비활성

### 4.3 동작 시나리오
- `Cmd/Ctrl+T`: 페이지 선택기(Quick Open) 오픈
  - 페이지 선택 시 `openTab(pageId)`
  - ESC로 취소 가능
- `Cmd/Ctrl+W`: 현재 활성 탭 `requestCloseTab(activeTabId, "shortcut")`

## 5. 상태 복원(restore) 설계

### 5.1 캡처 타이밍
- 탭 비활성화 직전
- 캔버스 뷰포트 변경 debounce(예: 120ms)
- 선택 변경 이벤트 발생 시

### 5.2 복원 순서
1. 대상 탭 페이지 렌더 준비
2. `lastViewport` 적용(zoom/pan)
3. `lastSelection` 검증 후 적용
4. 존재하지 않는 요소는 selection에서 제외하고 안전 초기화

### 5.3 성능 목표 달성 전략
- 탭 콘텐츠 컴포넌트 재사용(재마운트 최소화)
- viewport 적용을 첫 페인트 직후 우선 처리
- selection 복원 실패는 non-blocking 처리

## 6. Unsaved-State UX(더티 상태 UX)

### 6.1 시각 표현
- 탭 제목 좌측 또는 우측에 `●` 표시
- 색상 대비 기준 충족(접근성)
- hover 툴팁: "저장되지 않은 변경사항"

### 6.2 닫기 확인 모달
- 트리거: 더티 탭 닫기(X, 단축키, 우클릭 일괄 닫기)
- 버튼:
  - `저장 후 닫기`
  - `저장 안 함`(discard)
  - `취소`
- 기본 포커스: `취소`(오동작 방지)
- 단축키:
  - `Enter`: 기본 포커스 버튼 실행
  - `Esc`: 취소

### 6.3 일괄 닫기 정책
- `다른 탭 닫기`, `모두 닫기`는 dirty 탭 수를 집계해 요약 모달 표시
- 저장 실패 탭은 닫지 않고 사용자에게 실패 항목 표시

## 7. 단계별 구현(Phases)

## Phase 0. 설계 고정 및 계측 준비
- 산출물:
  - 탭 상태 타입/액션 시그니처 확정
  - telemetry 이벤트 스키마 정의
  - feature flag 키 정의(`tabs_v1`)
- 종료 기준:
  - 상태 모델/이벤트명 리뷰 승인

## Phase 1. 상태 스토어 및 도메인 로직
- 작업:
  - `open/activate/close/duplicate-block/max-limit` 구현
  - 마지막 탭 fallback 정책 구현
  - dirty 반영 인터페이스 연결
- 테스트:
  - 순수 로직 단위 테스트(경계 케이스 포함)
- 종료 기준:
  - 핵심 reducer/action 테스트 통과

## Phase 2. 탭 바 UI + 접근성
- 작업:
  - 탭 바 렌더링, 활성 강조, X 버튼
  - `aria-selected`, `aria-controls`, 키보드 포커스 이동
  - overflow 스크롤 UI
- 테스트:
  - 렌더/상호작용 컴포넌트 테스트
- 종료 기준:
  - PRD FR-1 충족

## Phase 3. 단축키 및 페이지 선택기 연동
- 작업:
  - `Cmd/Ctrl+T`, `Cmd/Ctrl+W` 바인딩
  - 텍스트 입력 포커스 예외 처리
  - 페이지 선택기에서 기존 탭 활성화/신규 탭 생성 분기
- 테스트:
  - 플랫폼 키 조합 시뮬레이션
- 종료 기준:
  - PRD FR-2, FR-3(비더티 케이스) 충족

## Phase 4. 복원 + 더티 가드 완성
- 작업:
  - viewport/selection 스냅샷 캡처 및 복원
  - 더티 모달(저장/취소/닫기) 연결
  - 삭제된 선택 요소 안전 처리
- 테스트:
  - 전환 100ms 내 복원 검증
  - 모달 분기 E2E
- 종료 기준:
  - PRD FR-3(더티), FR-4 충족

## Phase 5. 제한 정책/관측성/하드닝
- 작업:
  - 10개 제한 + LRU 교체 확인 UX
  - telemetry 송신/대시보드 지표 연결
  - 오류 처리 및 회귀 점검
- 테스트:
  - 성능/안정성/접근성 QA
- 종료 기준:
  - PRD FR-5 + NFR 충족

## 8. 테스트 전략

### 8.1 단위 테스트
- 스토어 로직:
  - 중복 open 금지
  - close 후 active 재결정
  - maxTabs 초과 플로우
  - dirty 상태 변경
- 복원 유틸:
  - selection 유효성 필터링

### 8.2 통합 테스트
- 탭 클릭 전환 시 viewport/selection 복원
- 더티 탭 닫기 모달 분기
- 우클릭 메뉴(`닫기`, `다른 탭 닫기`, `모두 닫기`) 동작

### 8.3 E2E 테스트
- `Cmd/Ctrl+T`로 페이지 선택 후 탭 활성화
- `Cmd/Ctrl+W` 닫기 + 더티 모달 처리
- 마지막 탭 닫힘 fallback 페이지 이동
- 탭 10개 초과 시 안내/취소/교체 확인

### 8.4 비기능 테스트
- 성능:
  - 탭 전환 평균/95p 측정(목표 150ms 이하)
  - 복원 완료 시간(목표 100ms 이내)
- 안정성:
  - 탭 연속 전환/닫기 스트레스 테스트에서 크래시 0
- 접근성:
  - 키보드-only 탐색
  - 스크린리더 속성 검증

### 8.5 Telemetry 검증
- 이벤트:
  - `tabs_opened`, `tabs_closed`, `tabs_switched`
  - `tabs_close_dirty_prompted`, `tabs_restore_failed`
  - `tabs_limit_prompted`, `tabs_limit_replaced`
- 검증:
  - 이벤트 누락률/중복률 점검
  - 속성(`source`, `tabCount`, `dirty`) 정확성 확인

## 9. 롤아웃 계획

### 9.1 Feature Flag 단계
1. 내부 개발자(100% on)
2. dogfood 그룹(10~20%)
3. 베타 사용자(50%)
4. 전체 배포(100%)

### 9.2 단계별 게이트
- Gate A: 기능 정확성(핵심 E2E 통과)
- Gate B: 성능(전환 150ms 목표 충족)
- Gate C: 오류율(탭 관련 에러 < 1%)
- Gate D: 사용자 피드백(치명 UX 이슈 없음)

### 9.3 롤백 전략
- flag 즉시 off로 비활성화
- 기존 단일 페이지 네비게이션 경로 유지
- 롤백 시 telemetry 태그로 영향 범위 추적

## 10. 리스크 및 대응
- 브라우저 기본 단축키 충돌
  - 대응: 앱 포커스 내부에서만 가로채기, 충돌 감지 시 안내
- 더티 상태 오검출/누락
  - 대응: 저장 파이프라인 이벤트 단일 소스화, 회귀 테스트 강화
- 탭 캐시로 인한 메모리 증가
  - 대응: maxTabs 제한 + 비활성 탭 스냅샷 경량화
- 복원 실패로 인한 UX 저하
  - 대응: viewport 우선 복원, selection 실패 시 안전 초기화 및 이벤트 로깅
- 일괄 닫기 시 사용자 실수
  - 대응: dirty 요약 모달, 기본 포커스 `취소`

## 11. Definition of Done (DoD)
- PRD FR-1~FR-5 Acceptance Criteria 전부 충족
- `Cmd/Ctrl+T`, `Cmd/Ctrl+W`가 플랫폼별 동일 동작
- 텍스트 입력/에디터 포커스 중 단축키 미동작 확인
- 탭 전환 평균 150ms 이하, 복원 100ms 이내 달성
- 더티 탭 보호 모달 및 저장/취소/저장 안 함 분기 정상
- 접근성 속성 및 키보드 탐색 기준 충족
- telemetry 이벤트 수집/대시보드 확인 완료
- QA 체크리스트 및 회귀 테스트 완료

## 12. 구현 체크리스트
- [ ] 상태 타입/스토어/액션 구현 및 테스트 추가
- [ ] 중복 탭 방지 및 active 탭 불변 조건 구현
- [ ] 탭 바 UI(제목/dirty/X/활성 강조/overflow) 구현
- [ ] 탭 접근성 속성(`aria-selected`, `aria-controls`) 반영
- [ ] `Cmd/Ctrl+T` 단축키로 페이지 선택기 오픈 연결
- [ ] `Cmd/Ctrl+W` 단축키로 활성 탭 닫기 연결
- [ ] 입력 포커스 예외 처리(`input/textarea/contenteditable/editor`)
- [ ] 더티 탭 닫기 확인 모달(저장/저장 안 함/취소) 구현
- [ ] 탭별 viewport/selection 스냅샷 저장 구현
- [ ] 탭 재활성화 시 복원 + invalid selection 안전 처리
- [ ] 탭 10개 제한 및 LRU 교체 확인 UX 구현
- [ ] 우클릭 메뉴 `닫기/다른 탭 닫기/모두 닫기` 구현
- [ ] 마지막 탭 닫힘 fallback 페이지 정책 구현
- [ ] telemetry 이벤트 추가 및 검증
- [ ] 단위/통합/E2E/성능/접근성 테스트 통과
- [ ] feature flag 롤아웃/롤백 절차 문서화

## 13. 미해결 의사결정(Open Decisions)
- `Cmd/Ctrl+T` 기본 동작을 페이지 선택기 즉시 오픈으로 확정할지
- 마지막 탭 닫힘 fallback을 홈 vs 최근 페이지 중 무엇으로 고정할지
- 탭 상태의 세션 간 복원(localStorage)을 1차 범위에 포함할지
- 최대 탭 수(10)를 설정값으로 노출할지 고정할지
