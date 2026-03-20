# Contract: Optional Web Adapter Boundary

## 목적

Next.js surface를 secondary compatibility adapter로 제한하고 primary authoring ownership과 분리한다.

## Owned by Optional Web Adapter

- viewer/debug/review 보조 surface 제공
- canonical logical RPC methods를 web transport로 중계
- desktop parity 검증을 위한 adapter conformance 유지

## Not Owned by Optional Web Adapter

- primary desktop startup path
- renderer product logic ownership
- domain RPC logical contract 정의 권한
- authoring-critical flow availability gate

## Boundary Rules

1. web adapter 중단/장애가 desktop authoring 경로를 차단하면 안 된다.
2. web adapter는 desktop adapter와 동일 logical method contract를 따라야 한다.
3. renderer domain 모듈은 Next.js route handler primitive를 직접 참조하지 않는다.
4. web adapter는 compatibility surface이며 canonical runtime host가 아니다.

## Failure Contract

- web host promoted to primary: `WEB_ADAPTER_ROLE_DRIFT`
- web outage blocks desktop authoring: `WEB_ADAPTER_BLOCKING_PRIMARY_PATH`
- contract parity break: `WEB_ADAPTER_RPC_PARITY_VIOLATION`
