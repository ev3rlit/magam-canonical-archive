# Contract: Surface Adoption

## 목적

4개 entrypoint surface가 bridge-only write path를 사용하도록 강제한다.

## 대상 Surface

- `canvas-toolbar`
- `selection-floating-menu`
- `pane-context-menu`
- `node-context-menu`

## Rules

1. surface는 direct mutation executor 호출을 하면 안 된다.
2. surface는 bridge dispatch API를 통해서만 write intent를 실행한다.
3. surface는 실패 응답을 무시하지 않고 UI feedback으로 노출한다.
4. surface는 optimistic 상태를 자체 저장하지 않고 ui-runtime-state를 사용한다.
5. 새 intent 추가 시 surface 코드 변경보다 catalog/recipe 확장을 우선한다.

## Verification Checklist

- direct mutation import/call 검색 결과가 0건인지 확인
- representative intent(create/style/rename/add-child)가 bridge 경유인지 확인
- reject 이벤트 발생 시 pending state 정리가 동작하는지 확인

## Failure Contract

- direct write path 검출: `ADOPTION_VIOLATION`
- bridge error 무시: `ADOPTION_VIOLATION`
