# Plugin Runtime v1

## 개요

이 slice는 database-first canonical model과 canvas composition 위에 plugin runtime을 올리는 단계다.

목표는 chart/table/calendar/custom widget 같은 외부 시각화 요소를 문서와 분리된 runtime asset으로 안전하게 수용하는 것이다.

v1의 우선 경로는 canvas에 배치되는 widget export다. plugin이 core schema를 대체하는 것이 아니라, canonical storage와 mutation/query core 위에 제한된 확장 surface를 여는 것이 목적이다.

## 왜 마지막인가

- umbrella merge 기준으로는 마지막 slice다.
- plugin은 `canonical-object-persistence`와 `canonical-mutation-query-core`를 소비하는 쪽이므로, core storage/mutation contract가 먼저 잠겨야 한다.
- 다만 실제 hard dependency는 위 두 slice가 중심이고, plugin registry/schema/sandbox bridge 설계 일부는 그 이후 병렬로 탐색할 수 있다.
- `ai-cli-headless-surface`와 `app-attached-session-extension`은 plugin instance 관리, selection/session access 같은 연계 surface를 제공하지만, plugin runtime 자체의 시작 조건을 과도하게 막는 선행조건은 아니다.

## 범위

- plugin manifest/registry/version/export 모델
- plugin instance persistence 연동
- `iframe sandbox + postMessage bridge` 기반 runtime
- host API 최소 계약
- missing plugin fallback
- props/binding validation
- plugin capability gate 및 bridge diagnostics

## 비범위

- plugin marketplace/결제/배포 채널 확정
- raw plugin source authoring/publish UX
- arbitrary trusted code direct mount
- final security hardening 전체
- capability grant 운영 정책의 최종 확정

## 핵심 계약

### Runtime Model

- plugin code는 document 본문이 아니라 package/version asset으로 저장한다.
- canvas document는 plugin source 전체를 저장하지 않고, 배치된 plugin instance와 canvas placement만 저장한다.
- untrusted plugin의 v1 실행 경로는 `iframe sandbox + postMessage bridge`다.
- plugin은 host main React tree에 직접 mount되지 않으며, host DOM/store/DB에 직접 접근하지 않는다.
- v1 우선 export는 widget이다. panel/inspector 같은 확장은 후속 slice나 hardening 단계에서 검토한다.

### Persistence Boundary

- plugin source는 `plugin_packages`, `plugin_versions`, `plugin_exports`가 소유한다.
- 실제 배치는 `plugin_instances`와 관련 `canvas_nodes`, 선택적 `canvas_bindings`가 소유한다.
- plugin instance는 최소 `plugin_export_id`, `plugin_version_id`, `props`, `binding_config`, `persisted_state`를 가진다.
- canvas document의 canonical truth는 `plugin reference + props + binding + placement`이며, plugin source 자체를 문서에 인라인 저장하지 않는다.

### Host API 최소 범위

- `queryObjects(input)`
- `getObject(id)`
- `getSelection()`
- `updateInstanceProps(instanceId, patch)`
- `emitAction(type, payload)`
- `requestResize(sizeHint)`

plugin은 선언된 capability와 bridge를 통해서만 위 API를 호출할 수 있다. direct DB access, raw network access, arbitrary DOM mount는 기본 허용이 아니다.

### Validation and Failure Contract

- `prop_schema`와 `binding_schema`는 plugin instance create/update/load 경로에서 검증한다.
- validation 실패는 조용히 보정하지 않고 표준 구조화 에러 계약으로 surface에 전달한다.
- selection 같은 session-aware host API는 attached session이 없으면 app-attached 문서와 정렬된 구조화 실패로 반환한다.
- capability 선언 밖 호출은 명시적으로 거부한다.
- plugin load/runtime failure는 surface-local 실패로 다루며 문서 전체 load failure가 되어서는 안 된다.

### Missing Plugin Fallback

- package/version/export를 찾을 수 없거나 bundle load에 실패해도 동일 instance id를 유지한 placeholder fallback을 렌더한다.
- fallback은 최소 display identity, export/version identity, `props`, `binding_config`, `persisted_state`를 보존해야 한다.
- 진단 정보는 missing package/version/export와 runtime crash를 구분할 수 있어야 한다.

## 선행조건

- `docs/features/database-first-canvas-platform/canonical-object-persistence/README.md`
- `docs/features/database-first-canvas-platform/canonical-mutation-query-core/README.md`
- `docs/features/database-first-canvas-platform/schema-modeling.md`
- `docs/features/database-first-canvas-platform/entity-modeling.md`

## 관련 문서

- `docs/features/database-first-canvas-platform/implementation-plan.md`
- `docs/features/database-first-canvas-platform/ai-cli-headless-surface/README.md`
- `docs/features/database-first-canvas-platform/app-attached-session-extension/README.md`

## 구현 계획

### 구현 원칙

- plugin runtime은 새 canonical schema를 만드는 작업이 아니라, 이미 정의된 persistence/mutation contract 위에 runtime을 얹는 작업으로 유지한다.
- storage boundary와 runtime boundary를 동시에 넓히지 않는다. 먼저 registry/export/instance contract를 잠그고, 그 다음 sandbox bridge를 붙인다.
- plugin failure는 항상 instance/surface 단위로 격리한다.
- session-aware host API는 선택적 확장으로 두고, core load/render/update 경로는 headless-compatible contract 위에 유지한다.

### Step 1. Registry 및 persistence contract 고정

