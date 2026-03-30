# AI-First Canonical CLI

작성일: 2026-03-24  
상태: Draft  
결정: `domain editing interface + AI-first surface + full canvas editing scope`

## 1. 개요

이 feature는 `canonical + database-first` 구조 위에서 동작하는 새로운 CLI를 제품의 정식 편집 인터페이스로 정의한다.

핵심 목표는 앱 편집기 UI가 아직 완성되지 않았더라도, AI 에이전트와 사용자가 동일한 canonical 비즈니스 로직을 통해 workspace, canvas, canvas node를 안정적으로 조회하고 편집할 수 있게 만드는 것이다.

이 CLI의 primary audience는 AI 에이전트다. 다만 사용자도 동일한 CLI를 사용할 수 있어야 하며, UX는 사용자 친화성보다 `AI가 정확하고 반복 가능하게 조작할 수 있는 surface`를 우선한다.

## 2. 문제 정의

현재 코드베이스에는 canonical persistence, query, mutation executor가 이미 존재한다.

- canonical object / canvas node / revision이 database에 저장된다.
- mutation executor가 business rule, validation, revision 기록을 담당한다.
- query 계층이 workspace, canvas, object, surface 조회를 제공한다.

하지만 CLI는 아직 이 domain layer를 충분히 productized 하지 못했다.

- 일부 query surface만 노출되어 있다.
- 일부 single-intent mutation만 CLI 명령으로 노출되어 있다.
- AI가 사용자와 협업하면서 캔버스를 조작하는 데 필요한 noun command surface가 부족하다.
- document/canvas lifecycle와 canvas-node editing이 CLI 관점에서 완결되지 않았다.

결과적으로 현재 구조는 DB-first editor의 핵심을 이미 갖고 있으면서도, 실제 조작 인터페이스가 UI 구현 상태에 과도하게 종속되어 있다.

## 3. 핵심 결정

### 3.1 CLI를 도메인 편집 인터페이스로 정의한다

CLI는 단순한 개발자 유틸리티가 아니다.

- CLI는 canonical DB를 위한 공식 headless editing interface다.
- 앱 UI는 canonical state를 렌더링하고 사용자 상호작용을 mutation 요청으로 번역하는 client다.
- CLI는 UI 없이 동일한 domain behavior를 직접 사용할 수 있는 편집기다.

즉 역할 분리는 다음과 같다.

- `shared canonical domain`
  - query, mutation, validation, revision, persistence를 담당
- `CLI`
  - headless domain editor
- `App UI`
  - canonical state renderer + interactive client

### 3.2 raw DB 수정은 금지하고 반드시 business logic layer를 통과한다

이 feature의 가장 중요한 원칙은 direct storage patch를 허용하지 않는 것이다.

- 좋은 경로: `CLI -> canonical query/mutation service -> repository -> DB`
- 금지 경로: `CLI -> raw SQL / raw row patch -> DB`

이 원칙이 필요한 이유:

- validation이 domain 규칙과 분리되면 object/node consistency가 깨진다.
- revision 기록이 누락되면 협업과 conflict handling이 불가능해진다.
- 앱 UI와 CLI가 서로 다른 편집 규칙을 가지게 되면 제품 전체가 불안정해진다.

따라서 CLI는 DB를 직접 수정하는 도구가 아니라, **canonical business logic를 transport하는 도구**여야 한다.

### 3.3 CLI는 사용자와 AI 모두를 대상으로 하되, surface는 AI 친화적으로 설계한다

이 feature의 주 사용자는 AI 에이전트다.

- AI는 현재 상태를 query로 읽는다.
- 원하는 편집을 single-intent command 또는 mutation batch로 적용한다.
- 결과 revision과 changed set을 확인한다.
- 다시 query해서 사용자에게 변경 결과를 설명한다.

사용자도 같은 CLI를 사용할 수 있지만, human-friendly interaction은 앱 UI가 담당한다.

따라서 CLI는 다음 특성을 가져야 한다.

- 명령이 직교적이고 예측 가능하다.
- 모든 편집 결과가 구조화된 JSON으로 반환된다.
- partial failure, validation failure, revision conflict를 명시적으로 드러낸다.
- 자연어 인터페이스 대신 stable command contract를 우선한다.

### 3.4 범위는 전체 workspace/canvas/canvas-node 편집이다

이번 feature의 scope는 대표 명령 몇 개만 여는 것이 아니다.

v1 목표는 canonical DB를 기준으로 다음 영역을 CLI에서 완결하는 것이다.

