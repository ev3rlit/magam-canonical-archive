# Contract: Dispatch Orchestration

## 목적

단일/복합 intent의 실행 순서와 실패 처리 정책을 통일한다.

## Canonical Recipes

- `toolbar.create`: `object.create` -> `canvas-node.create`
- `pane.create`: `object.create` -> `canvas-node.create`
- `node.add-child`: `object.create` -> `object-relation.create` -> `canvas-node.create`
- `selection.style-update`: `object.patch-capability` 또는 `object.update-content`
- `node.rename`: `object.update-core` 또는 `object.update-content`

## Rules

1. 복합 recipe는 선언된 step 순서를 지켜야 한다.
2. step 실패 시 기본 정책은 즉시 중단(`stop`)이다.
3. 실패 응답에는 실패 step action 이름과 intent를 포함한다.
4. surface는 step 조립을 직접 수행하면 안 되며 bridge recipe를 사용한다.
5. runtime-only intent는 mutation step과 분리 실행한다.

## Failure Contract

- recipe 미정의: `INVALID_INTENT`
- 중간 step 실패: `EXECUTION_FAILED`
