# Theme System 구현 계획서

## 1. 문서 목적 및 범위

본 문서는 `/docs/features/theme-system/README.md`(PRD)를 구현 가능한 작업 단위로 세분화한 실행 계획이다.  
대상 범위는 라이트/다크/시스템 모드, 토큰 체계 정립, 앱 전역 적용, 영속화, 테스트/릴리즈 체계까지 포함한다.

- 기준 PRD: `/Users/danghamo/Documents/gituhb/graphwritev2/docs/features/theme-system/README.md`
- 구현 범위: FR-1 ~ FR-5, AC-1 ~ AC-14 충족
- 비범위: 사용자 커스텀 테마 편집, 화이트라벨 브랜딩, 전용 고대비 테마

## 2. 요구사항 매핑 (PRD 정렬)

- 모드 지원: `light | dark | system` (FR-1)
- 적용 범위: 앱 셸, 캔버스, 노드 상태, 패널, 버튼/입력/모달/토스트 (FR-2)
- 영속화: `localStorage.theme` 사용, 초기화 우선순위 준수 (FR-3)
- 접근성: 텍스트 대비 4.5:1, 보조/비활성 3:1, 포커스 식별성 확보 (FR-4)
- 가드레일: semantic 우선, 하드코딩 신규 금지, 문서/체크리스트/CI 반영 (FR-5)

## 3. 아키텍처 결정

### 3.1 테마 상태 모델

- `mode`: 사용자가 선택한 값 (`light|dark|system`)
- `resolvedTheme`: 실제 적용값 (`light|dark`)
- 분리 이유:
  - `system` 모드일 때 OS 변경 이벤트를 반영해야 함
  - UI 표시는 mode 기준, DOM 적용은 resolvedTheme 기준으로 분리 필요

### 3.2 적용 방식

- 루트 엘리먼트(`document.documentElement`)에 `data-theme` 부여
- 모든 컴포넌트는 semantic token만 참조
- primitive token은 테마 정의 레이어에서만 직접 사용

## 4. 토큰 전략 (Primitive / Semantic)

### 4.1 Primitive Token

목적: 실제 색상값의 SSOT.

- 네이밍 규칙: `--color-{family}-{scale}`
  - 예: `--color-gray-0`, `--color-gray-900`, `--color-blue-500`, `--color-red-500`
- 색상군 최소 구성:
  - Neutral: gray scale (배경/텍스트/경계선 기반)
  - Brand: primary/action
  - State: success/warning/danger/info
- 규칙:
  - primitive는 컴포넌트에서 직접 참조 금지
  - 변경은 테마 정의 파일에서만 허용

### 4.2 Semantic Token

목적: UI 의미 단위의 안정적 계약(Contract) 제공.

- 네이밍 규칙: `--{domain}-{role}-{state?}`
  - `--bg-canvas`, `--bg-surface`, `--text-primary`, `--text-secondary`
  - `--border-default`, `--focus-ring`
  - `--state-danger-fg`, `--state-danger-bg`
- 도메인 분류:
  - Global: 배경/텍스트/보더/포커스
  - Canvas: 캔버스 배경/그리드/선택/호버
  - Component: 버튼/입력/모달/토스트/배지
  - State: success/warning/danger/info (fg/bg/border 쌍)
- 규칙:
  - 컴포넌트 스타일은 semantic token만 사용
  - semantic 추가 시 사용 위치와 접근성 근거 문서화

### 4.3 토큰 거버넌스

- 신규 token 추가 조건:
  - 기존 semantic으로 표현 불가할 것
  - 최소 2개 이상의 사용처가 있거나 장기 재사용 근거가 있을 것
- 금지:
  - 의미 중복 token 난립 (`--text-muted`, `--text-subtle` 무분별 추가)
  - 화면 전용 이름 (`--dashboard-blue`) 사용

## 5. CSS Variable Layering 설계

### 5.1 레이어 정의

1. Layer A: Primitive (`:root`)
- 순수 색상값 정의

2. Layer B: Semantic Base (`:root`)
- 기본(라이트) semantic 매핑

3. Layer C: Theme Override (`[data-theme='dark']`)
- dark에서 semantic 값만 오버라이드

4. Layer D: Contextual Alias (선택)
- 특정 컴포넌트 컨텍스트 alias
- 예: `--button-bg-primary: var(--action-primary-bg)`

### 5.2 적용 원칙

- dark 모드에서 primitive 재정의 금지, semantic override 우선
- 컴포넌트 CSS/스타일 시스템은 Layer B/C/D만 참조
- 테마 전환 시 repaint 비용 최소화를 위해 class 토글 대신 루트 dataset 변경 사용

### 5.3 예시 구조