- workspace 조회/관리
- canvas 조회/생성/관리
- canvas node 조회/생성/수정/이동/재부모화/이름변경/삭제/z-order 조정
- canvas node hierarchy 조회
- bulk canvas node 편집
- object content/capability 편집
- 복수 operation batch mutation

즉 CLI는 “보조 명령 모음”이 아니라, canvas 편집의 headless primary surface가 된다.

### 3.5 캔버스 이해를 위한 hierarchy read surface를 1급 기능으로 둔다

캔버스 노드는 평면 목록만으로는 충분히 이해되지 않는다. 이 feature는 이를 2D 게임 엔진의 scene hierarchy와 유사한 read model로 정의한다.

최소 지원 관점은 다음과 같다.

- logical hierarchy
  - `parentNodeId` 기준 트리
- render hierarchy
  - `surfaceId`, `zIndex` 기준의 렌더 순서
- domain linkage
  - `canonicalObjectId`, 요약 텍스트, semantic role

기본 응답은 전체 정보를 반환한다. 다만 필요한 경우 `tree` 결과에는 projection을 적용할 수 있어야 한다.

- 기본값: 모든 계층 정보 포함
- 선택값: MongoDB 스타일 projection object
- 단, raw storage field path가 아니라 공개 hierarchy contract path만 허용
- include projection과 exclude projection은 MongoDB처럼 혼합하지 않는다.
- 예외적으로 `id` 필드는 include/exclude 어느 모드에서도 함께 제어할 수 있다.

이 계층 뷰는 AI가 다음 작업을 하기 위한 핵심 기반이다.

- 어떤 node가 어떤 부모 아래에 있는지 판단
- mindmap child/sibling 구조를 해석
- bulk mutation 전에 구조적 영향 범위를 이해
- 사용자의 "이 그룹 아래 있는 카드들" 같은 지시를 안전하게 해석
- 필요한 경우 projection으로 응답 크기를 줄이고, AI가 읽어야 할 정보만 좁힐 수 있음

## 4. 제품 모델

이 feature가 고정하는 제품 모델은 다음과 같다.

- DB는 source of truth다.
- canonical domain layer는 유일한 편집 규칙이다.
- CLI는 AI-first headless editor다.
- 앱은 canonical state renderer + interactive editing client다.

이 모델에서는 UI 개발이 늦더라도 domain editing capability는 독립적으로 진전될 수 있다.

## 5. 사용자 유형

### AI 에이전트

- 사용자의 요청을 바탕으로 현재 workspace/canvas 상태를 읽는다.
- 정해진 command contract로 canvas를 수정한다.
- revision과 changed set을 근거로 변경 사항을 설명한다.
- 필요하면 복수 mutation을 batch로 묶어 atomic하게 적용한다.

### 고급 사용자 / 개발자 사용자

- workspace와 canvas를 직접 관리한다.
- UI가 아직 열지 않은 편집 기능을 CLI로 먼저 사용한다.
- 스크립트, 자동화, 운영 작업에서 canonical state를 제어한다.

## 6. 목표

1. 앱 UI 개발 상태와 무관하게 canonical DB 기반 workspace/canvas/canvas-node 편집을 수행할 수 있다.
2. AI 에이전트가 stable command contract를 통해 사용자와 협업하며 캔버스를 조작할 수 있다.
3. 모든 편집 경로가 동일한 business logic layer를 재사용한다.
4. CLI, 앱, 향후 MCP/HTTP surface가 같은 query/mutation invariants를 공유한다.
5. 편집 결과는 revision-aware 하고 conflict-aware 하며 machine-readable 해야 한다.

## 7. 비목표

1. raw SQL 또는 repository bypass 경로를 사용자용 feature로 제공하지 않는다.
2. 자연어 planner 자체를 CLI의 핵심 surface로 정의하지 않는다.
3. human-first interactive wizard를 CLI 기본 인터페이스로 만들지 않는다.
4. 앱 UI가 해야 할 탐색성과 시각적 affordance를 CLI에서 대체하려고 하지 않는다.
5. canonical rule과 별개의 CLI 전용 편집 규칙을 만들지 않는다.

## 8. Command Surface 원칙

CLI는 두 층으로 구성한다.

### 8.1 Single-intent noun command

AI가 자주 호출하는 직접 명령이다.

- `workspace ...`
- `canvas ...`
- `canvas-node ...`
- `object ...`

