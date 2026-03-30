# Bidirectional Editing Backlog

> 목적: 양방향 편집 후속 개선/지원 기능을 한 곳에서 정리하고, 실행 가능한 항목은 GitHub Issue로 승격해 추적한다.

## 상태 정의
- `idea`: 아이디어 단계
- `ready`: 구현 준비 완료 (문제/범위/완료조건 명확)
- `scheduled`: 스프린트에 배정됨
- `done`: 완료

## Backlog Items

### BIDINEXT-001 — 낙관적 업데이트 확장 (update/create/reparent)
- 상태: `ready`
- 문제: move 외 편집 액션은 체감 지연/실패 피드백 일관성이 낮음
- 가치: 사용자 반응성 개선 + 실패 시 복구 UX 통일
- 범위:
  - update/create/reparent 경로에 optimistic 적용
  - 실패 시 rollback + 토스트 정책 통일
  - sourceVersion/commandId 일관 반영
- 완료조건:
  - 3개 액션 모두 optimistic + rollback 동작
  - 충돌/일반오류 UX 분리
- GitHub Issue: https://github.com/ev3rlit/magam/issues/74

### BIDINEXT-002 — VERSION_CONFLICT 고도화 (자동 재동기화 + diff 안내)
- 상태: `ready`
- 문제: 충돌 발생 시 사용자가 다음 행동을 판단하기 어려움
- 가치: 충돌 복구 시간 단축, 데이터 유실 불안 감소
- 범위:
  - conflict 수신 시 자동 재렌더/재동기화
  - 가능 시 변경 diff 요약 표시
- 완료조건:
  - conflict 후 사용자 개입 최소화
  - 충돌 후 정상 편집 재개 확인
- GitHub Issue: https://github.com/ev3rlit/magam/issues/75

### BIDINEXT-003 — 실시간 협업 presence/soft-lock
- 상태: `idea`
- 문제: 다중 사용자 환경에서 동시 편집 충돌 위험
- 가치: 충돌 사전 예방, 협업 가시성 향상
- 범위:
  - 편집 중 노드 표시(presence)
  - soft-lock 힌트 UI
- 완료조건:
  - 같은 노드 동시 수정 시 시각적 경고
- GitHub Issue: https://github.com/ev3rlit/magam/issues/76

### BIDINEXT-004 — commandId 기반 undo/redo
- 상태: `idea`
- 문제: 실수 복구가 파일 레벨/수동 방식에 의존
- 가치: 편집 안정성 향상, 실험적 작업 장려
- 범위:
  - command 단위 히스토리 스택
  - undo/redo RPC/클라이언트 동기화
- 완료조건:
  - move/update/create/reparent 되돌리기 가능
- GitHub Issue: https://github.com/ev3rlit/magam/issues/77

### BIDINEXT-005 — 배치 편집 RPC (원자적 멀티 액션)
- 상태: `idea`
- 문제: 다수 노드 조작 시 요청 수 증가/중간 불일치 가능
- 가치: 성능 개선 + 일관성 강화
- 범위:
  - batch 명령 스키마
  - 원자적 patch 적용/실패 처리
- 완료조건:
  - 다중 노드 이동/수정 1요청 처리
- GitHub Issue: https://github.com/ev3rlit/magam/issues/78

### BIDINEXT-006 — 관측성/메트릭 (RPC/충돌률/실패율)
- 상태: `ready`
- 문제: 운영 중 병목/오류 패턴 파악 어려움
- 가치: 품질 개선 사이클 가속
- 범위:
  - 핵심 RPC 성공/실패/지연 로깅
  - conflict rate 대시보드 지표 정의
- 완료조건:
  - 주요 경로 메트릭 확인 가능
- GitHub Issue: https://github.com/ev3rlit/magam/issues/79

### BIDINEXT-007 — E2E 시나리오 고정 (drag→save→notify→rerender)
- 상태: `ready`
- 문제: 회귀를 단위테스트만으로 커버하기 어려움
- 가치: 배포 안정성 강화
- 범위:
  - 핵심 플로우 Playwright E2E
  - self-origin ignore / external rerender 케이스 포함
- 완료조건:
  - CI에서 재현 가능한 핵심 플로우 검증
- GitHub Issue: https://github.com/ev3rlit/magam/issues/80

---

## 운영 규칙
1. 아이디어는 먼저 이 문서에 적고, 범위/완료조건이 명확해지면 `ready`로 전환한다.
2. `ready` 항목은 GitHub Issue로 승격하고 링크를 연결한다.
3. 스프린트 시작 시 `scheduled`로 전환하고, 완료 시 `done`으로 마감한다.
