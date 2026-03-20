# Contract: Desktop Bootstrap Lifecycle

## 목적

Electron primary startup path에서 backend orchestration과 renderer readiness 순서를 고정한다.

## Lifecycle Stages

1. `boot:init` - app process 시작
2. `boot:workspace-resolve` - workspace 경로 확보
3. `boot:backend-start` - local backend process 시작
4. `boot:backend-ready` - required RPC method health check 통과
5. `boot:renderer-load` - renderer entry 로드
6. `boot:renderer-ready` - initial RPC hydration 완료
7. `boot:running` - authoring ready

## Ordering Rules

1. `boot:backend-ready` 이전에는 `boot:renderer-ready`가 되면 안 된다.
2. 실패 시 stage-specific error code/message를 기록해야 한다.
3. shutdown 시 backend graceful stop을 먼저 수행하고 renderer teardown으로 종료한다.
4. primary startup path는 Next.js route compile을 필수 단계로 요구하지 않는다.

## Failure Contract

- workspace resolution failure: `DESKTOP_BOOT_WORKSPACE_RESOLVE_FAILED`
- backend startup failure: `DESKTOP_BOOT_BACKEND_START_FAILED`
- rpc readiness failure: `DESKTOP_BOOT_RPC_NOT_READY`
- renderer hydration failure: `DESKTOP_BOOT_RENDERER_READY_FAILED`
