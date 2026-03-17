---
title: ADR-0007 Canonical Mutation Query Core Contract-First and Staged Transport Rollout
date: 2026-03-17
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - contracts
  - mutation
  - query
  - transport
  - ws
  - cli
aliases:
  - Canonical Mutation Query Core ADR
  - transport-staged mutation/query ADR
  - canonical mutation transport boundary ADR
---

# ADR-0007: Contract-First Canonical Mutation Query Core with Staged Transport Rollout

## Context

ADR-0005는 Magam이 database-first canvas platform으로 전환한다고 결정했다. 그 umbrella 방향 아래에서 `canonical-object-persistence` 다음 slice는 `canonical-mutation-query-core`다.

`docs/features/database-first-canvas-platform/README.md`는 이 slice의 위치와 역할을 다음처럼 고정한다.

- `canonical-object-persistence` 다음에 `canonical-mutation-query-core`를 잠근다.
- 그 다음부터 두 레인이 병렬로 열린다.
  - UI 레인: `canvas-ui-entrypoints`
  - CLI 레인: `ai-cli-headless-surface` -> `app-attached-session-extension`
- mutation/query core가 먼저 있어야 UI entrypoint와 CLI가 같은 domain action path를 공유할 수 있다.
- headless CLI는 mutation/query core 위의 얇은 transport여야 한다.

즉 이 slice의 책임은 “모든 transport를 완성하는 것”이 아니라, 이후 UI/CLI/plugin이 공통으로 소비할 수 있는 query/mutation core contract를 먼저 고정하는 데 있다.

현재 repository에는 이미 다음 경로가 있다.

- shared canonical storage truth: `libs/shared/src/lib/canonical-persistence/*`
- current in-app transport/adapter path: `app/ws/methods.ts`, `app/ws/rpc.ts`
- current editor command producer path: `app/features/editing/*`, `app/hooks/useFileSync*`

여기서 새 decision이 필요한 이유는 다음과 같다.

1. `canonical-mutation-query-core`가 transport-neutral shared core인지, 아니면 WS/CLI를 한 번에 구현하는 slice인지 경계를 명확히 해야 한다.
2. “UI와 AI가 같은 mutation surface를 쓴다”는 문장을 현재 slice 범위에서 어떻게 해석할지 고정해야 한다.
3. 기존 WS adapter를 활용한 점진 전환과, 다음 slice의 headless CLI 구현 사이의 책임 경계를 명확히 해야 한다.

## Decision Drivers

- umbrella feature가 정의한 slice 순서와 병렬 시점을 유지해야 한다.
- mutation/query core는 UI와 future CLI가 같은 domain contract를 공유하게 만들어야 한다.
- current WS path는 존재하는 실행 진입점이므로 점진 전환의 첫 adapter로 활용하는 편이 안전하다.
- CLI UX 및 app-attached session bridge는 명시적으로 다음 slice 책임이어야 한다.
- transport마다 별도 domain rule을 만들지 않고, shared contract와 executor를 lowest stable layer에 둬야 한다.

## Decision

다음을 채택한다.

1. `canonical-mutation-query-core`는 **transport-neutral domain contract + query service + mutation executor**를 shared layer에 도입하는 slice로 정의한다.
2. 이 slice에서 실제로 연결하는 in-repo adapter는 **기존 WS/editor 경로**를 우선 사용한다.
3. `ai-cli-headless-surface`는 이 slice에서 새로 만든 shared contract의 **다음 slice consumer**로 남긴다.
4. 이 slice에서 “UI와 AI가 같은 mutation surface를 쓴다”는 의미는 **같은 domain contract와 envelope를 공유한다**는 뜻이지, **같은 시점에 WS와 CLI adapter를 둘 다 완성한다**는 뜻은 아니다.
5. transport-neutrality는 shared contract, structured envelope, revision/concurrency contract, adapter-independent test로 보장한다.

## Decision Details

### Ownership Boundary

- `libs/shared/src/lib/canonical-mutation-query/*`
  - query request/result envelope
  - mutation request/result envelope
  - validation/failure mapping
  - query service
  - mutation executor
  - revision/concurrency contract
- `app/ws/*`
  - current app runtime transport adapter
  - shared contract를 WS response/request로 직렬화하는 역할
