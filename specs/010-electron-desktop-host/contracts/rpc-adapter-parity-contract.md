# Contract: RPC Adapter Parity

## 목적

desktop adapter와 optional web adapter가 동일 logical RPC contract를 제공하도록 고정한다.

## Canonical Logical Methods

- `files.list`
- `fileTree.list`
- `render.generate`
- `edit.apply`
- `sync.watch`
- `chat.send`
- `chat.stop`
- `chat.sessions.list`

## Adapter Rules

1. renderer는 URL path가 아니라 logical method 이름으로 RPC를 호출한다.
2. desktop adapter와 web adapter는 동일한 method name, request shape, response shape를 유지한다.
3. adapter transport(`ipc`, `http`, `ws`) 차이는 구현 내부로 캡슐화한다.
4. method parity 검증에서 누락/이름 불일치가 있으면 startup readiness를 통과할 수 없다.

## Failure Contract

- missing logical method: `RPC_PARITY_METHOD_MISSING`
- request shape mismatch: `RPC_PARITY_REQUEST_MISMATCH`
- response shape mismatch: `RPC_PARITY_RESPONSE_MISMATCH`
- transport leak to renderer: `RPC_ADAPTER_BOUNDARY_VIOLATION`
