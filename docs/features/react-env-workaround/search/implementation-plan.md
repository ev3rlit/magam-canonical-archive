# Search 기능 구현 계획서 (Implementation Plan)

## 1. 문서 목적
이 문서는 `/docs/features/search/README.md`의 PRD를 기반으로 Search v1을 실제 개발/검증/출시 가능한 단위로 분해한 실행 계획이다.

- 기준 문서: `/Users/danghamo/Documents/gituhb/graphwritev2/docs/features/search/README.md`
- 구현 대상 버전: Search v1 (UI/상태/내비게이션 중심)
- 비범위: 전문(full-text) 인덱싱, 고급 쿼리 문법, 서버 분산 검색

---

## 2. 목표

### 2.1 제품 목표
1. 검색 기능을 `전체 검색(Global)`과 `현재 페이지 검색(Page)` 두 가지 모드로 분리한다.
2. 검색 대상을 `Node`에 한정하지 않고 캔버스의 모든 `element`로 확장한다.
3. 결과 선택 즉시 캔버스 이동 또는 파일 전환을 수행한다.
4. 검색 입력 중에도 렌더 성능과 인터랙션 안정성을 유지한다.

### 2.2 측정 목표 (PRD 매핑)
1. 입력 후 결과 갱신 p95 <= 120ms (`NFR-1`)
2. 검색 입력 중 ReactFlow 재마운트 0회 (`NFR-2`)
3. 키보드 플로우 100% (`Cmd/Ctrl+K`, `↑/↓`, `Enter`, `Esc`) (`FR-1`, `FR-2`, `FR-6`, `FR-7`)
4. 하이라이트 조건 준수 (쿼리 길이 >= 2) (`FR-8`)

---

## 3. 범위

### 3.1 In Scope
1. 전역 검색 오버레이 UI/단축키
2. 검색 모드 전환 UI (`Global` / `Page`)
3. 캔버스 element/파일 통합 검색 결과 리스트
4. 검색 점수 계산/정렬/결과 상한(30)
5. 결과 실행: element 포커스 이동, 파일 전환
6. 매칭 element 하이라이트 적용/해제
7. 빈 상태/초기화/접근성/기본 디버그 로깅

### 3.2 Out of Scope
1. 파일 본문 검색(코드/문서 내용 인덱싱)
2. 정규식/퍼지 문법/오타 교정
3. 원격 검색 API/서버 사이드 인덱싱
4. 최근 검색어/히스토리 추천

---

## 4. 아키텍처 개요

### 4.1 컴포넌트/모듈 책임
1. `app/store/graph.ts`
- 검색 상태의 단일 소스(Single Source of Truth)
- 검색 액션: open/close, mode update, query update, result update, active index 이동, execute/clear

2. `app/utils/search.ts` (신규)
- 데이터 정규화(normalize)
- element/file 인덱스 생성
- 모드별 매칭(match)과 스코어(score)
- 정렬(sort) 및 결과 제한(limit)

3. `app/components/ui/Header.tsx`
- 검색 진입점 버튼(`Search · ⌘K`)
- 글로벌 단축키 바인딩 진입

4. `app/components/ui/SearchOverlay.tsx` (신규 권장)
- 입력창/모드 토글/결과 리스트/키 힌트/빈 상태
- 키보드 네비게이션 및 실행 트리거

5. `app/components/GraphCanvas.tsx`
- `highlightElementIds` 기반 하이라이트 스타일링
- 선택된 element와 하이라이트의 시각적 구분

6. `app/contexts/NavigationContext.tsx`
- element 이동 API(`navigateToElement`) 또는 기존 `navigateToNode` 확장 재사용
- 검색 실행 시 캔버스 중심 이동 연결

