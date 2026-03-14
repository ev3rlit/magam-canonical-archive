# Contract: Plugin and Adapter Registry

## 목적

외부 시각화 라이브러리와 custom widget을 adapter/plugin 형태로 연결하기 위한 registry 계약을 정의한다.

## Registry Contract

registry는 최소 아래 정보를 제공해야 한다.

- `adapterId`
- `displayName`
- `version`
- `nodeKind`
- `renderer`
- `schema`
- `capabilities`

## Adapter Identity

`adapterId`는 namespaced identifier를 사용한다.

예시:

- `chart.recharts.bar`
- `chart.echarts.line`
- `graph.mermaid.flowchart`
- `table.aggrid.basic`

## Registration Surface

하나의 adapter는 최소 아래 인터페이스를 충족해야 한다.

- `render(widgetNode, runtimeContext) => render result`
- `validate(payload) => validation result`
- `migrate(payload, fromVersion, toVersion) => migrated payload`
- `getCapabilities() => capability metadata`

선택적 인터페이스:

- `editSurface()`
- `importFromLegacy()`
- `exportToExternal()`

## Schema Contract

- 각 adapter는 자신의 payload schema를 선언해야 한다
- core board document는 adapter payload 내부 의미를 알지 못해도 payload를 보존해야 한다
- adapter payload의 breaking change는 adapter version/migration으로 관리한다

## Security and Trust Boundary

- plugin은 arbitrary board schema mutation 권한을 기본으로 갖지 않는다
- plugin이 수정 가능한 범위는 자신이 소유한 adapter widget payload와 명시적으로 연 capability surface로 제한하는 편이 바람직하다
- untrusted plugin 또는 missing plugin은 safe fallback 모드로 degrade 되어야 한다

## Behavioral Guarantees

- 동일 adapter registry 구성이면 동일 문서가 일관되게 렌더되어야 한다
- adapter 미설치 상태에서도 문서 데이터는 손실되지 않아야 한다
- core editor는 adapter widget을 최소한 placement/select/export 대상으로는 취급할 수 있어야 한다

## Relationship to Native Schema

- native node family는 plugin 없이 동작한다
- plugin/adapter는 native schema를 대체하는 것이 아니라 외부 시각화를 확장하는 경로다
- frame은 reusable composition unit이고, plugin/adapter는 external rendering integration unit이다

## Out of Scope

- package distribution mechanism
- code signing / sandbox runtime implementation detail
