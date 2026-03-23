---
title: ADR-0011 Unified Renderer RPC Boundary for Web and Desktop
date: 2026-03-23
status: accepted
authors:
  - platform-team
tags:
  - adr
  - architecture
  - rpc
  - renderer
  - desktop
  - web
  - transport
aliases:
  - Unified Host Boundary ADR
  - Renderer RPC Boundary ADR
  - Web Desktop Transport Split ADR
---

# ADR-0011: Unify Renderer-Facing Host Boundary and Hide Web/Desktop Transport Behind RPC Adapters

## Context

ADR-0010에서 `Electron`을 primary host로 채택하고 `Next.js`를 secondary adapter surface로 내렸다. 하지만 그 결정만으로 renderer 경계가 실제로 단일화되지는 않았다.

당시 renderer에는 두 종류의 호출 방식이 함께 남아 있었다.

- 기존 `RendererRpcClient`
  - files
  - file-tree
  - render
  - chat
- 별도 feature API helper
  - workspace probe/ensure
  - workspace document list/create
  - workspace file-browser action

즉 renderer는 다음을 동시에 알고 있었다.

- logical host capability
- `/api/*` path shape
- desktop direct HTTP base URL
- desktop fallback port (`3002`, `3001`)

이 구조는 다음 문제를 만들었다.

1. renderer가 transport와 endpoint shape를 직접 안다.
2. web과 desktop transport 차이가 feature code까지 새어 나온다.
3. desktop runtime port, CSP allowlist, renderer fetch base가 서로 drift할 수 있다.
4. 같은 host capability가 `rpc`와 `feature api` 두 경계에 나뉘어 ownership이 흐려진다.

실제 장애도 여기서 발생했다.

- desktop 문서의 CSP는 동적으로 선택된 HTTP port만 허용한다.
- 하지만 일부 renderer 호출은 fallback port로 request를 만들었다.
- 결과적으로 workspace 추가 흐름에서 CSP violation이 발생했다.

즉 문제는 “포트가 많다”가 아니라 “renderer 경계가 단일하지 않다”는 것이었다.

## Decision Drivers

- renderer는 transport가 아니라 logical capability만 보게 할 것
- web/desktop 모두 동일한 renderer-facing contract를 사용할 것
- desktop runtime connection 정보는 단일 source of truth를 따를 것
- `/api/*` adapter와 desktop direct backend를 동시에 유지하더라도 ownership을 분리할 것
- 기존 backend topology를 한 번에 재설계하지 않고 Stage 1 안정화를 우선 달성할 것

## Decision

renderer-facing host boundary를 `RendererRpcClient` 하나로 통일한다.

구체적으로는 다음을 채택한다.

1. renderer는 host capability를 오직 `getHostRuntime().rpc`를 통해 호출한다.
2. workspace/document/file-browser capability를 `RendererRpcClient`에 편입한다.
3. web에서는 기존 `Next.js /api/*` route handler를 renderer boundary가 아니라 web transport adapter로 취급한다.
4. desktop에서는 runtime-configured local HTTP/WS backend를 desktop transport adapter가 직접 호출한다.
5. renderer feature code에서는 raw endpoint path, localhost base URL, fallback port를 직접 참조하지 않는다.
6. desktop runtime config는 orchestrator/dev bootstrap이 선택한 값을 single source of truth로 사용한다.

## Decision Details

### Canonical Layer Shape

최종 경계는 아래 3계층으로 본다.

- `Renderer / UI`
  - page, component, store, feature logic
- `Host RPC Boundary`
  - logical method contract
  - web adapter
  - desktop adapter
- `Backend Services / OS`
  - local HTTP backend
  - WS backend
  - file system / shell integration

중요한 점은 renderer가 더 이상 아래를 알지 않는다는 것이다.

- `/api/workspaces`
- `/api/documents`
- `http://127.0.0.1:<port>`
- desktop fallback env var

renderer는 오직 logical method를 안다.

### Renderer RPC Expansion

기존 `RendererRpcClient`는 files/render/chat 중심이었다. 이를 다음 capability까지 확장한다.

- `workspace.probe`
- `workspace.ensure`
- `workspace.documents.list`
- `workspace.document.create`
- `workspace.fileBrowser.launch`

또한 workspace shell이 `rootPath` override를 필요로 하기 때문에 `fileTree.list`도 workspace root를 인자로 받을 수 있게 확장한다.

이 결정으로 workspace shell은 더 이상 별도 feature-level host boundary를 가지지 않는다.

### Web Transport Position

web transport는 기존 `Next.js /api/*` route handler를 유지한다.

다만 이들의 역할은 바뀐다.

- 이전: 사실상 renderer-facing product API
- 이후: web adapter implementation detail

즉 renderer는 `/api/*`를 직접 호출하지 않고, web adapter가 same-origin route handler를 logical method로 매핑한다.

### Desktop Transport Position

desktop transport는 runtime-configured local backend를 유지한다.

- data plane은 local HTTP/WS backend
- OS capability와 lifecycle은 preload/IPC

즉 Stage 1에서는 “desktop도 모든 것을 IPC로 바꾼다”가 목표가 아니다.

대신 아래를 보장한다.

1. desktop renderer는 단일 RPC 경계만 본다.
2. desktop adapter만 runtime-configured base URL을 안다.
3. runtime config가 없으면 fallback 없이 명시적으로 실패한다.

### Runtime Config and CSP Ownership

desktop runtime connection 정보는 한 경로에서만 결정한다.