### 4.2 데이터 흐름
1. 그래프/파일 변경 이벤트 수신
2. 검색 인덱스 재계산(메모이제이션 + 정규화 캐시)
3. 사용자 query 입력 + mode 선택
4. mode별 인덱스 대상으로 normalize -> match/score -> sort -> 상위 30개
- `global`: 전체 파일 + 전체 파일의 캔버스 element
- `page`: 현재 페이지(현재 파일)의 캔버스 element 중심
5. active 결과 선택(`Enter`/click)
6. type별 실행
- `element`: element 선택 + 캔버스 center 이동 + 하이라이트 유지(짧은 TTL 또는 수동 해제)
- `file`: `currentFile` 전환 + 렌더 완료 후 오버레이 닫기
7. close/reset 시 상태 초기화

---

## 5. 데이터 모델

### 5.1 타입 정의 (권장)
```ts
export type SearchMode = 'global' | 'page';
export type SearchResultType = 'element' | 'file';

export interface SearchIndexElementItem {
  type: 'element';
  elementId: string;
  elementType: string;
  filePath: string;        // element가 속한 파일
  pageId?: string;         // 페이지 식별자(있는 경우)
  labelPlain: string;
  searchableText: string;  // id + label + type + filePath normalize 결합
}

export interface SearchIndexFileItem {
  type: 'file';
  filePath: string;        // relative path
  fileName: string;
  searchableText: string;  // filename + relative path normalize 결합
}

export type SearchIndexItem = SearchIndexElementItem | SearchIndexFileItem;

export interface SearchResult {
  type: SearchResultType;
  key: string;             // elementId 또는 filePath
  title: string;           // 표시 텍스트
  subtitle?: string;       // elementType 또는 경로
  filePath?: string;       // element 결과 실행 시 필요
  pageId?: string;
  score: number;
  matchKind: 'exact' | 'prefix' | 'contains';
}

export interface SearchState {
  isSearchOpen: boolean;
  searchMode: SearchMode;
  searchQuery: string;
  searchResults: SearchResult[];
  activeResultIndex: number; // -1 허용
  highlightElementIds: string[];
  lastExecuted?: {
    type: SearchResultType;
    key: string;
    at: number;
  };
}
```

### 5.2 점수/정렬 규칙
1. 점수
- exact: 100
- prefix: 70
- contains: 40
- id match bonus: +10 (`elementId` 직접 매칭)

2. 동점 해소
- `element` 우선
- 현재 파일/페이지 소속 항목 우선
- 문자열 길이 짧은 항목 우선
- 사전순

3. 공통 규칙
- 대소문자 비구분
- 한글/영문 원문 비교(추가 형태소 분석 없음)
- 최소 query 길이: 1
- 하이라이트 최소 query 길이: 2
- 최대 결과: 30

---

## 6. 단계별 구현 (Phase 1..6)

## Phase 1. 상태 모델/검색 코어 구축
목표: UI 없이 store + util만으로 mode/결과 계산이 정확히 동작하도록 만든다.

작업
1. `graph.ts`에 SearchState/액션 추가(`searchMode` 포함)
2. `search.ts` 신규 생성: `normalize`, `matchKind`, `scoreResult`, `buildResults`
3. 캔버스 element 텍스트 추출 유틸 연결(기존 node label 유틸은 하위 호환으로 재사용)
4. FR-3/4/5/10 단위 테스트 추가

산출물
1. 상태 변경 시 결과가 결정적으로 동일하게 생성됨
2. 모드 전환/점수/정렬 테스트 통과

완료 게이트
1. 쿼리+모드별 기대 순서 스냅샷 또는 테이블 테스트 100% 통과

---

## Phase 2. 검색 오버레이 UI/단축키
목표: 키보드 중심 검색 UX와 모드 전환 UX를 구현한다.

작업
1. Header 트리거 버튼 추가
2. `SearchOverlay` 컴포넌트 구현(입력창/모드 토글/결과/빈 상태/키 힌트)
3. 글로벌 단축키 연결
- Open/Toggle: `Cmd/Ctrl+K`
- Close: `Esc`
- Move: `ArrowUp`, `ArrowDown`
- Execute: `Enter`
4. IME 조합 중 핫키 오동작 방지 가드
5. 접근성 속성 반영 (`aria-label`, `role=listbox`, `aria-activedescendant`)

