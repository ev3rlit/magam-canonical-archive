# Phase 0 Research: Electron Desktop Host

## Decision 1: Renderer product logic는 host-neutral 경계로 유지한다

- Decision: `WorkspaceClient`, `GraphCanvas`, store/process/runtime 계층은 host interface만 참조하고 `electron`/Next route primitive 직접 의존을 금지한다.
- Rationale: host 변경이 renderer domain 계층으로 전파되면 이후 desktop/web 병행 유지와 테스트 분리가 어려워진다.
- Alternatives considered:
  - renderer 내부에서 Electron API 직접 사용: 빠르지만 경계 붕괴와 재사용성 저하를 유발한다.
  - renderer를 Electron 전용으로 재작성: 초기 비용과 회귀 위험이 과도하다.

## Decision 2: RPC logical contract는 유지하고 adapter만 분리한다

- Decision: files/file-tree/render/edit/sync logical method는 기존 경계를 유지하고 transport는 host adapter가 책임진다.
- Rationale: 이미 안정화된 backend surface를 재사용해 migration 리스크를 줄일 수 있다.
- Alternatives considered:
  - in-process direct 호출로 전환: boundary/ownership 일관성이 깨지고 optional web 재사용성이 떨어진다.
  - route handler 중심 재구성 유지: startup bottleneck을 해소하지 못한다.

## Decision 3: Desktop bootstrap은 Electron + local backend를 primary로 고정한다

- Decision: primary dev/start path는 desktop shell이 backend lifecycle을 함께 기동하고 renderer ready handshake를 거친다.
- Rationale: startup critical path에서 Next.js route compile을 제거하는 목표를 직접 충족한다.
- Alternatives considered:
  - Next.js dev server를 필수 선행: 기존 병목을 유지한다.
  - backend 수동 기동 의존: 개발 루프 안정성이 떨어진다.

## Decision 4: Preload는 capability 최소 권한 bridge만 노출한다

- Decision: preload surface는 host capability interface에서 요구하는 API만 노출하고 raw Node/Electron primitive를 전달하지 않는다.
- Rationale: desktop host 전환에서 가장 큰 보안 리스크는 과도한 권한 노출이며, capability 단위 제한이 필수다.
- Alternatives considered:
  - broad context bridge 노출: 구현은 단순하지만 보안 경계가 사실상 제거된다.
  - renderer IPC 직접 연결: 호출 경로 추적과 검증이 어려워진다.

## Decision 5: Next.js는 secondary compatibility adapter로 유지한다

- Decision: Next.js surface는 viewer/debug/review 용으로만 유지하고 primary authoring flow는 desktop host만으로 완결한다.
- Rationale: 점진적 migration이 가능하면서도 ownership을 명확히 고정할 수 있다.
- Alternatives considered:
  - 즉시 Next.js 제거: 전환 위험이 크고 디버그/호환 경로 상실 가능성이 높다.
  - 기존 primary 상태 유지: 목표 자체와 충돌한다.

## Decision 6: Clarify 단계는 현재 스펙에서 생략한다

- Decision: `speckit-clarify`는 실행하지 않는다.
- Rationale: source brief와 ADR이 목표, 비범위, 경계, acceptance를 충분히 명시하고 있어 plan/tasks 구조를 바꿀 핵심 미해결 모호성이 없다.
- Alternatives considered:
  - clarify 강제 실행: 문서 반복만 늘고 실질 의사결정 변화가 없다.
