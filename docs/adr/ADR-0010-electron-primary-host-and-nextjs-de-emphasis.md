---
title: ADR-0010 Electron Primary Host and Next.js De-emphasis
date: 2026-03-20
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - electron
  - desktop
  - nextjs
  - rpc
  - host
aliases:
  - Electron Desktop Host ADR
  - Next.js 탈중심화 ADR
  - 데스크톱 호스트 전환 ADR
---

# ADR-0010: Adopt Electron as Primary App Host and De-emphasize Next.js

## Context

현재 Magam은 `Next.js` app을 사용자-facing host처럼 사용하고 있지만, 실제 제품 책임은 이미 상당 부분 다른 계층에 있다.

- editor UI와 canvas runtime은 client renderer에 있다.
- 파일 목록, 파일 트리, 렌더, 파일 동기화, 채팅의 실질 로직은 local backend/service 쪽에 있다.
- `Next.js` route handler는 그 backend를 감싸는 thin proxy 역할이 크다.

이 구조는 웹 제품이면 자연스러울 수 있지만, 현재 제품 방향은 그렇지 않다.

- 주요 소비 경로는 브라우저보다 데스크톱 앱이다.
- SSR, SEO, edge runtime은 primary value가 아니다.
- 제품의 핵심은 local workspace, canvas authoring, AI/runtime integration이다.

게다가 host 비용이 명확하게 드러나기 시작했다.

- cold start에서 `/`, `/api/files`, `/api/file-tree`, `/api/render`가 연쇄적으로 compile 된다.
- 이 지연은 backend 자체보다 `Next.js` host/runtime orchestration에서 더 크게 발생한다.
- 데스크톱 앱에서는 이런 비용이 사용자가 얻는 제품 가치와 직접 연결되지 않는다.

우리는 이미 `RPC` 구조를 통해 UI와 backend를 느슨하게 연결하고 있다. 따라서 host를 바꾸더라도 제품 경계를 다시 설계할 필요는 없다.

## Decision Drivers

- 데스크톱 앱을 primary product surface로 둘 것
- host 비용을 제품 핵심 경로에서 제거할 것
- 기존 RPC contract와 local backend 자산을 최대한 재사용할 것
- host-specific framework 의존성을 product logic에서 분리할 것
- optional web surface는 유지할 수 있어도 primary runtime이 되지 않게 할 것

## Decision

Magam은 `Electron`을 primary application host로 채택하고, `Next.js`는 primary runtime에서 내린다.

구체적으로는 다음을 결정한다.

1. `Electron` desktop shell을 Magam의 canonical host로 사용한다.
2. renderer와 local backend 사이의 logical boundary는 기존처럼 `RPC` 구조를 유지한다.
3. `Next.js`는 더 이상 primary product runtime이 아니다.
4. `Next.js`가 남더라도 viewer, debug, review 같은 secondary adapter surface로만 취급한다.
5. 앞으로의 제품 로직은 `Next.js` route handler나 app router에 종속되지 않아야 한다.

## Decision Details

### Host Ownership

- `Electron main`
  - window lifecycle
  - desktop bootstrap
  - backend process orchestration
- `Electron preload`
  - 최소 권한 RPC bridge
- `renderer app`
  - canvas editor, state, runtime, UI
- `local backend`
  - files, file-tree, render, sync, chat, edit command handling

이 구조에서 중요한 점은 renderer app이 host-neutral 해야 한다는 것이다.

- renderer는 `Electron` API를 직접 흩뿌려 사용하지 않는다.
- renderer는 host adapter가 제공하는 RPC client contract만 본다.
- `Next.js`가 남는 경우에도 같은 contract를 소비해야 한다.

### Dependency Direction

이 결정에서 가장 중요한 구조 제약은 dependency direction이다.

- `Renderer app`은 `Electron`이나 `Next.js`를 직접 의존하지 않는다.
- `Renderer app`은 `RPC client interface`와 `host capability interface`만 의존한다.
- `Electron main/preload`는 host capability와 orchestration만 소유하고, canvas domain logic을 직접 소유하지 않는다.
- `Backend`는 renderer를 import하지 않는다.
- `Next.js`가 남더라도 renderer를 감싸는 secondary adapter일 뿐, product logic owner가 아니다.

즉 권장 방향은 아래와 같다.

`Renderer -> Interfaces -> Host Adapters -> Shared Contracts -> Backend`

그리고 아래 방향은 금지한다.

- `Renderer -> Electron direct`
- `Canvas Domain -> Next.js direct`
- `Backend -> Renderer`
- `Main/Preload -> Domain logic ownership`