산출물
1. 마우스 없이 열기/모드전환/이동/실행/닫기 가능
2. 결과 없음 메시지 표시

완료 게이트
1. FR-1/2/9 충족
2. 접근성 smoke test 통과

---

## Phase 3. element 실행/캔버스 연동
목표: element 선택 시 즉시 캔버스 포커스 이동과 하이라이트를 보장한다.

작업
1. 결과 type=`element` 실행 핸들러 구현
2. `NavigationContext.navigateToElement` 호출 연결
3. `GraphCanvas` 하이라이트 스타일 반영
4. 선택 스타일과 하이라이트 스타일 분리(색/테두리 우선순위 명시)
5. close/clear 시 하이라이트 해제

산출물
1. Enter/click 후 해당 element로 이동
2. query 길이 >= 2에서 매칭 element 하이라이트

완료 게이트
1. FR-6/8/10 충족
2. `setCenter` 또는 동등 API 호출 검증 통합 테스트 통과

---

## Phase 4. 파일 실행/전환 안정화
목표: 파일 검색 결과 실행 시 전환/렌더/오버레이 종료 시점을 안정화한다.

작업
1. 결과 type=`file` 실행 시 `currentFile` 전환
2. 파일 전환 후 렌더 완료 시점에 오버레이 닫기
3. 실행 실패(파일 없음/경로 불일치) 예외 처리 및 안전 초기화
4. 디버그 로그: `mode`, `query`, `resultCount`, `executeType`, `durationMs`

산출물
1. 파일 결과 실행 즉시 화면 전환
2. 전환 중 크래시/깜빡임 최소화

완료 게이트
1. FR-7, NFR-4, NFR-5 충족

---

## Phase 5. 성능 최적화
목표: 1,000+ element에서 입력 반응성을 목표치 내로 맞춘다.

작업
1. 검색 입력 디바운스(100~150ms)
2. 인덱스 재생성 조건 최소화 (`elements`, `fileTree`, `currentFile` 변경 시에만)
3. normalize 캐시(Map) 적용
4. 렌더 프로파일링으로 불필요 리렌더 제거
5. 결과 렌더 상한 고정(30)

산출물
1. p95 <= 120ms 달성 리포트
2. ReactFlow 재마운트 0회 확인

완료 게이트
1. NFR-1/NFR-2 통과 로그 첨부

---

## Phase 6. 회귀 검증/출시 준비
목표: 기능 완성도와 배포 안정성을 보장한다.

작업
1. 핵심 사용자 시나리오 A/B/C E2E 검증
2. 회귀 테스트(기존 파일 탐색/캔버스 이동 영향)
3. 문서 업데이트(사용법, 키보드 단축키, 모드 설명)
4. Feature Flag 또는 점진 배포 설정

산출물
1. QA 체크리스트 완료
2. 배포/롤백 절차 문서화

완료 게이트
1. DoD 전체 충족

---

## 7. API / 이벤트 설계

### 7.1 Store 액션 계약
```ts
openSearch(): void;
closeSearch(options?: { clearQuery?: boolean }): void;
setSearchMode(mode: SearchMode): void;
setSearchQuery(query: string): void;
setSearchResults(results: SearchResult[]): void;
moveSearchActiveIndex(direction: 'up' | 'down'): void;
setSearchActiveIndex(index: number): void;
executeSearchResult(result: SearchResult): Promise<void> | void;
setHighlightElementIds(elementIds: string[]): void;
resetSearchState(): void;
```

### 7.2 UI 이벤트
1. `SEARCH_OPEN_REQUESTED` (`Cmd/Ctrl+K`, 버튼)
2. `SEARCH_MODE_CHANGED` (`global`, `page`)
3. `SEARCH_QUERY_CHANGED`
4. `SEARCH_RESULT_HOVERED`
5. `SEARCH_RESULT_EXECUTED`
6. `SEARCH_CLOSED` (`Esc`, 외부 클릭, 실행 완료)

