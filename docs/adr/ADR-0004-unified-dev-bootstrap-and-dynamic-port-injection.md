---
title: ADR-0004 Unified Dev Bootstrap and Dynamic Port Injection
date: 2026-03-14
status: accepted
authors:
  - platform-team
tags:
  - adr
  - dev-experience
  - cli
  - nextjs
  - websocket
  - ports
aliases:
  - Dev Bootstrap ADR
  - Dynamic Port Injection ADR
  - bun dev 통합 부트스트랩 ADR
---

# ADR-0004: Unified Dev Bootstrap and Dynamic Port Injection

## Context

개발 서버 진입점이 두 갈래로 나뉘어 있었다.

- repo root `bun dev`
  - `cli.ts dev`를 실행한다.
  - HTTP render server, Next.js app, WebSocket file-sync server를 함께 띄운다.
  - 포트 충돌을 피하기 위해 사용 가능한 포트를 찾아 env로 주입한다.
- `app` 폴더의 `bun dev`
  - `next dev`만 실행한다.
  - HTTP render server와 WebSocket file-sync server를 함께 기동하지 않는다.
  - `MAGAM_HTTP_PORT`, `NEXT_PUBLIC_MAGAM_WS_PORT`, `MAGAM_WS_PORT`, `MAGAM_TARGET_DIR`를 일관되게 주입하지 않는다.

이 차이로 인해 `app`에서 개발 서버를 띄울 경우 브라우저는 fallback 포트(`3002`, `3001`)를 사용할 수 있었고, 포트 점유나 다른 workspace 프로세스와 충돌하면 다음 문제가 발생했다.

- `/api/render`, `/api/file-tree`가 올바른 HTTP render server를 바라보지 못함
- `useFileSync`의 JSON-RPC 요청이 올바른 WebSocket file-sync server에 도달하지 못함
- `node.move` 같은 편집 요청이 timeout 되고 optimistic drag가 롤백됨

우리 앱의 최종 목표는 CLI 실행 경로가 정식 경로인 상태를 유지하는 것이다. 따라서 `bun dev`도 CLI 경로와 동일한 orchestration 계약을 따라야 한다.

## Decision

개발 서버 bootstrap을 단일 경로로 통일하고, 포트는 항상 동적으로 선택해 각 프로세스에 주입한다.

1. 공통 bootstrap 도입
- `scripts/dev/app-dev.ts`를 개발 서버 공통 진입점으로 사용한다.
- repo root의 `bun dev`와 `app` 폴더의 `bun dev`는 모두 이 bootstrap을 호출한다.

2. 실제 orchestration은 `cli.ts dev`에 유지
- child process 구성, 포트 선택, env 주입 책임은 `cli.ts dev`에 둔다.
- bootstrap은 `build:core`를 실행한 뒤 `cli.ts dev`로 위임한다.

3. 포트는 고정값이 아니라 가용 포트를 기준으로 선택
- Next.js는 `3000`부터
- WebSocket file-sync server는 `3001`부터
- HTTP render server는 `3002`부터
- 충돌 시 다음 포트로 증가하며 재시도한다.

4. env 주입을 SSOT로 유지
- Next.js app에는 `MAGAM_TARGET_DIR`, `MAGAM_HTTP_PORT`, `NEXT_PUBLIC_MAGAM_WS_PORT`
- WebSocket server에는 `MAGAM_WS_PORT`, `MAGAM_TARGET_DIR`
- HTTP render server에는 `MAGAM_HTTP_PORT`

5. raw `next dev`는 보조 경로로만 남김
- `app/package.json`에는 `dev:next`를 유지한다.
- 이 경로는 full dev stack이 아니라 Next 단독 실행이 필요한 경우에만 사용한다.

## Decision Details

### Target Shape

```text
repo root bun dev
  -> scripts/dev/app-dev.ts
     -> build:core
     -> cli.ts dev <targetDir>
        -> pick next/http/ws ports
        -> spawn HTTP render server
        -> spawn Next.js app
        -> spawn WebSocket file-sync server

app bun dev
  -> ../scripts/dev/app-dev.ts
     -> same flow as root
```

### Ownership Boundary

- `scripts/dev/app-dev.ts`
  - root/app 진입점 통일
  - target directory 정규화
  - core build 후 CLI orchestration 위임
- `cli.ts`
  - 포트 선택
  - process spawn/shutdown
  - env wiring
- `app`
  - 주입된 env를 사용해 HTTP/WS에 연결

### API and Runtime Contract

- `bun dev`는 항상 full dev stack을 의미한다.
- CLI 경로와 app 경로는 같은 orchestration 결과를 내야 한다.
- 포트는 예측 가능한 시작점은 가지되, 실제 값은 점유 상태에 따라 달라질 수 있다.
- 브라우저는 fallback 고정 포트에 의존하지 않고, 주입된 포트를 사용해야 한다.

## Alternatives Considered

### A. `app/package.json`의 `dev`를 그대로 `next dev`로 유지

- 장점: 구현이 가장 단순하다.
- 단점: root와 `app`의 실행 결과가 달라진다.
- 단점: file-sync, render proxy, dynamic port injection 계약이 깨진다.
- 결론: 비채택

### B. `app` 전용 orchestration을 별도로 구현

- 장점: `app` workspace 안에서만 self-contained하게 동작할 수 있다.
- 단점: `cli.ts dev`와 포트 선택/주입 로직이 중복된다.
- 단점: 이후 변경 시 root/app 경로가 쉽게 drift한다.
- 결론: 비채택

### C. 모든 서버를 고정 포트로 강제

- 장점: 개념적으로 단순해 보인다.
- 단점: 실제 개발 환경에서는 포트 점유 충돌이 빈번하다.
- 단점: 다른 workspace나 기존 프로세스와 공존성이 떨어진다.
- 결론: 비채택

### D. 공통 bootstrap + `cli.ts dev` 위임 + 동적 포트 주입 (채택)

- 장점: 실행 경로 일관성, 포트 충돌 회피, 로직 중복 제거를 동시에 달성한다.
- 단점: bootstrap 레이어가 하나 추가된다.
- 결론: 최종 채택

## Consequences

### Positive

- repo root와 `app`의 `bun dev`가 동일한 full dev stack을 띄운다.
- 포트 점유 상태와 무관하게 실행 성공률이 높아진다.
- HTTP render/WS sync/Next env wiring이 단일 경로로 유지된다.
- drag/edit 같은 편집 기능이 `app bun dev`에서도 CLI 경로와 동일하게 동작한다.

### Negative

- `app bun dev`가 이제 Next 단독이 아니라 full orchestration을 수행한다.
- 최초 실행 시 `build:core` 단계를 거치므로 체감 시작 시간이 일부 늘 수 있다.
- bootstrap과 CLI 두 레이어를 함께 이해해야 한다.

## Follow-up

1. `docs/guide/dev-startup-flow.md`는 현재 구조 중심 가이드로 유지한다.
2. `AGENT.md`, `app/CLAUDE.md` 등 개발자 문서의 실행 경로 설명을 현재 구조와 맞춘다.
3. 필요 시 `useFileSync`의 WS URL 계산도 현재 origin 중심으로 보강한다.
