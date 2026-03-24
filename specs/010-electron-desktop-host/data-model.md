# Data Model: Electron Desktop Host

## 1) HostMode

- Purpose: 현재 런타임 host 모드를 구분한다.

```ts
type HostMode = 'desktop-primary' | 'web-secondary';
```

### Validation

- primary startup path에서는 `desktop-primary`만 허용한다.
- `web-secondary` 모드에서는 authoring-critical flow 의존을 선언할 수 없다.

## 2) HostCapabilitySurface

- Purpose: renderer에 노출되는 최소 권한 host API 계약을 표현한다.

```ts
type HostCapabilitySurface = {
  workspace: {
    selectWorkspace: () => Promise<{ path: string } | null>;
    revealInOs: (path: string) => Promise<void>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  lifecycle: {
    onAppEvent: (listener: (event: HostAppEvent) => void) => () => void;
  };
};
```

### Validation

- raw Node/Electron objects는 surface를 통해 직접 노출할 수 없다.
- API는 capability domain별 namespace를 유지해야 한다.

## 3) RpcLogicalMethod

- Purpose: host와 무관하게 유지되는 canonical RPC method 식별자.

```ts
type RpcLogicalMethod =
  | 'files.list'
  | 'fileTree.list'
  | 'render.generate'
  | 'edit.apply'
  | 'sync.watch'
  | 'chat.send'
  | 'chat.stop'
  | 'chat.sessions.list';
```

### Validation

- Electron adapter와 web adapter는 동일 method 집합을 구현해야 한다.
- renderer는 URL path 기반 호출 대신 logical method 기반 호출을 사용해야 한다.

## 4) RpcAdapterDescriptor

- Purpose: host별 RPC adapter 구성을 표현한다.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `hostMode` | `HostMode` | Yes | adapter 적용 대상 host |
| `methods` | `RpcLogicalMethod[]` | Yes | 지원하는 logical methods |
| `transport` | `'ipc' \| 'http' \| 'ws'` | Yes | adapter 내부 transport 타입 |
| `healthCheck` | `() => Promise<boolean>` | Yes | startup readiness 검증 훅 |

### Validation

- `methods` 누락 항목이 있으면 parity failure로 간주한다.
- primary startup은 `healthCheck=true`를 충족한 뒤 renderer를 ready 상태로 전환해야 한다.

## 5) DesktopBootstrapSession

- Purpose: desktop startup lifecycle 상태를 표준화한다.

```ts
type DesktopBootstrapSession = {
  sessionId: string;
  workspacePath: string | null;
  backendState: 'idle' | 'starting' | 'ready' | 'failed' | 'stopping';
  rendererState: 'idle' | 'loading' | 'ready' | 'failed';
  startedAt: number;
  lastError?: { code: string; message: string };
};
```

### Validation

- `backendState='ready'` 이전에는 renderer가 authoring-ready 상태가 되면 안 된다.
- `failed` 상태에서는 명시적 error code/message를 남겨야 한다.

## 6) HostAppEvent

- Purpose: host lifecycle 이벤트를 renderer로 전달하는 표준 이벤트 타입.

```ts
type HostAppEvent =
  | { type: 'workspace-selected'; path: string }
  | { type: 'workspace-cleared' }
  | { type: 'backend-ready' }
  | { type: 'backend-failed'; code: string; message: string }
  | { type: 'shutdown-requested' };
```

### Validation

- 이벤트 타입은 명시적 discriminant union을 따라야 한다.
- unknown event는 무시 대신 diagnostics 경로로 보고되어야 한다.

## Relationships

- `HostMode`는 `RpcAdapterDescriptor.hostMode`와 1:1로 매핑된다.
- `DesktopBootstrapSession`은 host lifecycle 단계별로 `HostAppEvent`를 발행한다.
- `HostCapabilitySurface`는 `HostMode='desktop-primary'`에서 preload bridge를 통해 renderer에 전달된다.
- `RpcAdapterDescriptor.methods`는 `RpcLogicalMethod` 전 범위를 커버해야 한다.

## State Transitions

1. `Idle` -> `BackendStarting`
   - Trigger: desktop app startup
   - Guard: workspace bootstrap 요청 수신
2. `BackendStarting` -> `BackendReady`
   - Trigger: RPC backend health check 통과
   - Guard: required logical methods 등록 완료
3. `BackendReady` -> `RendererReady`
   - Trigger: renderer 초기 필수 RPC 호출 성공
   - Guard: `/api/*` direct dependency 사용 없음
4. `Any` -> `Failed`
   - Trigger: bootstrap/adapter/capability 오류
   - Action: error code/message 기록, recovery path 표시
5. `Ready` -> `Stopping`
   - Trigger: app close/shutdown request
   - Action: backend graceful shutdown, renderer teardown