이 계층의 목적은 에이전트가 작은 편집을 빠르고 명확하게 수행하게 하는 것이다.

### 8.2 Batch mutation command

복합 변경과 고급 편집은 `mutation apply`로 수행한다.

- 여러 operation을 한 번에 적용
- dry-run 지원
- revision precondition 지원
- structured changed set 반환
- AI 협업을 위한 bulk editing 정식 지원

직접 명령과 batch 명령은 서로 다른 business logic를 가지지 않는다. 둘 다 같은 canonical mutation executor를 사용해야 한다.

### 8.3 Bulk editing을 1급 기능으로 지원한다

AI 에이전트는 단건 편집보다 다건 편집을 더 자주 수행한다.

- 여러 node를 한 의도로 함께 이동
- 여러 node를 한 번에 삭제
- 여러 node에 동일한 style/props patch 적용
- 검색/선택 결과를 기준으로 복수 object나 node를 수정

따라서 CLI는 bulk editing을 optional sugar가 아니라 정식 capability로 제공해야 한다.

핵심 원칙은 다음과 같다.

- canonical bulk path는 `mutation apply`의 `operations[]` batch다.
- direct bulk noun command가 있더라도 내부적으로는 같은 executor를 사용한다.
- 가능하면 하나의 사용자 의도는 하나의 revision으로 기록한다.
- dry-run, changed set, revision precondition은 bulk path에서도 동일하게 유지한다.
- partial success를 성공처럼 숨기지 않는다.

### 8.4 Bulk input은 명시적 JSON 인자를 사용한다

bulk editing 입력은 shell pipe나 Linux-style stdin workflow를 기본 전제로 두지 않는다.

- 기본 입력 경로는 `--input-file <path>` 다.
- 소형 payload에 한해 `--input <json-string>`을 허용할 수 있다.
- stdin 파이프는 primary interface로 두지 않는다.

이 결정의 이유는 다음과 같다.

- AI가 파일 기반 payload를 만들고 명시적으로 실행하기 쉽다.
- shell별 quoting 차이와 pipe 의존을 줄일 수 있다.
- 동일한 payload를 재실행, 저장, 검토하기 쉽다.
- CLI, 앱, MCP, automation이 같은 payload contract를 재사용하기 좋다.

즉 canonical bulk transport는 "stdin으로 흘려보내는 JSON"이 아니라 "명시적 인자로 전달하는 JSON payload"다.

### 8.5 Mongo-style operator 문법은 채택하되 raw patch 문법은 금지한다

bulk payload의 기본 표현은 JSON으로 유지한다. 다만 operator 표현은 MongoDB처럼 `$` prefix를 가진 domain operator 문법을 채택할 수 있다.

하지만 그대로 MongoDB의 generic field patch 모델을 가져오지는 않는다.

- 허용: domain intent를 드러내는 `$operator`
- 금지: storage path를 직접 수정하는 generic `$set`, `$unset`, `$push`

허용되는 방향의 예:

- `$createNode`
- `$moveNode`
- `$reparentNode`
- `$updateNode`
- `$renameNode`
- `$deleteNode`
- `$updateObjectContent`
- `$patchObjectCapability`

금지되는 방향의 예:

- `"$set": { "canvasNodes.node-1.layout.x": 100 }`
- `"$unset": { "objects.note-1.deletedAt": true }`

핵심 원칙은 다음과 같다.

- payload는 persistence schema가 아니라 domain intent를 표현해야 한다.
- operator는 business capability에 대응해야 한다.
- validation, revision, relation integrity는 항상 canonical executor가 책임져야 한다.

즉 이 feature에서의 `$operator` 문법은 "DB patch 문법"이 아니라 "domain mutation 문법"이다.

## 9. 우선 노출해야 할 편집 능력

### Workspace

- list
- get
- create or ensure
- workspace scope resolution

### Canvas

- list
- get
- create
- compatibility file path / shell metadata 조회

### Canvas Node

- get
- query
- tree
- create
- move
- move-many
- reparent
- reparent-many
- update props/style
- update-many
- rename
- delete
- delete-many
- z-order update
- z-order-many

### Object

- get
- query
- update-content
- patch-capability
- 필요 시 body block mutation

### Mutation

- apply
- dry-run
- actor metadata
- reason metadata
- revision precondition
- explicit JSON input via `--input-file` / `--input`
- domain operator batch 표현

## 10. 협업 모델

이 CLI가 제공해야 하는 협업 감각은 다음과 같다.

