# Canvas Runtime Contract

작성일: 2026-03-24  
상태: Draft  
범위: `m2`  
목표: UI와 CLI가 공통으로 소비할 `canvas runtime`의 read model, command vocabulary, write result contract를 먼저 고정한다.

## 1. 개요

현재 우리가 진행 중인 `AI-first canonical CLI`는 독립적인 CLI 구현 작업처럼 보이지만, 실제로는 `canvas runtime`의 소비자다.

즉 CLI를 먼저 고정하는 것이 아니라, **CLI가 의존하는 공용 runtime contract를 먼저 고정해야 한다.**

이 문서는 그 전제를 확정하는 상위 feature다.

핵심 관계:

- `canvas-runtime-contract`
  - 공용 runtime contract
  - UI / CLI / 향후 MCP / 다른 framework client가 공통으로 의존
- `canvas-runtime-cqrs`
  - 그 contract를 어떤 계층 구조로 배치할지에 대한 아키텍처 방향
- `ai-first-canonical-cli`
  - 위 contract를 소비하는 AI-first headless surface

즉 이 문서는 “canvas editor를 어떻게 나눌 것인가”가 아니라, “무엇을 공용 계약으로 먼저 고정해야 하는가”를 정의한다.

## 2. 왜 이 feature가 먼저 필요한가

CLI는 raw DB를 만지는 도구가 아니어야 한다.

원하는 경로:

- `CLI -> runtime contract -> canonical business logic -> repository -> DB`

원하지 않는 경로:

- `CLI -> raw SQL / row patch / ad-hoc DB shape -> DB`

CLI가 headless editor로 동작하려면, 먼저 다음이 안정돼 있어야 한다.

1. 어떤 read model을 읽는가  
2. 어떤 command vocabulary로 의도를 표현하는가  
3. write result가 어떤 envelope로 돌아오는가  
4. revision/conflict/dry-run semantics가 어떻게 보장되는가

지금 `canvas-runtime-cqrs`는 구조적 분리 방향을 정의하고 있고, `ai-first-canonical-cli`는 AI-first 소비자 surface를 정의하고 있다.

하지만 둘 사이에 들어가야 할 **공용 runtime contract 문서**가 아직 없다.

즉 현재 부족한 것은:

- UI와 CLI가 같은 의미로 읽고 쓰기 위한 “공용 편집 계약”

## 3. 이 feature가 고정할 것

이 feature는 구현보다 먼저 아래 계약을 잠근다.

### 3.1 Projection Contracts

CLI와 UI가 공통으로 소비하는 canvas runtime의 read-side projection을 정의한다.

이번 feature는 read side를 아래 3개 projection으로 분리해 고정한다.

#### Hierarchy Projection

- canvas identity
- node tree / hierarchy view
- mindmap membership / parent-child topology
- object linkage
- AI/CLI가 구조를 이해하기 위한 tree-first projection

#### Render Projection

- flat render view
- rendered node / edge / mindmap group
- surface, z-order, bounds, layout 같은 framework-neutral rendering metadata
- ReactFlow/Svelte renderer가 공통으로 소비할 flat projection

#### Editing Projection

- editability/capability metadata
- source identity / edit target identity
- command capability set
- body entry capability
- ordered body block metadata
- block-level selection key / anchor ref / index targeting metadata
- selection/anchor 계산에 필요한 stable metadata
- `GraphCanvas`와 `CanvasEditorPage`가 UI helper 없이 편집 대상을 해석하기 위한 projection

중요:

- hierarchy / render / editing projection은 서로 대체재가 아니다.
- hierarchy는 구조 이해, render는 화면 배치, editing은 편집 가능성 해석을 담당한다.
- raw DB row shape를 그대로 노출하지 않는다.
- ReactFlow/Svelte component shape를 직접 read contract로 삼지 않는다.
- AI가 이해하기 쉬운 `hierarchy/tree projection`을 1급 surface로 둔다.

### 3.2 Command Contract

UI interaction과 CLI noun command가 공통으로 도달하는 command vocabulary를 정의한다.

예시 영역:

- node create
- node move
- node resize
- node rotate
- node presentation style update
- node render profile update
- node rename
- node reparent
- node delete
- object body block insert/update/remove/reorder
- capability/content patch

중요:

- UI-specific event payload를 공용 command로 삼지 않는다.
- DB patch 문법을 공용 command로 삼지 않는다.
- command는 domain intent여야 한다.
- resize는 raw drag vector가 아니라 `handle + nextSize + constraint` 기준으로 표현한다.
- rotate는 `nextRotation`만 public contract에 두고, pivot은 policy에서 해석한다.
- `nextRotation`은 절대 각도 기준의 clockwise degrees이며, public contract에서 `[0, 360)`로 정규화한다.
- move / resize / rotate / style / render profile은 가능한 한 의미론적 command로 분리한다.
- body block 위치는 raw block id보다 `selection` / `anchor` / `ordered index` 같은 position ref로 표현한다.
- editing projection은 body block별 `selection` / `anchor` / `ordered index`를 안정적으로 고를 수 있는 block-level metadata를 제공해야 한다.
- body block reorder event와 history replay는 `start/end/before-block/after-block` 같은 canonical placement vocabulary로 정규화한다.

### 3.3 Write Result Contract

모든 write surface가 동일한 mutation result envelope를 공유해야 한다.

최소 포함 요소:

- success / failure
- revision before / after 또는 equivalent version boundary
- changed set
- warnings
- rollback/diagnostic metadata
- structured error code
- retryable 여부
- history는 raw selection/anchor payload가 아니라 canonical replay form을 기록
- replay batch는 원래 request의 `dryRun` / `preconditions`를 그대로 들고 가지 않는다.