### 7.3 Navigation/Canvas 이벤트 연결
1. `SEARCH_RESULT_EXECUTED(type=element)` -> `navigateToElement(elementId, filePath?)`
2. `SEARCH_RESULT_EXECUTED(type=file)` -> `setCurrentFile(filePath)`
3. `SEARCH_CLOSED` -> `setHighlightElementIds([])`, `activeResultIndex=-1`

### 7.4 로깅 이벤트 (디버그/텔레메트리 준비)
1. `search_opened`
2. `search_mode_changed`
3. `search_query_changed` (샘플링 가능)
4. `search_results_built` (`mode`, `count`, `durationMs`)
5. `search_executed` (`mode`, `type`, `rank`, `queryLength`)

---

## 8. UI 작업 상세

1. Header
- `Search · ⌘K` 버튼 추가
- 모바일에서는 아이콘 + `Search` 레이블 축약

2. SearchOverlay 레이아웃
- 중앙 오버레이(최대 폭 고정)
- 상단 입력, 입력 하단에 모드 토글(`Global`, `Page`)
- 중단 결과 리스트, 하단 키 힌트
- 결과 행: 타입 배지(`Element`, `File`) + 제목 + 보조 정보

3. 상태별 화면
- 초기 상태: 모드 안내 문구
- 검색 중: 디바운스 후 목록 갱신
- 결과 없음: `검색 결과 없음`
- 실행 후: 오버레이 닫힘(선택적 토스트)

4. 스타일 가이드
- 선택(활성 행) vs 하이라이트(캔버스 element) 시각 구분
- 포커스 링 명확히 표시
- 키보드 탐색 대비 hover-only UX 금지

---

## 9. 테스트 계획

### 9.1 단위 테스트
대상: `app/utils/search.ts`

1. `normalize` 한/영/대소문자 케이스
2. `matchKind` exact/prefix/contains 판정
3. score 계산(보너스 포함)
4. 동점 정렬 규칙(element 우선, 현재 페이지 우선, 길이, 사전순)
5. 결과 상한 30 적용
6. `global` / `page` 모드 필터링 검증

### 9.2 스토어 테스트
대상: `app/store/graph.ts`

1. open/close/reset 상태 전이
2. mode 변경 시 results/active index 초기화 정책
3. query clear 또는 close 시 highlight 초기화

### 9.3 컴포넌트 테스트
대상: SearchOverlay/Header

1. `Cmd/Ctrl+K` 오픈/토글
2. 모드 토글 클릭/키보드 전환
3. `ArrowUp/Down` 이동 루프 처리
4. `Enter` 실행, `Esc` 닫기
5. 빈 상태 메시지/ARIA 속성 검증

### 9.4 통합 테스트
대상: Overlay + Store + Navigation + GraphCanvas

1. element 실행 시 navigate/setCenter 호출 검증
2. file 실행 시 currentFile 변경 + 오버레이 종료
3. WS 갱신/파일 재렌더 중 크래시 없음

### 9.5 성능 테스트
1. 1,000/3,000 element 더미 데이터셋 준비
2. 입력 이벤트 100회 반복으로 p50/p95 측정
3. 렌더 카운트와 ReactFlow 재마운트 유무 확인

---

## 10. 성능 목표 및 측정 방법

### 10.1 목표
1. 결과 갱신 p95 <= 120ms (1,000 elements)
2. 검색 중 프레임 저하 최소화(체감 55fps 이상)
3. ReactFlow 전체 재마운트 0

### 10.2 측정 방법
1. `performance.now()`로 query->results duration 측정
2. React Profiler로 커밋 시간/리렌더 횟수 기록
3. 디버그 로그 누적 후 평균/p95 산출

### 10.3 튜닝 기준
1. p95 초과 시 디바운스 상향(100->150ms)
2. 하이라이트 대상 과다 시 표시 정책 제한(현재 뷰포트 element 우선)
3. normalize 캐시 적중률 < 70% 시 인덱스 구조 재검토

