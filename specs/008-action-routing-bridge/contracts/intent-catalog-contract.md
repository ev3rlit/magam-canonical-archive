# Contract: Intent Catalog

## 목적

UI surface intent를 canonical 실행 recipe로 안정적으로 매핑한다.

## Required Fields

- `surface`
- `intent`
- `intentType` (`mutation` | `query` | `runtime-only`)
- `dispatchRecipeId`
- `gatingProfile`

## Rules

1. 같은 `surface + intent` 조합은 1개 entry만 허용한다.
2. intent는 반드시 `dispatchRecipeId`를 가져야 한다.
3. `runtime-only` intent는 persistence mutation action을 포함하면 안 된다.
4. entrypoint surface는 catalog에 없는 intent를 실행하면 안 된다.
5. 새 surface action은 direct write path가 아니라 catalog entry 추가로 확장한다.

## Failure Contract

- 미등록 intent: `INVALID_INTENT`
- 유형 불일치(`runtime-only`에 mutation 포함 등): `INVALID_INTENT`