CLI가 요구하는 것:

- machine-readable JSON
- dry-run 결과도 같은 계열의 envelope
- conflict와 validation failure가 명시적으로 드러남

UI가 요구하는 것:

- optimistic replay와 invalidate를 위한 stable version/change metadata
- actionable error mapping 근거
- body block targeting을 재현 가능한 canonical history form

### 3.4 Conflict / Dry-run Contract

이 feature는 다음 semantics를 공통 규약으로 정의한다.

- revision precondition
- version conflict envelope
- dry-run validation result
- changed-set preview
- retryable / non-retryable failure 구분

즉 `dry-run`과 `conflict envelope`는 CLI 전용 기능이 아니라 runtime contract의 일부다.

## 4. `canvas-runtime-cqrs`와의 관계

둘은 겹치지만 역할이 다르다.

### `canvas-runtime-cqrs`

- `GraphCanvas`, `CanvasEditorPage`, runtime을 어떻게 분리할지
- Read / Command / Write를 어떤 레이어에 둘지
- framework-neutral architecture를 어떻게 만들지

### `canvas-runtime-contract`

- 그 레이어들이 어떤 payload와 result를 주고받는지
- UI/CLI/MCP가 어떤 공용 surface를 공유해야 하는지
- 어떤 projection / command / result / error envelope를 기준으로 삼을지

즉 CQRS 문서는 구조를 정의하고, 이 문서는 **구조 사이 계약**을 정의한다.

## 5. `ai-first-canonical-cli`와의 관계

`ai-first-canonical-cli`는 이 문서의 소비자다.

CLI와 직접 겹치는 핵심은 다음이다.

- hierarchy/tree projection
- render projection
- editing projection
- command intent vocabulary
- mutation result envelope
- dry-run semantics
- conflict envelope

따라서 우선순위는 아래가 맞다.

1. `canvas runtime contract` 고정  
2. `ai-first canonical CLI` 문서를 그 contract 기준으로 정렬  
3. 그 다음 CLI 구현

즉 CLI contract 문서는 폐기 대상이 아니라, 이 contract를 소비하는 입력 문서로 재해석해야 한다.

## 6. 비목표

이번 feature에서 바로 하지 않는 것:

1. CLI 구현 착수
2. Svelte client 구현
3. MCP transport 구현
4. React editor 전체 리팩터 완성
5. DB schema를 runtime contract로 직접 노출

이 문서는 구현이 아니라 **계약 고정**이 목표다.

## 7. 다음 작업 기준

이 문서를 기준으로 후속 작업은 아래 순서로 정의한다.

### 7.1 Contract Spec 작성

이번 feature 폴더 안에서 다음 계약 파일을 기준 입력으로 고정한다.

- `contracts/canvas-runtime-core.contract.ts`
- `contracts/canvas-command-language.contract.ts`
- `contracts/canvas-aggregate-events.contract.ts`
- `contracts/canonical-object-aggregate-events.contract.ts`
- `contracts/canvas-application-events.contract.ts`
- `contracts/canvas-projections.contract.ts`
- `contracts/canvas-write-results.contract.ts`

정리 원칙:

- TypeScript contract를 source of truth로 둔다.
- CLI noun surface처럼 transport-specific한 계약은 그대로 복사하지 않는다.
- `canvas-runtime-cqrs`의 구조 문서에서 예시로만 존재하던 command/read/write 경계는 여기서 타입 계약으로 승격한다.
- JSON schema는 필요해지는 시점에 이 TS contract에서 파생시키되, 지금 단계에서 과설계하지 않는다.

### 7.2 CQRS 문서와 정렬

- `canvas-runtime-cqrs`의 구조 설명이 이 contract를 소비하는 방식으로 정리돼야 한다.
- `GraphCanvas`는 `render projection`과 `editing projection`을 소비하는 adapter로 정리돼야 한다.
- `CanvasEditorPage`와 후속 application service는 `editing projection`을 기준으로 target/capability를 해석해야 한다.
- `GraphCanvas`와 `CanvasEditorPage` 개선 작업은 이 contract를 기준으로 나뉘어야 한다.

### 7.3 CLI 문서 정렬

- `docs/features/m2/ai-first-canonical-cli/README.md`
- `docs/features/database-first-canvas-platform/ai-cli-headless-surface/README.md`

위 문서들은 이 contract를 전제로 다시 정렬한다.

## 8. 성공 기준

다음이 만족되면 이 feature는 성공이다.

1. UI와 CLI가 공통으로 의존할 runtime contract의 범위가 명확하다.
2. hierarchy / render / editing projection이 서로 다른 책임으로 분리 정의된다.
3. editing projection이 body block 조작을 위해 block-level selection / anchor / ordered index metadata를 제공한다.
4. command vocabulary가 UI event나 DB patch가 아니라 domain intent 기준으로 정의된다.
5. dry-run / conflict / mutation result envelope가 diagnostics, rollback hint, structured error, retryable metadata를 포함한 runtime 공용 계약으로 승격된다.
6. history contract가 replay 시점에 흔들리지 않도록 canonical replay form을 기준으로 정의된다.
7. `ai-first-canonical-cli`가 독립 구현 feature가 아니라 runtime contract consumer로 재정의된다.

## 9. 관련 문서

- `../canvas-runtime-cqrs/README.md`
- `../../database-first-canvas-platform/ai-cli-headless-surface/README.md`
- `./MOCKUP-WIREFRAME.md`
- `./EVENT-COMMAND-MAPPING.md`
- `../ai-first-canonical-cli/README.md`
- `./EVENT-STORMING.md`
- `./BOUNDED-CONTEXT.md`
