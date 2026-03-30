# AI CLI Headless Surface

## 개요

이 slice는 앱이 실행 중이지 않아도 동작하는 AI-first CLI surface를 정의하고 구현하는 단계다.

목표는 canonical persistence와 mutation/query core를 app 비실행 상태에서도 재사용 가능한 headless transport로 노출하는 것이다.

v0에서는 대표 read surface와 대표 single-intent mutation command를 직접 열고, 나머지 core mutation은 공통 `mutation apply` batch path로 transport 가능하게 만드는 데 집중한다.

## 왜 세 번째인가

- CLI가 먼저 나오면 persistence와 mutation contract가 역으로 굳어질 위험이 있다.
- headless CLI는 canonical service가 먼저 안정되어야 얇은 transport로 유지할 수 있다.

## 범위

- headless CLI bootstrap과 workspace/document ref 기반 service boot
- workspace/document/object/surface/search query 명령
- 대표 single-intent mutation command
  - `object update-content`
  - `object patch-capability`
  - `canvas-node move`
  - `canvas-node reparent`
- core mutation 전체를 transport할 `mutation apply` / `--dry-run`
- `--json` 중심 응답
- structured success/failure envelope
- `jq` 친화 envelope
- app-attached/MCP가 그대로 재사용할 shared command surface invariants

## 비범위

- live selection/session access
- app-attached bridge 구현 자체
- plugin source authoring/publish
- planner-style 자연어 대형 변경 interface
- body block/relation/binding/plugin-instance 전용 noun command의 전체 확장

## 핵심 계약

- 앱 비실행 상태에서도 동작
- raw DB access 금지
- domain command만 노출
- document/object/surface/mutation command는 implicit session 없이 explicit ref와 CLI 인자로 실행
- canonical filter 우선
  - `--semantic-role`
  - `--content-kind`
  - `--has-capability`
- partial read는 CLI 인자와 domain filter가 담당
  - `--include`
  - `--limit`
  - `--cursor`
  - `--bounds`
- query/mutation 결과는 구조화된 JSON envelope 반환
- direct noun command와 `mutation apply`는 같은 query/mutation service를 재사용
- headless/app-attached/MCP는 command 이름, 인자, JSON envelope를 공유

## 구현 전제

- `workspace list/get`을 제외한 headless command는 workspace ref 또는 document ref 같은 persisted identifier를 명시적으로 받는다.
- headless bootstrap은 CLI 입력으로 받은 ref와 local workspace 설정/DB 연결 정보를 이용해 in-process query service와 mutation executor를 부팅한다.
- bootstrap이 실패하면 raw storage fallback이 아니라 구조화된 CLI 오류를 반환한다.
- 이 slice의 direct noun command는 v0 대표 surface만 고정하고, 나머지 core mutation verb는 `mutation apply`에서 같은 executor로 흘려보낸다.
- app-attached slice는 여기서 고정한 command surface를 확장만 하고 대체하지 않는다.

## 현재 구현 메모

- 현재 스키마에는 dedicated `workspaces` / `documents` table이 없으므로, `workspace` / `document` resource는 `objects`, `canvas_nodes`, `canvas_bindings`, `document_revisions`에서 유도한 summary로 노출한다.
- default workspace ref는 현재 디렉터리 basename 또는 `MAGAM_WORKSPACE_ID`에서 유도한다.
- canonical DB 경로는 `MAGAM_CANONICAL_DB_PATH`가 있으면 그것을 쓰고, 없으면 `<targetDir>/.magam/canonical-pgdata`를 사용한다.
- `mutation apply`는 direct noun command 외에 `object.body.replace`, `object.body.block.insert`, `object.body.block.update`, `object.body.block.remove`, `object.body.block.reorder`를 batch-only path로 지원한다.

## Command Surface v0

- query
  - `workspace list`
  - `workspace get`
  - `document get`
  - `surface get`
  - `surface query-nodes`
  - `object get`
  - `object query`
  - `search objects`
  - `search documents`
- representative mutation
  - `object update-content`
  - `object patch-capability`
  - `canvas-node move`
  - `canvas-node reparent`
- shared batch mutation
  - `mutation apply`
  - `mutation apply --dry-run`

## JSON / Error Contract

- `--json` 모드에서는 stdout에 순수 JSON만 출력하고 human-friendly 로그를 섞지 않는다.
- query success envelope는 `ok`, `data`, `meta`를 유지하고, list 응답은 `data.items`, `data.nextCursor`를 기본 구조로 둔다.
- mutation success envelope는 `documentRevisionBefore`, `documentRevisionAfter`, `changed`, `warnings` 같은 structured result를 포함한다.
- failure envelope는 `ok: false`, `error.code`, `error.message`, `error.details`, `error.retryable`를 포함한다.
- representative error code는 최소 다음을 포함한다.
  - `WORKSPACE_NOT_FOUND`
  - `WORKSPACE_BOOTSTRAP_FAILED`
  - `DOCUMENT_REVISION_CONFLICT`
  - `INVALID_CAPABILITY`
  - `INVALID_CAPABILITY_PAYLOAD`
  - `CONTENT_CONTRACT_VIOLATION`
  - `PATCH_SURFACE_VIOLATION`
- `ok: false`인 경우 CLI process는 non-zero exit code를 반환한다.

## 선행조건

- `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`
- `docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`
- `docs/features/database-first-canvas-platform/ai-cli-tooling.md`

## 구현 계획