1. AI는 현재 canvas 상태를 읽는다.
2. AI는 사용자의 의도에 맞는 mutation을 계산한다.
3. CLI는 단건이든 bulk든 canonical rule을 통과한 변경만 적용한다.
4. CLI는 revision과 changed set을 반환한다.
5. AI는 그 결과를 사용자에게 설명하고 다음 액션을 제안한다.

이 과정에서 중요한 것은 “AI가 임의로 DB를 건드린다”가 아니라, “AI가 사용자 대신 정식 편집 인터페이스를 사용한다”는 점이다.

## 11. 성공 기준

다음이 가능하면 이 feature는 성공이다.

- 앱 편집기 UI가 없어도 canvas를 새로 만들고 node를 생성/수정/삭제할 수 있다.
- AI가 query + single-intent command + bulk mutation만으로 사용자의 canvas 작업을 끝까지 수행할 수 있다.
- 모든 편집은 revision을 남기고, conflict를 명시적으로 보고한다.
- CLI 명령은 앱 UI가 나중에 붙어도 바뀌지 않을 정도로 안정적인 domain contract를 가진다.

## 12. 구현 방향 메모

- `document`는 compatibility alias로 유지하되 primary noun은 `canvas`로 수렴하는 편이 낫다.
- `canvas-node`는 AI 협업 편집의 중심 명령 surface가 된다.
- `mutation apply`는 low-level escape hatch가 아니라 canonical bulk editing path다.
- direct noun command는 convenience layer일 뿐, 별도 rule engine을 가지면 안 된다.
- structured JSON envelope는 모든 headless surface의 기본 계약이어야 한다.
- bulk payload의 primary transport는 `--input-file` 이다.
- `$` prefix operator를 사용하더라도 operator는 domain action이어야 하며 raw field patch가 아니어야 한다.

## 13. Contracts

상세 계약은 README에 계속 인라인으로 확장하지 않고 `contracts/` 폴더에서 관리한다.

- TypeScript contract
  - [bulk-mutation.contract.ts](/Users/danghamo/Documents/gituhb/magam/docs/features/m2/ai-first-canonical-cli/contracts/bulk-mutation.contract.ts)
  - [mutation-result.contract.ts](/Users/danghamo/Documents/gituhb/magam/docs/features/m2/ai-first-canonical-cli/contracts/mutation-result.contract.ts)
  - [operator-catalog.contract.ts](/Users/danghamo/Documents/gituhb/magam/docs/features/m2/ai-first-canonical-cli/contracts/operator-catalog.contract.ts)
  - [command-surface.contract.ts](/Users/danghamo/Documents/gituhb/magam/docs/features/m2/ai-first-canonical-cli/contracts/command-surface.contract.ts)
  - [canvas-hierarchy.contract.ts](/Users/danghamo/Documents/gituhb/magam/docs/features/m2/ai-first-canonical-cli/contracts/canvas-hierarchy.contract.ts)
- JSON Schema
  - [bulk-mutation.schema.json](/Users/danghamo/Documents/gituhb/magam/docs/features/m2/ai-first-canonical-cli/contracts/bulk-mutation.schema.json)
  - [mutation-result.schema.json](/Users/danghamo/Documents/gituhb/magam/docs/features/m2/ai-first-canonical-cli/contracts/mutation-result.schema.json)
  - [canvas-hierarchy.schema.json](/Users/danghamo/Documents/gituhb/magam/docs/features/m2/ai-first-canonical-cli/contracts/canvas-hierarchy.schema.json)

이 계약들은 다음 원칙을 따른다.

- public payload는 domain intent를 표현한다.
- public payload는 raw DB patch 문법을 노출하지 않는다.
- CLI, 앱, MCP, automation이 같은 payload shape를 재사용할 수 있어야 한다.
- README는 방향과 결정사항을 설명하고, 세부 shape는 contracts 파일이 source of truth가 된다.
- hierarchy projection은 MongoDB 방식을 따른다.
- projection은 inclusion 또는 exclusion 중 하나의 모드만 사용한다.
- `id`만 MongoDB의 `_id`처럼 예외 필드로 취급한다.
- projection은 공개 contract path에만 적용된다.

## 14. 다음 구현 단계

### Phase 1

- canvas lifecycle command 완성
- canvas-node editing surface 완성
- mutation metadata / help / JSON contract 정리

### Phase 2

- AI가 자주 쓰는 고수준 shortcut 추가
- mindmap-oriented convenience verbs 확장
- MCP / app-attached transport와 surface alignment 강화