- `app/features/editing/*`, `app/hooks/useFileSync*`
  - UI intent를 shared mutation/query contract 소비 경로로 연결하는 producer/client adapter
- `docs/features/database-first-canvas-platform/ai-cli-headless-surface/*`
  - next slice에서 같은 shared contract를 headless CLI transport로 노출하는 consumer

### Scope Interpretation

이 ADR은 현재 slice의 완료 기준을 다음처럼 해석한다.

- 포함:
  - shared query/mutation contract 고정
  - shared executor/query service 구현
  - WS/editor path를 shared core에 연결
  - next slice가 재사용할 수 있는 JSON envelope/revision contract 고정
- 제외:
  - shell-facing CLI UX
  - app-attached session bridge
  - CLI transport bootstrap 자체 구현

### Validation Rule

transport-neutrality는 “transport 수”가 아니라 “shared core의 존재와 adapter 간 rule drift 부재”로 판단한다.

따라서 이 slice의 핵심 검증은 다음이다.

- WS adapter가 shared executor/query service만 사용한다.
- validation rule과 error code가 shared core에서 정의된다.
- future CLI가 추가 로직 없이 같은 envelope를 재사용할 수 있다.
- 다음 slice가 필요한 contract 정보가 문서/타입/테스트로 남는다.

## Alternatives Considered

### A. WS adapter와 headless CLI adapter를 이 slice에서 함께 구현한다

- 장점: “UI와 AI가 같은 surface”를 가장 직접적으로 입증할 수 있다.
- 단점: umbrella slice 순서를 흐린다.
- 단점: `ai-cli-headless-surface` slice 책임을 앞당겨 범위를 확장한다.
- 단점: CLI UX/bootstrapping 결정이 core contract를 역으로 굳힐 위험이 있다.
- 결론: 비채택

### B. shared core를 먼저 만들고, 현재 slice에서는 WS adapter만 연결한다 (채택)

- 장점: umbrella README가 정의한 선형 의존성을 그대로 따른다.
- 장점: existing runtime에서 즉시 검증 가능한 adapter가 있다.
- 장점: headless CLI를 다음 slice의 얇은 consumer로 유지할 수 있다.
- 장점: domain rule drift 없이 transport를 단계적으로 추가할 수 있다.
- 단점: 문서 표현이 부정확하면 “AI path가 빠졌다”는 오해가 생길 수 있다.
- 결론: 최종 채택

### C. shared core만 문서/타입으로 고정하고 어떤 adapter도 연결하지 않는다

- 장점: shared boundary는 가장 깔끔하다.
- 단점: 실제 실행 경로 검증이 약해진다.
- 단점: 기존 WS path와의 통합 리스크가 다음 단계로 밀린다.
- 결론: 비채택

## Consequences

### Positive

- slice 경계가 umbrella feature의 병렬 시점과 일관되게 유지된다.
- current WS path로 shared core를 먼저 검증할 수 있다.
- next slice의 headless CLI는 얇은 transport consumer로 유지된다.
- “UI와 AI가 같은 mutation surface”는 shared contract 관점에서 일관되게 해석된다.

### Negative

- 문서나 테스트가 부정확하면 “CLI가 아직 없는데 왜 AI와 공유한다고 쓰는가?”라는 해석 충돌이 생길 수 있다.
- 초기 구현 태스크가 WS adapter 중심으로 보일 수 있다.
- transport-neutrality를 입증하려면 adapter-independent contract test와 명시적 handoff 문서가 필요하다.

## Follow-up

1. `canonical-mutation-query-core` spec/plan/tasks는 이 ADR의 해석을 반영해야 한다.
2. 현재 slice 문서에서는 “UI와 AI가 같은 surface”를 “같은 shared domain contract를 공유한다”는 뜻으로 명확히 표현해야 한다.
3. tasks에는 WS adapter 연결 외에도 CLI-ready envelope/revision contract 검증이 포함되어야 한다.
4. `ai-cli-headless-surface` slice는 이 ADR을 참조해 shared contract를 transport wrapper로만 노출해야 한다.

## Related Decisions

- ADR-0005: database-first canvas platform의 상위 방향과 slice 순서를 정의한다.
- ADR-0006: canonical shared contract extraction과 canonical persistence workflow split을 정의한다.