---

## 11. 롤아웃 계획

1. `search_v1` Feature Flag 도입
2. 개발 환경 -> 내부 사용자 -> 전체 사용자 순 점진 활성화
3. 초기 1주 동안 로그/에러 모니터링
4. 이상 징후 시 즉시 flag off로 롤백

롤백 트리거
1. 검색 관련 에러율 0.5% 초과
2. 입력 지연 p95 200ms 초과가 24시간 이상 지속
3. 파일 전환 실패/오동작 재현 케이스 다수 보고

---

## 12. 리스크와 대응

1. 대규모 데이터에서 입력 지연
- 대응: 디바운스, 캐시, 결과 상한 30, 인덱스 증분 업데이트 검토

2. 하이라이트로 인한 캔버스 리렌더 증가
- 대응: `highlightElementIds` 변경 최소화, memo 유지, 비교 함수 최적화

3. 파일 전환과 검색 종료 타이밍 경합(race)
- 대응: 전환 완료 이벤트/Promise 기반 종료 순서 강제

4. 단축키 충돌 및 IME 입력 이슈
- 대응: 입력 포커스/조합 상태 가드, 플랫폼별 단축키 테스트

5. 상태 불일치(WS 갱신/데이터 변경 중 검색)
- 대응: 인덱스 버전 관리, stale result 폐기 전략

6. element 타입별 텍스트 추출 편차
- 대응: element type별 extractor registry 도입, 미지원 타입 fallback 텍스트 규칙 정의

---

## 13. 완료 기준 (Definition of Done)

1. FR-1~FR-10 전부 테스트로 검증됨
2. NFR-1~NFR-5 측정/로그 근거가 PR에 포함됨
3. 사용자 시나리오 A/B/C E2E 통과
4. 접근성 핵심 속성(입력/모드/리스트/활성 항목) 충족
5. 성능 결과 p95 목표 달성
6. Feature Flag + 롤백 절차 문서화
7. 코드 리뷰 승인 및 회귀 이슈 0건

---

## 14. 작업 체크리스트

### 14.1 설계/준비
- [ ] PRD 요구사항(FR/NFR) 구현 항목 매핑표 작성
- [ ] 검색 모드(`global`/`page`) 상태/타입 설계 확정
- [ ] element 인덱스 생성/갱신 트리거 확정

### 14.2 구현
- [ ] `graph.ts` SearchState/액션 추가
- [ ] `search.ts` 유틸 구현(normalize/match/score/sort)
- [ ] Header 검색 트리거/단축키 연결
- [ ] SearchOverlay UI + 모드 토글 구현
- [ ] element 실행 -> `navigateToElement` 연동
- [ ] file 실행 -> `currentFile` 전환 연동
- [ ] `highlightElementIds` 스타일 반영/해제
- [ ] 디버그 로깅 이벤트 삽입

### 14.3 테스트
- [ ] 검색 유틸 단위 테스트
- [ ] 스토어 상태 전이 테스트
- [ ] 키보드 인터랙션 컴포넌트 테스트
- [ ] global/page 모드 통합 테스트
- [ ] element/file 실행 통합 테스트
- [ ] 1,000+ element 성능 측정 리포트

### 14.4 출시
- [ ] `search_v1` feature flag 연결
- [ ] 점진 배포 계획 반영
- [ ] 롤백 조건/절차 검증
- [ ] 운영 관측(로그/에러) 대시보드 체크

---

## 15. 권장 일정 (예시: 2주)
1. Day 1-2: Phase 1
2. Day 3-5: Phase 2
3. Day 6-7: Phase 3
4. Day 8-9: Phase 4
5. Day 10: Phase 5
6. Day 11-12: Phase 6 + 버퍼

본 일정은 팀 구성(프론트 1~2명, QA 1명 기준)에서 검색 v1 최소 출시를 목표로 한다.
