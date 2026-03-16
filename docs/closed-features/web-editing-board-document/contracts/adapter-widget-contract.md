# Contract: Adapter Widget

## 목적

외부 차트/그래프/커스텀 시각화를 board document에 수용하기 위한 adapter-backed widget node 계약을 정의한다.

## Core Rule

- adapter widget의 canonical 저장값은 executable TSX가 아니다
- board document에는 `adapterId`, serialized props, serialized data, capability metadata만 저장한다
- 실제 렌더링은 adapter registry가 담당한다

## Contract Surface

`nodeKind === 'adapter-widget'`인 node는 최소 아래 필드를 가진다.

- `id`: string
- `nodeKind`: `'adapter-widget'`
- `adapterId`: string
- `props?`: object
- `data?`: object
- `capabilities?`: object
- `extensions?`: object

## Serialized Payload Rules

- `props`와 `data`는 JSON-safe payload여야 한다
- function prop, render prop, React element, class instance는 canonical storage에 허용하지 않는다
- adapter-specific payload는 adapter schema version으로 별도 진화할 수 있어야 한다

## Capability Contract

`capabilities`는 최소 아래 성격을 표현할 수 있어야 한다.

- `editable`: boolean
- `resizable`: boolean
- `themeAware`: boolean
- `supportsDataPatch`: boolean
- `readOnlyReason?`: string

## Data Source Contract

adapter widget은 아래 유형의 data source를 가질 수 있다.

- inline data
- workspace file reference
- external URL reference
- derived query reference

canonical contract는 adapter가 data source를 선언적으로 기술할 수 있어야 한다.

## Behavioral Guarantees

- adapter registry에 같은 `adapterId`가 등록되어 있으면 동일 문서는 안정적으로 렌더되어야 한다
- 미지원 adapter는 문서 로드를 깨뜨리지 않고 fallback placeholder로 degrade 되어야 한다
- adapter widget은 native node처럼 placement, selection, resize contract를 공유할 수 있어야 한다
- native direct manipulation이 열려 있지 않은 내부 chart mark/tree는 adapter가 명시적으로 연 surface만 편집 가능하다

## Relationship to Legacy TSX

- 기존 TSX import는 legacy compatibility path로만 유지한다
- 새 확장 경로는 arbitrary TSX embedding이 아니라 adapter-backed widget이다
- 알려진 TSX custom component는 importer가 대응하는 adapter widget으로 변환할 수 있다
- 모르는 custom component는 opaque legacy import reference로 남길 수 있다

## Out of Scope

- arbitrary TSX component execution을 canonical board schema로 저장하는 일
- plugin sandbox implementation 세부
