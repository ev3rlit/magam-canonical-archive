# Implementation Plan: Electron Desktop Host

**Branch**: `010-electron-desktop-host` | **Date**: 2026-03-20 | **Spec**: `/Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host/specs/010-electron-desktop-host/spec.md`  
**Input**: Feature specification from `/Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host/specs/010-electron-desktop-host/spec.md`, source brief `/Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host/docs/features/electron-desktop-host/README.md`, supporting ADR `/Users/danghamo/Documents/gituhb/magam-feature-electron-desktop-host/docs/adr/ADR-0010-electron-primary-host-and-nextjs-de-emphasis.md`

## Summary

Magam의 primary host를 Next.js에서 Electron으로 전환한다. 구현 전략은 renderer product logic을 host-neutral 경계로 고정하고, desktop startup/dev path에서 Next.js route compile 의존을 제거하며, existing RPC logical contract를 유지한 채 Electron adapter와 optional web adapter의 method parity를 확보하는 것이다.

## Technical Context

**Language/Version**: TypeScript 5.9.x, React 18, Bun 1.x  
**Primary Dependencies**: existing app runtime (`app/components/editor/WorkspaceClient.tsx`, `app/features/*`, `app/ws/*`), Next.js app router surface (`app/app/*`), planned Electron runtime adapter  
**Storage**: 기존 파일 기반 workspace + local backend service state (신규 DB 도입 없음)  
**Testing**: `bun test`, targeted regression tests (`app/components/editor/WorkspaceClient.test.tsx`, `scripts/dev/app-dev.test.ts`), `bun run typecheck:app`  
**Target Platform**: desktop-first authoring runtime (Electron shell + local backend) with optional web compatibility surface  
**Project Type**: feature-oriented modular monolith (desktop host migration slice)  
**Performance Goals**: primary startup path에서 Next.js route compile dependency 제거, desktop cold-start authoring 진입 latency 회귀 최소화  
**Constraints**: RPC logical contract 유지, renderer host-neutral 경계 보존, preload 최소 권한 노출, web surface optional 유지  
**Scale/Scope**: renderer entry wiring, host capability + RPC adapter 경계, desktop bootstrap script, Next.js surface의 secondary 역할 정렬

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate

- **I. Think Before Coding**: source brief와 ADR이 ownership 전환, 비범위, dependency direction을 명시해 구현 전 해석 ambiguity가 낮다.
- **II. Structural Simplicity**: domain RPC 재설계 없이 host adapter 계층만 재배치해 변경 표면을 최소화한다.
- **III. Feature-Oriented Modular Monolith**: renderer/domain/backend 경계를 분리한 채 desktop host 관련 slice만 다룬다.
- **IV. Dependency-Linear Design**: `Renderer -> interfaces -> adapters -> contracts -> backend` 단방향 의존을 강제한다.
- **V. Promptable Modules**: host capability, RPC adapter parity, bootstrap 경계를 별도 계약 문서로 분리해 병렬 작업 가능성을 높인다.
- **VI. Surgical Changes**: 이번 범위는 host ownership 이동에 한정하고 persistence/auto-update/code-signing은 제외한다.
- **VII. Goal-Driven and Verifiable Execution**: startup path, `/api/*` 의존 제거, contract parity, capability leakage를 검증 가능한 체크포인트로 고정한다.

Result: **PASS**

### Post-Phase-1 Re-check

- `research.md`에서 host ownership, renderer 경계, bootstrap 전략, parity 정책을 고정했다.
- `data-model.md`에서 host capability/RPC adapter/renderer session 모델과 상태 전이를 명시했다.
- `contracts/`에서 capability bridge, RPC parity, bootstrap lifecycle, secondary web boundary 계약을 정의했다.
- `quickstart.md`에서 구현 순서와 검증 게이트를 명확히 정리했다.

Result: **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/010-electron-desktop-host/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── host-capability-bridge-contract.md
│   ├── rpc-adapter-parity-contract.md
│   ├── desktop-bootstrap-contract.md
│   └── optional-web-adapter-boundary-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── app/
│   ├── page.tsx
│   └── api/
│       ├── files/route.ts
│       ├── file-tree/route.ts
│       └── render/route.ts
├── components/
│   └── editor/
│       └── WorkspaceClient.tsx
├── features/
│   ├── desktop-host/
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   ├── orchestrator.ts
│   │   └── bootstrapSession.ts
│   ├── host/
│   │   ├── contracts/
│   │   ├── renderer/
│   │   └── rpc/
│   ├── render/
│   │   └── parseRenderGraph.ts
│   └── editing/
│       ├── editability/
│       ├── commands/
│       └── createDefaults.ts
└── ws/
    ├── methods.ts
    └── filePatcher.ts

scripts/
└── dev/
    ├── app-dev.ts
    └── desktop-dev.ts
```

**Structure Decision**: 기존 app/runtime 경계를 유지하면서 `app/features/desktop-host/*`와 `app/features/host/*`를 feature slice로 추가해 renderer host-neutralization과 desktop bootstrap 책임을 분리한다. Next.js surface(`app/app/*`)는 compatibility adapter로 유지하되 primary authoring 경로에서는 필수 의존이 되지 않도록 정렬한다.

## Phase Plan

### Phase 0: Research and Decision Lock

- renderer host-neutral boundary와 forbidden dependency 목록 확정
- desktop bootstrap lifecycle(backend spawn, renderer ready, shutdown) 정책 고정
- preload 최소 권한 capability surface와 보안 제한 정책 고정
- optional web surface 역할과 RPC parity 범위 확정

### Phase 1: Design Artifacts and Contracts

- host capability/RPC adapter/renderer startup 데이터 모델 설계
- capability bridge, adapter parity, bootstrap, web boundary 계약 문서화
- 구현 순서와 검증 체크포인트를 quickstart로 정리

### Phase 2: Task Planning Readiness

- FR/SC를 user story 단위 구현 작업으로 분해
- bootstrap/adapter/renderer/wrapper 변경을 의존성 순서로 배치
- 회귀 검증 및 parity 체크를 독립 실행 가능한 task 세트로 고정

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
