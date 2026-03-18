# Contract: Normalization and Gating

## 목적

UI payload를 canonical executor 입력으로 정규화하고, semantic/capability 기반으로 실행 가능성을 검증한다.

## Normalization Inputs

- `resolvedContext.target`
- `resolvedContext.metadata.semanticRole`
- `resolvedContext.metadata.primaryContentKind`
- `uiPayload`

## Gating Inputs

- `editability.canMutate`
- `editability.allowedCommands`
- `semanticRole`
- `primaryContentKind`
- capability summary

## Rules

1. canonical id/reference를 해석할 수 없으면 실행하지 않는다.
2. 게이팅 기준은 renderer alias가 아니라 semantic/capability metadata다.
3. capability 허용 surface를 벗어난 patch는 거부한다.
4. content-kind와 맞지 않는 payload는 거부한다.
5. 거부 시 surface/intent를 포함한 오류를 반환한다.

## Failure Contract

- canonical id 해석 실패: `NORMALIZATION_FAILED`
- editability 차단: `GATE_BLOCKED`
- patch surface 위반: `PATCH_SURFACE_VIOLATION`