- `plugin_packages`, `plugin_versions`, `plugin_exports`, `plugin_instances`의 역할과 연결 키를 구현 기준으로 고정한다.
- manifest에 runtime, entry, export 목록, capability 선언이 최소 필드로 존재하도록 정리한다.
- instance load 시 필요한 `plugin_export_id`, `plugin_version_id`, `props`, `binding_config`, `persisted_state` read model을 정의한다.
- canvas placement와 plugin instance ownership 경계가 충돌하지 않도록 `canvas_nodes` 연계 규칙을 고정한다.

산출물:

- registry/domain type 초안
- manifest/export/instance validator 초안
- plugin instance hydrate/load contract

검증:

- 동일 문서를 다시 열어도 instance identity와 version/export reference가 안정적으로 복원된다.
- 설치되지 않은 plugin version reference도 row 손실 없이 읽힌다.

### Step 2. Sandbox host와 bridge 구현

- host 쪽에 plugin registry resolver, bundle loader, iframe lifecycle manager를 추가한다.
- sandbox와 host 사이 통신 envelope를 `postMessage` 기반 request/response/event shape로 고정한다.
- bridge에서 capability gate를 적용해 허용된 host API만 노출한다.
- `queryObjects`, `getObject`, `updateInstanceProps`, `emitAction`, `requestResize`를 우선 구현하고 `getSelection`은 session availability를 반영해 연결한다.

산출물:

- iframe host runtime
- bridge protocol 타입
- capability-aware host API dispatcher

검증:

- plugin이 bridge 없이 host store나 DOM에 직접 접근하지 못한다.
- 허용되지 않은 host API 호출은 구조화된 에러로 거부된다.

### Step 3. Instance lifecycle와 validation 연결

- 문서 load 시 plugin instance를 export/version 기준으로 hydrate하고, canvas node와 연결해 렌더 진입점을 만든다.
- instance create/update/load 경로마다 `prop_schema`, `binding_schema` 검증을 공통 경로로 붙인다.
- resize 요청, props patch, binding update가 전체 문서 overwrite 없이 mutation/query core를 통해 반영되게 한다.
- app-attached session이 있을 때만 selection-aware API를 연결하고, 없으면 구조화된 실패 응답을 유지한다.

산출물:

- plugin instance renderer entry
- props/binding validation pipeline
- mutation/query core 연동 path

검증:

- invalid props/binding 입력이 placeholder success로 숨겨지지 않고 표준 에러 계약으로 surface에 노출된다.
- plugin props patch 후 reload 시 persisted 값이 유지된다.

### Step 4. Missing plugin fallback과 diagnostics 정리

- package/version/export 누락, bundle load 실패, runtime crash를 구분하는 fallback 상태 모델을 만든다.
- fallback UI는 동일 instance id와 display identity를 유지하면서 사용자에게 복구 가능한 진단 정보를 표시한다.
- 문서 전체 load는 계속 성공시키고, 실패한 plugin instance만 local placeholder로 대체한다.
- bridge/runtime 이벤트에 최소 진단 로그와 상태 코드를 남긴다.

산출물:

- missing plugin placeholder renderer
- runtime failure classifier
- diagnostic event/log shape

검증:

- plugin bundle이 없어도 문서의 다른 native node와 plugin instance 목록은 정상 로드된다.
- runtime crash와 missing export가 서로 다른 진단 코드로 구분된다.

### Step 5. Example plugin과 end-to-end 검증

- 최소 2종의 representative example plugin을 준비한다. 권장 예시는 `chart`와 `table`이다.
- 두 예제 모두 sandbox 경로에서 mount되고, props/binding/update/fallback 동작을 재현할 수 있어야 한다.
- CLI 또는 같은 service contract를 재사용하는 테스트 경로에서 plugin instance create/update/remove를 검증한다.
- hardening 전 단계에서 필요한 제한과 미해결 운영 이슈를 문서에 남긴다.

산출물:

- example plugin 2종
- sandbox render smoke path
- plugin runtime v1 제한사항 목록

검증:

- 최소 2종 plugin 예제가 representative document에서 렌더된다.
- plugin load failure와 validation failure가 서로 다른 경로로 재현된다.

### Example Setup / Manual Verification

chart/table reference plugin은 아래 파일을 기준으로 준비한다.

- `app/features/plugin-runtime/examples/chart/manifest.ts`
- `app/features/plugin-runtime/examples/chart/index.tsx`
- `app/features/plugin-runtime/examples/table/manifest.ts`
- `app/features/plugin-runtime/examples/table/index.tsx`
- `app/features/plugin-runtime/smoke.ts`

수동 검증 시나리오:

1. `plugin-instance.create`로 `chart.bar` 또는 `table.grid` 인스턴스를 생성한다.
2. `plugin-instance.update-props`로 props patch를 적용하고 reload 이후 동일 값이 유지되는지 확인한다.
3. `plugin-instance.update-binding`으로 binding 설정을 갱신하고 instance snapshot에 반영되는지 확인한다.
4. plugin bundle 누락을 가정한 fallback 경로를 실행해 문서 전체가 아니라 해당 instance만 placeholder로 전환되는지 확인한다.
5. smoke harness(`runPluginRuntimeSmokeScenario`)에서 `install -> resolve-export -> create -> update-props -> missing-plugin -> snapshot` 단계가 모두 기대한 결과를 반환하는지 확인한다.

## 완료 기준

- 최소 2종 plugin 예제가 sandbox 경로로 렌더된다.
- plugin instance row와 canvas placement가 reload 이후에도 안정적으로 복원된다.
- plugin은 선언된 bridge capability 밖 host API를 호출할 수 없다.
- plugin load failure가 문서 전체 failure가 되지 않는다.
- plugin instance props/binding validation이 표준 에러 계약을 따른다.
- missing plugin 상태에서도 placeholder fallback이 동일 instance identity를 유지한다.
