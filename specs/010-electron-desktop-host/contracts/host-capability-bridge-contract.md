# Contract: Host Capability Bridge

## 목적

renderer가 host 기능을 안전하게 사용하도록 preload bridge 최소 권한 surface를 고정한다.

## Public Surface

- `workspace.selectWorkspace() -> Promise<{ path: string } | null>`
- `workspace.revealInOs(path: string) -> Promise<void>`
- `shell.openExternal(url: string) -> Promise<void>`
- `lifecycle.onAppEvent(listener) -> unsubscribe`

## Input Contract

- `path`는 non-empty absolute path여야 한다.
- `url`은 허용된 스킴(`https`, `mailto`)만 허용한다.
- 이벤트 리스너는 unsubscribe 함수를 반드시 반환받아 정리 가능해야 한다.

## Security Rules

1. bridge는 raw `ipcRenderer`, `fs`, `child_process`, `process` 객체를 직접 노출하지 않는다.
2. renderer는 capability namespace 외 host API에 접근할 수 없다.
3. privileged operation은 명시적 capability method를 통해서만 수행된다.

## Failure Contract

- invalid capability call: `HOST_CAPABILITY_INVALID_CALL`
- disallowed URL scheme: `HOST_CAPABILITY_URL_BLOCKED`
- unauthorized primitive exposure: `HOST_CAPABILITY_SECURITY_VIOLATION`