```css
:root {
  /* A. Primitive */
  --color-gray-0: #ffffff;
  --color-gray-50: #f8fafc;
  --color-gray-900: #0f172a;
  --color-blue-500: #3b82f6;
  --color-red-500: #ef4444;

  /* B. Semantic (light default) */
  --bg-canvas: var(--color-gray-50);
  --bg-surface: var(--color-gray-0);
  --text-primary: var(--color-gray-900);
  --focus-ring: var(--color-blue-500);
  --state-danger-fg: var(--color-red-500);
}

[data-theme='dark'] {
  /* C. Semantic override only */
  --bg-canvas: #020617;
  --bg-surface: #0f172a;
  --text-primary: #f8fafc;
  --focus-ring: #60a5fa;
  --state-danger-fg: #f87171;
}
```

## 6. 테마 영속화 설계

### 6.1 저장 스키마

- 키: `localStorage.theme`
- 값: `light | dark | system`
- 기본값: 저장값 없음 + 시스템값 없음 시 `light`

### 6.2 초기화 우선순위

1. 사용자 저장값(`localStorage.theme`)
2. 시스템 설정(`prefers-color-scheme`)
3. 기본값(`light`)

### 6.3 FOUC 최소화

- 앱 hydration 이전에 실행되는 부트스트랩 스크립트로 `data-theme` 선적용
- 목표: AC-6 (육안 FOUC 미감지)

### 6.4 예외 처리

- `localStorage` 접근 실패(사파리 private 등) 시:
  - 메모리 fallback으로 현재 세션 동작 유지
  - 사용자에게 저장 실패 경고 토스트 노출

## 7. 시스템 테마 동기화 설계

### 7.1 동작 정책

- `mode !== system`이면 OS 이벤트 무시
- `mode === system`이면 `matchMedia('(prefers-color-scheme: dark)')` 구독
- 이벤트 발생 시 1초 이내 `resolvedTheme` 및 `data-theme` 갱신

### 7.2 기술 포인트

- 이벤트 리스너 정리(cleanup) 필수 (메모리 누수 방지)
- 탭 복귀/백그라운드 복원 시 상태 재검증

## 8. 마이그레이션 전략

### 8.1 원칙

- 신규 코드: semantic token 강제
- 기존 코드: 화면 단위 점진 전환
- 하드코딩 색상과 토큰 혼재 기간 최소화

### 8.2 단계

1. 인벤토리
- 하드코딩 색상 검색(HEX/RGB/HSL)
- 컴포넌트별 치환 우선순위 목록화

2. 브릿지 도입
- 기존 스타일 값에 대해 임시 alias semantic 제공
- 대규모 UI 깨짐 없이 점진 치환

3. 집중 치환
- 공용 컴포넌트(버튼/입력/모달/토스트) 우선
- 캔버스/노드 상태는 별도 QA 트랙으로 병행

4. 가드레일 활성화
- lint/CI에서 신규 하드코딩 색상 차단 (예외 allowlist 관리)

5. 잔여 제거
- 브릿지 token 정리, 미사용 token 제거

### 8.3 완료 기준

- PRD AC-3/AC-4 충족
- 주요 화면에서 semantic token 커버리지 100%

## 9. 단계별 실행 계획 (Phase)

### Phase 0. 준비 (0.5주)

- 산출물:
  - 색상 인벤토리 리포트
  - 토큰 네이밍 룰 문서 초안
- 종료 조건:
  - 우선순위 화면/컴포넌트 확정

### Phase 1. 토큰 기반 인프라 (1주)

- 산출물:
  - primitive/semantic 토큰 세트 정의
  - ThemeProvider + `useTheme()` 도입
  - 초기 부트스트랩(Fouc 방지) 구현
- 종료 조건:
  - 모드 변경 시 앱 셸 반영
  - 영속화/초기화 우선순위 동작

### Phase 2. 공용 컴포넌트 전환 (1주)

- 산출물:
  - 버튼/입력/모달/토스트/패널 semantic 치환
  - 포커스 링/disabled 상태 토큰 정렬
- 종료 조건:
  - 접근성 대비 기준 샘플 검증 통과

### Phase 3. 캔버스/노드 전환 (1주)

- 산출물:
  - 캔버스 배경/그리드/선택/호버/에러 토큰화
  - 노드 상태 색상 일관화
- 종료 조건:
  - 핵심 편집 플로우 시각 회귀 없음

### Phase 4. 품질 게이트 및 릴리즈 준비 (0.5~1주)

- 산출물:
  - 단위/통합/E2E 테스트 보강
  - CI 하드코딩 색상 차단 룰 적용
  - 릴리즈 체크리스트/운영 가이드
- 종료 조건:
  - AC-1~AC-14 및 AC-11~AC-12 충족

## 10. 테스트 전략

### 10.1 단위 테스트

- `mode -> resolvedTheme` 계산
- 초기화 우선순위(저장값/시스템/기본값)
- localStorage read/write 및 예외 처리
- system 모드에서 media query 이벤트 처리