### Step 1. Headless bootstrap contract 고정

- query/mutation command가 어떤 persisted ref를 필수로 받는지 먼저 잠근다.
- CLI가 local workspace 설정과 DB 연결 정보를 읽어 in-process service context를 만드는 bootstrap 경계를 명시한다.
- workspace/document ref 해석 실패와 DB bootstrap 실패를 구조화된 오류 코드로 정리한다.
- 이 단계에서 raw DB shell이나 ad-hoc repository 직접 호출 경로는 열지 않는다.

### Step 2. Query surface를 먼저 구현

- `workspace`, `document`, `surface`, `object`, `search` 계열 read command를 `--json` 우선으로 연다.
- canonical filter와 partial read 인자(`--semantic-role`, `--content-kind`, `--has-capability`, `--include`, `--limit`, `--cursor`, `--bounds`)를 공통 parsing 규칙으로 고정한다.
- list/query 응답이 같은 envelope를 유지하도록 meta, pagination, projection 규칙을 맞춘다.
- `jq`는 후처리 도구로만 두고 query 범위 축소는 항상 CLI 인자와 service filter가 담당하게 한다.

### Step 3. Representative single-intent mutation command를 연결

- `object update-content`, `object patch-capability`, `canvas-node move`, `canvas-node reparent`를 direct noun command로 먼저 연다.
- direct command는 transport sugar만 제공하고 실제 실행은 `canonical-mutation-query-core`의 같은 executor를 재사용한다.
- content-kind/capability gate, revision precondition, changed-set shape를 CLI layer에서 다시 정의하지 않는다.
- 실패는 silent fallback 없이 structured error envelope와 non-zero exit로 노출한다.

### Step 4. Shared batch executor와 dry-run을 고정

- `mutation apply`를 headless CLI의 canonical write path로 두고, direct command도 내부적으로는 같은 batch executor로 번역 가능하게 정리한다.
- noun command로 아직 열지 않은 core mutation verb는 `mutation apply`를 통해 transport 가능해야 한다.
- `--dry-run`은 validation, changed-set preview, revision precondition 평가 결과를 structured result로 반환한다.
- success/failure envelope를 direct command와 batch command 모두에서 동일하게 유지한다.

### Step 5. App-attached/MCP handoff contract를 정리

- command 이름, 필수 인자, JSON envelope가 후속 mode에서도 그대로 유지되도록 문서에 고정한다.
- app-attached slice는 session-aware command만 추가하고, core headless command는 그대로 fallback 가능해야 한다.
- MCP wrapper는 여기서 고정한 service contract와 envelope를 transport만 바꿔 재사용하도록 경계를 남긴다.
- 구현 종료 시 대표 query와 대표 mutation 흐름을 README 수준에서 재현 가능한 예시로 남긴다.

## 단계별 산출물

- bootstrap contract: required ref, workspace/DB bootstrap 경계, bootstrap error code
- query contract: filter/include/pagination/bounds parsing 규칙과 JSON envelope
- representative mutation contract: direct noun command -> canonical executor 매핑
- batch mutation contract: `mutation apply`/`--dry-run` input/output shape
- handoff memo: app-attached/MCP가 공유할 command surface invariants

## 검증 계획

- 앱 비실행 상태에서 representative query가 workspace bootstrap을 통해 안정적으로 동작한다.
- `object update-content`, `object patch-capability`, `canvas-node move/reparent`가 같은 mutation executor를 사용한다.
- validation/revision conflict/bootstrap failure가 모두 structured error envelope와 non-zero exit로 노출된다.
- noun command로 직접 열지 않은 core mutation도 `mutation apply`로 transport 가능하다.
- `jq` 파이프를 사용해도 query partiality 책임이 CLI 인자와 service filter에 남아 있다.

## 구현 예시

```bash
magam workspace list --json
magam object query --workspace ws-smoke --semantic-role sticky-note --json
magam surface query-nodes --document doc-smoke --surface main --bounds 0,0,800,600 --json
printf '{"source":"# hello"}' | magam object update-content --workspace ws-smoke --document doc-smoke --object note-1 --kind markdown --patch @stdin --json
printf '{"workspaceRef":"ws-smoke","documentRef":"doc-smoke","operations":[{"op":"canvas.node.move","nodeId":"node-1","patch":{"x":12,"y":34}}]}' | magam mutation apply --json
```

## 다음 slice에 넘겨야 할 것

- app-attached mode와 공유할 command 이름/인자/JSON envelope
- MCP wrapper가 재사용할 headless bootstrap 이후 service contract
- bootstrap failure와 validation failure를 포함한 structured error taxonomy
- representative noun command와 `mutation apply` 사이의 공통 executor 경계

## 완료 기준

- headless mode에서 `workspace`, `document`, `surface`, `object`, `search` representative query가 `--json`으로 동작한다.
- headless bootstrap이 explicit ref와 local workspace 설정만으로 canonical service를 부팅한다.
- `object update-content`, `object patch-capability`, `canvas-node move/reparent`가 CLI에서 canonical executor를 통해 수행된다.
- `mutation apply --dry-run`이 structured result를 반환하고 noun command와 같은 envelope를 공유한다.
- validation/bootstrap/revision conflict failure가 stable `error.code`와 non-zero exit로 노출된다.
- noun command로 직접 열지 않은 core mutation이 `mutation apply`로 transport 가능하다.
- `jq` 파이프를 전제로 해도 core query partiality는 CLI 인자가 담당한다.