- dev/bootstrap/orchestrator가 HTTP/WS port를 선택한다.
- 그 결과가 backend spawn, preload runtime, desktop RPC adapter, CSP generation에 동일하게 사용된다.

renderer/shared feature code에서는 더 이상 다음을 허용하지 않는다.

- `NEXT_PUBLIC_MAGAM_HTTP_PORT` fallback
- `NEXT_PUBLIC_MAGAM_WS_PORT` fallback
- `3002`, `3001` hardcoded fallback

즉 CSP와 renderer request target이 drift할 수 있는 경로를 제거한다.

후속으로 app-global state DB path도 같은 원칙을 따른다.

- desktop main이 user-level app data 기준 `appStateDbPath`를 한 번 결정한다.
- orchestrator, backend env, preload runtime, renderer-visible desktop runtime config가 같은 경로를 공유한다.
- app-state storage path 역시 renderer feature code가 직접 계산하지 않는다.

### Shared Server-Side Workspace Shell Logic

workspace/document probe, ensure, create, file-browser launch 로직은 web route handler와 desktop HTTP backend가 공통으로 재사용한다.

이는 다음 목적을 가진다.

- web/desktop transport parity 보장
- server-side business rule duplication 제거
- route handler와 desktop backend 간 결과 shape 차이 축소

## Alternatives Considered

### A. workspace shell helper를 별도 feature API boundary로 유지한다

- 장점: 현재 코드를 가장 적게 바꾼다.
- 단점: renderer가 여전히 RPC와 raw endpoint helper 두 경계를 동시에 안다.
- 단점: transport leakage와 CSP/port drift 문제가 다시 발생할 수 있다.
- 결론: 비채택

### B. web/desktop 모두 즉시 IPC-first boundary로 바꾼다

- 장점: desktop localhost HTTP 의존이 더 줄어들 수 있다.
- 단점: Stage 1 안정화 범위를 넘어선다.
- 단점: web과 desktop을 동시에 보장해야 하는 현재 요구에 비해 변경 폭이 과도하다.
- 결론: 현 단계에서는 비채택

### C. renderer-facing contract는 단일 RPC로 통일하고 transport는 내부 adapter로 분리한다 (채택)

- 장점: renderer 단순화와 transport 분리를 동시에 달성한다.
- 장점: 기존 web route handler와 desktop backend 자산을 재사용할 수 있다.
- 장점: CSP/port drift의 직접 원인을 제거한다.
- 결론: 최종 채택

## Consequences

### Positive

- renderer는 logical capability만 보게 되어 feature ownership이 선명해진다.
- web과 desktop은 같은 renderer-facing contract를 사용한다.
- workspace shell이 files/render/chat와 같은 host boundary 안으로 들어온다.
- desktop runtime port, CSP, request base URL이 같은 source of truth를 따른다.
- transport 차이는 adapter 내부로 밀려나고, review 범위가 좁아진다.

### Negative

- `RendererRpcClient` surface가 더 커진다.
- desktop direct backend와 web route handler를 모두 유지해야 하므로 adapter parity를 계속 검증해야 한다.
- shared server-side workspace shell logic을 별도 모듈로 유지해야 한다.

## Follow-up

1. Stage 1 이후 `app/features/workspace/api/index.ts`는 compatibility wrapper에서 더 축소하거나 제거한다.
2. desktop shell action 중 일부를 장기적으로 IPC로 옮길지 별도 ADR 또는 follow-up task로 검토한다.
3. 남아 있는 raw `/api/*` 호출이 renderer 영역에 다시 들어오지 않도록 review bar에 반영한다.
4. adapter parity test를 계속 유지해 web/desktop logical method drift를 막는다.

## Implementation Alignment (2026-03-23)

- `app/features/host/renderer/rpcClient.ts`가 workspace/document/file-browser capability까지 포함하는 canonical renderer-facing contract를 소유한다.
- `app/features/host/rpc/webAdapter.ts`는 same-origin `/api/*` route handler를 logical RPC method로 매핑한다.
- `app/features/host/rpc/desktopAdapter.ts`는 runtime-configured local backend(`/workspaces`, `/documents`, `/file-tree`, existing file/chat/render routes)를 logical RPC method로 매핑한다.
- `libs/shared/src/lib/workspace-shell.ts`가 web route handler와 desktop HTTP backend가 공유하는 workspace shell server logic을 소유한다.
- `app/features/editor/pages/CanvasEditorPage.tsx`, `app/features/workspace/pages/WorkspaceDashboardPage.tsx`, `app/features/workspace/pages/WorkspaceDetailPage.tsx`는 workspace shell 호출을 `getHostRuntime().rpc`로 수행한다.
- `app/utils/imageSource.ts`는 desktop image asset URL 구성 시 host runtime base URL resolver를 사용하고 renderer-level port fallback을 제거한다.
- app-global workspace registry/session/recent-document/theme/font preference는 same logical RPC boundary 위에서 web/desktop transport parity를 유지한다.
- desktop runtime config는 `appStateDbPath`를 포함하고, theme/font는 app-state를 canonical source로 사용하며 renderer `localStorage`는 bootstrap cache로만 남는다.

## Related Decisions

- ADR-0004: dynamic port injection 필요성을 다뤘지만, renderer transport leakage 제거는 다루지 않았다.
- ADR-0010: Electron을 primary host로 채택하고 `Next.js`를 secondary adapter로 내렸다.
- ADR-0011은 ADR-0010의 후속으로 renderer-facing logical boundary를 실제로 단일화한다.
