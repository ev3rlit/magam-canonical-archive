# Quickstart: Action Routing Bridge

## 목적

`Action Routing Bridge` 구현이 끝난 뒤, 네 UI surface가 같은 routing 경로를 사용하고 gating/normalization/optimistic rollback이 의도대로 동작하는지 빠르게 검증한다.

## 사전 조건

- feature branch: `001-action-routing-bridge`
- `app/features/editing/actionRoutingBridge/` 모듈과 surface 연동 코드가 반영되어 있어야 한다.
- `canonical-mutation-query-core`, `selection-context-resolver`, `ui-runtime-state` 연계 계약이 구현 경로에 연결되어 있어야 한다.

## 자동 검증

### 1. Bridge 모듈 계약 검증

```bash
bun test \
  app/features/editing/actionRoutingBridge/routeIntent.test.ts \
  app/features/editing/actionRoutingBridge/registry.test.ts \
  app/features/editing/actionRoutingBridge/optimistic.test.ts
```

기대 결과:

- `UIIntentEnvelope` 검증 실패가 명시적 오류로 반환된다.
- `IntentRegistryEntry`가 canonical metadata 기반 gating만 사용한다.
- `OrderedDispatchPlan`이 빈 step 없이 생성된다.

### 2. UI surface 채택 검증

```bash
bun test \
  app/components/GraphCanvas.test.tsx \
  app/components/editor/WorkspaceClient.test.tsx \
  app/ws/methods.test.ts
```

기대 결과:

- `toolbar`, `selection-floating-menu`, `pane-context-menu`, `node-context-menu` 대표 intent가 bridge 경유로만 실행된다.
- surface 테스트에서 direct mutation/query 호출 fallback이 남아 있지 않다.
- `routeIntent`가 만든 create/rename descriptor가 기존 `node.create`/`node.update` RPC shape와 호환된다.

### 3. WS 및 rollback 검증

```bash
bun test \
  app/ws/methods.test.ts \
  app/ws/filePatcher.test.ts \
  app/store/graph.test.ts \
  app/hooks/useFileSync.test.ts
```

기대 결과:

- 미등록 intent, invalid payload, optimistic conflict가 canonical 오류 코드로 노출된다.
- pending state와 rollback 경로가 누락 없이 정리된다.

## 수동 검증

### 시나리오 1. Toolbar create

1. 빈 canvas에서 toolbar create action을 실행한다.
2. bridge가 `object.create` + `canvas-node.create` ordered dispatch plan을 구성하는지 확인한다.
3. UI가 직접 mutation 경로를 만들지 않는지 확인한다.

### 시나리오 2. Selection floating menu style edit

1. single selection 또는 homogeneous multi-selection을 만든다.
2. floating menu에서 style/content edit intent를 실행한다.
3. gating 결과가 canonical metadata와 selection context 기준으로 일관된지 확인한다.

### 시나리오 3. Pane context menu create

1. 빈 canvas 영역에서 pane context menu를 연다.
2. 생성 intent가 bridge registry를 통해 canonical payload로 정규화되는지 확인한다.
3. optimistic pending이 필요한 경우 pending key와 baseVersion이 기록되는지 확인한다.

### 시나리오 4. Node context menu rename or add child

1. node를 선택한 뒤 context menu에서 rename 또는 add child를 실행한다.
2. rename은 `object.update-core` 또는 `object.update-content`, add child는 relation 포함 ordered dispatch plan으로 구성되는지 확인한다.
3. 실패 시 오류가 성공 모양으로 변환되지 않고 그대로 surface에 전달되는지 확인한다.

### 시나리오 5. Failure and rollback

1. 미등록 intent 또는 invalid capability payload를 강제로 발생시킨다.
2. bridge가 `INTENT_NOT_REGISTERED` 또는 canonical validation 오류를 명시적으로 반환하는지 확인한다.
3. optimistic path였다면 rollback step이 실행되고 pending state가 제거되는지 확인한다.

## 완료 판정

- 네 UI surface의 대표 intent가 모두 bridge 단일 경로로 실행된다.
- direct mutation/query fallback이 남아 있지 않다.
- gating과 payload normalization 결과가 surface 간 의미적으로 일관된다.
- optimistic conflict/validation failure/미등록 intent가 모두 명시적 오류와 rollback 경로를 유지한다.
- 현재 코드베이스에서 selection-floating-menu 역할은 `StickerInspector`와 text edit commit path가 bridge surface로 대체한다.