### Next.js의 새로운 위치

`Next.js`를 완전히 금지하지는 않는다. 다만 역할을 제한한다.

- 가능: share viewer, debug harness, review surface, optional browser access
- 불가: primary authoring host, canonical API owner, 제품 핵심 흐름의 필수 runtime

즉 `Next.js`는 제품 본체가 아니라 compatibility adapter가 된다.

### RPC Boundary 유지

이번 결정은 transport를 바꾸는 결정이 아니다.

- renderer는 여전히 RPC contract를 통해 backend capability를 호출한다.
- 구현은 HTTP, WebSocket, IPC bridge, local loopback 등으로 바뀔 수 있다.
- 하지만 logical method boundary는 유지한다.

이렇게 하면 Electron 전환 시에도 domain layer를 다시 설계하지 않아도 된다.

## Alternatives Considered

### A. Next.js를 primary host로 유지

- 장점: 현재 구조를 가장 적게 바꾼다.
- 단점: 데스크톱 중심 제품에 불필요한 compile/runtime host 비용을 계속 안고 간다.
- 단점: thin proxy와 host framework가 제품 핵심 경로를 계속 점유한다.
- 결론: 비채택

### B. Electron을 쓰되 RPC를 버리고 renderer가 backend를 직접 in-process 호출

- 장점: 겉보기에 레이어 수가 줄어든다.
- 단점: renderer와 backend 경계가 흐려지고, host-neutral surface가 사라진다.
- 단점: optional web surface나 headless surface 재사용성이 낮아진다.
- 결론: 비채택

### C. Tauri를 primary host로 채택

- 장점: 더 작은 배포 크기, Rust 기반 host 장점
- 단점: 현재 Node/TS 기반 local backend, render pipeline, process orchestration 자산 재사용성이 더 낮다.
- 단점: 현 시점에서는 host migration과 runtime migration을 동시에 요구할 가능성이 크다.
- 결론: 현 단계에서는 비채택

### D. Electron primary host + RPC boundary 유지 + Next.js secondary adapter화 (Selected)

- 장점: host 비용을 줄이면서 기존 backend/RPC 자산을 재사용할 수 있다.
- 장점: renderer를 host-neutral product layer로 정리할 수 있다.
- 장점: optional web surface를 남겨도 ownership이 명확하다.
- 단점: Electron main/preload 보안 경계와 orchestration 책임을 새로 설계해야 한다.
- 결론: 최종 채택

## Consequences

### Positive

- 데스크톱 제품의 primary startup path에서 `Next.js` cold route compile 의존성을 제거할 수 있다.
- existing local backend와 RPC 자산을 폐기하지 않고 재사용할 수 있다.
- renderer app과 host adapter의 ownership이 더 명확해진다.
- optional web surface가 있어도 product logic이 `Next.js`에 잠기지 않는다.

### Negative

- Electron main/preload/security boundary를 새로 관리해야 한다.
- dev bootstrap과 process lifecycle 설계가 더 중요해진다.
- web surface를 완전히 버리지 않으면 adapter 두 개를 함께 유지해야 한다.
- 배포 크기와 메모리 footprint는 Electron 비용을 수용해야 한다.

## Follow-up

1. `docs/features/electron-desktop-host/README.md`를 이 결정의 실행 작업 문서로 유지한다.
2. renderer에서 `/api/*` 의존을 제거하고 RPC client adapter를 도입한다.
3. Electron main/preload/renderer boundary와 bootstrap 경로를 설계한다.
4. `Next.js`는 secondary viewer/debug adapter로 남길지 별도 범위에서 정리한다.
5. primary dev path를 desktop host 기준으로 다시 정의한다.

## Implementation Alignment (2026-03-20)

- `app/features/desktop-host/*`가 Electron main/preload/backend orchestration과 renderer readiness handshake를 소유한다.
- `app/features/host/*`가 host capability 계약, logical RPC method parity, desktop/web adapter 구성을 공통 경계로 제공한다.
- `WorkspaceClient`, `Sidebar`, `chat` store는 직접 `/api/*`를 호출하지 않고 host runtime adapter를 소비한다.
- repo root와 `app/` workspace의 기본 `bun dev`는 Electron desktop bootstrap을 가리키고, 기존 web host 경로는 `web:dev` 별칭으로 유지한다.
- `bun run desktop:dev -- --headless` smoke 검증은 `Next.js` dev server 없이도 desktop bootstrap이 성립함을 확인하는 현재 기준 경로다.