### 10.2 통합 테스트

- 설정 UI 변경 시 DOM `data-theme` 반영
- 모드 전환 후 공용 컴포넌트 스타일 토큰 검증
- 포커스 링 가시성 검증

### 10.3 E2E 테스트

- `light/dark/system` 전환 시나리오
- 새로고침/재접속 시 영속화 유지
- system 모드에서 OS 테마 변경 반영
- 핵심 화면 5개 대비 점검 자동화(4.5:1, 보조 3:1)

### 10.4 비기능 테스트

- 성능: 테마 전환 시 메인 스레드 블로킹 100ms 이하
- 안정성: 토글 50회 반복 JS 에러 0건
- 시각 회귀: 주요 컴포넌트 스냅샷 비교

## 11. 롤아웃 전략

### 11.1 단계적 배포

1. 내부 스테이징 + QA 시나리오 고정
2. 사내/도그푸딩 사용자 대상 선배포
3. 전체 배포

### 11.2 관측/모니터링

- 에러 지표: 테마 전환 관련 런타임 에러
- UX 지표: 설정 변경 성공률, 저장 실패율
- 제품 지표: 비기본 모드 사용률, 색상 버그 발생률

### 11.3 롤백 기준

- 테마 전환 오류율 임계치 초과
- 핵심 편집 플로우 시각 회귀 중대 이슈 발생
- 롤백 방식: 토글 UI 비활성화 + 기본 라이트 고정(핫픽스)

## 12. 리스크 및 대응

- 리스크: 레거시 하드코딩 잔존으로 혼합 테마 발생  
대응: 인벤토리 + 린트 + PR 체크리스트 + 화면별 검수표

- 리스크: 브라우저별 `prefers-color-scheme` 동작 편차  
대응: Chromium/WebKit/Firefox 회귀 매트릭스 운영

- 리스크: 브랜드 색상과 대비 기준 충돌  
대응: 본문 텍스트는 중립 팔레트, 브랜드 색은 액션/강조 중심 제한

- 리스크: FOUC 체감  
대응: 부트스트랩 선적용 + 초기 렌더 경로 최소화

- 리스크: 토큰 난립으로 유지보수 악화  
대응: token 추가 심사 규칙, 분기별 미사용 token 청소

## 13. DoD (Definition of Done)

아래를 모두 만족해야 완료로 본다.

- AC-1 ~ AC-14 전부 충족
- 라이트/다크/시스템 모드 기능 동작 및 회귀 테스트 통과
- semantic token 커버리지 100%(주요 공용 컴포넌트 기준)
- 신규 하드코딩 색상 CI 차단 동작 확인
- 접근성 대비 기준 충족 보고서 첨부
- 테마 전환 성능/안정성 기준 충족(100ms, 50회 에러 0)
- 운영/롤백 가이드 문서화

## 14. 구현 체크리스트

### 14.1 설계/인프라

- [ ] token 네이밍 룰 확정 (primitive/semantic)
- [ ] primitive 팔레트 정의
- [ ] semantic 토큰 표(사용처/대비 근거 포함) 작성
- [ ] ThemeProvider + `useTheme()` 구현
- [ ] 초기 부트스트랩으로 `data-theme` 선적용
- [ ] localStorage 영속화 및 예외 처리
- [ ] `system` 모드 media query 구독/해제 구현

### 14.2 UI 적용

- [ ] 설정 메뉴에 `라이트/다크/시스템` 옵션 적용
- [ ] 앱 셸/패널/버튼/입력/모달/토스트 토큰 전환
- [ ] 캔버스 배경/그리드/노드 상태 토큰 전환
- [ ] 포커스 링/disabled/hover/active 시각 규칙 검증

### 14.3 품질/운영

- [ ] 단위 테스트 작성 (우선순위/영속화/시스템 동기화)
- [ ] 통합 테스트 작성 (UI 조작 -> DOM 반영)
- [ ] E2E 회귀 작성 (`light/dark/system`, 재접속, OS 변경)
- [ ] 접근성 대비 자동 점검 파이프라인 연결
- [ ] 하드코딩 색상 lint/CI 차단 룰 적용
- [ ] 배포 전 시각 회귀 점검 완료
- [ ] 롤백 조건 및 운영 모니터링 대시보드 점검

## 15. AC 커버리지 추적 표

- AC-1/2: 설정 UI + system 동기화 테스트
- AC-3/4: semantic 전환 + CI 차단 룰
- AC-5/6: localStorage + bootstrap(Fouc 방지)
- AC-7/8: 대비 점검 + 포커스 가시성 테스트
- AC-9/10: 토큰 문서 + PR 체크리스트 반영
- AC-11/12: 토글 반복 안정성 + 3모드 E2E 회귀
- AC-13/14: 설정 UX 동선 및 상태 유지 검증
