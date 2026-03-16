# Contract: Patch and Editability

## 목적

patcher/editability 판단 기준을 alias/tag 이름이 아닌 capability/content 계약으로 고정한다.

## Command Gate Inputs

- `semanticRole`
- `CapabilityProfile.allowedCommands`
- `CapabilityProfile.allowedUpdateKeys`
- `content.kind`
- `readOnlyReason`

## Rules

1. `readOnlyReason`이 있으면 mutation command는 실행할 수 없다.
2. style patch는 `allowedUpdateKeys` 범위만 허용한다.
3. content patch는 `content.kind`와 carrier가 일치해야 한다.
4. declared content kind와 맞지 않는 patch field는 명시적으로 거부해야 한다.
5. legacy-inferred object와 explicit capability object는 동일 canonical gate로 검증해야 한다.
6. `Sticky` alias 객체는 일부 기본 capability가 빠져도 `sticky-note` semantic 기준으로 gate를 계산한다.
7. create/patch payload 생성은 canonical schema를 기준으로 한다.
8. server는 client gate를 신뢰하지 않고 동일 규칙으로 재검증한다.

## Canonical Gate Matrix (초안)

| Condition | Allowed Commands |
|---|---|
| `content:media` | `content.update`, `style.update` (media 허용키) |
| `content:markdown` | `content.update`, `style.update` |
| `content:sequence` | `content.update` (structured), `style.update` |
| `semanticRole=sticky-note` | `move.absolute` or `move.relative`, `style.update`, allowed `content.update` |
| `attach` only | `move.relative`, `style.update` |
| no content/no attach | `move.absolute`, `style.update` |

## Failure Contract

- 비허용 command: `EDIT_NOT_ALLOWED`
- 비허용 patch key: `PATCH_SURFACE_VIOLATION`
- content-kind mismatch: `CONTENT_CONTRACT_VIOLATION`
