# Data Model: Workspace `className` Runtime

## Entity: WorkspaceStyleInput

- Purpose: Workspace source에서 추출한 raw style 입력.
- Fields:
  - `objectId` (string, required): Target canvas object identifier.
  - `className` (string, required): Raw class input string.
  - `sourceRevision` (string, required): Workspace revision marker.
  - `timestamp` (number, required): Extraction timestamp.
- Validation:
  - `objectId` must resolve to a rendered object.
  - `className` may be empty only for style reset semantics.

## Entity: EligibleObjectProfile

- Purpose: 현재 object가 runtime class 적용 대상인지 capability 기준으로 판정.
- Fields:
  - `objectId` (string, required)
  - `hasClassNameSurface` (boolean, required)
  - `supportsStylingProps` (boolean, required)
  - `supportsSizeProps` (boolean, required)
  - `isEligible` (boolean, required)
  - `reasonIfIneligible` (string, optional)
- Validation:
  - `isEligible=true` requires `hasClassNameSurface=true`.
  - `isEligible=false` requires `reasonIfIneligible`.

## Entity: ClassCategoryDefinition

- Purpose: v1 지원 class category와 우선순위를 정의.
- Fields:
  - `category` (enum, required): `size | basic-visual | shadow-elevation | outline-emphasis`
  - `priority` (number, required): deterministic apply ordering.
  - `status` (enum, required): `supported | planned | unsupported`
  - `tokenPatterns` (string[], required): category에 포함되는 패턴 표현.
- Validation:
  - All supported categories must have unique `priority`.
  - v1 must include all four mandatory priority categories.

## Entity: InterpretedStyleResult

- Purpose: class 입력 해석의 정규화 결과.
- Fields:
  - `objectId` (string, required)
  - `appliedCategories` (string[], required)
  - `appliedTokens` (string[], required)
  - `ignoredTokens` (string[], required)
  - `resolvedStylePayload` (object, optional)
  - `status` (enum, required): `applied | partial | reset | unsupported`
- Validation:
  - `status=applied` requires one or more `appliedTokens`.
  - `status=unsupported` requires zero `appliedTokens`.
  - `status=partial` requires both applied and ignored token sets.

## Entity: StylingDiagnostic

- Purpose: 지원 범위 밖 입력 또는 stale update를 설명하는 사용자/개발자 진단.
- Fields:
  - `objectId` (string, required)
  - `code` (enum, required): `OUT_OF_SCOPE_OBJECT | UNSUPPORTED_CATEGORY | UNSUPPORTED_TOKEN | MIXED_INPUT | STALE_UPDATE`
  - `message` (string, required)
  - `token` (string, optional)
  - `category` (string, optional)
  - `severity` (enum, required): `info | warning | error`
  - `revision` (string, required)
- Validation:
  - Diagnostics must reference current or immediately previous revision.

## Entity: StyleUpdateSession

- Purpose: session 내 업데이트 freshness와 ordering 추적.
- Fields:
  - `sessionId` (string, required)
  - `objectId` (string, required)
  - `latestAcceptedRevision` (string, required)
  - `lastAppliedAt` (number, required)
  - `updateCount` (number, required)
- Validation:
  - Updates older than `latestAcceptedRevision` must be handled as stale.

## Entity: BootstrapCoexistenceState

- Purpose: runtime styling 도입 중 safelist/bootstrap 경로 공존 상태 추적.
- Fields:
  - `runtimeStylingEnabled` (boolean, required)
  - `safelistGenerationEnabled` (boolean, required)
  - `bootstrapCheckPassed` (boolean, required)
  - `checkedAt` (number, required)
- Validation:
  - When runtime styling is enabled in rollout phase, safelist generation must remain enabled.

## Relationships

- `WorkspaceStyleInput` + `EligibleObjectProfile` + `ClassCategoryDefinition` -> `InterpretedStyleResult`
- `InterpretedStyleResult` -> optional `StylingDiagnostic`
- `StyleUpdateSession` governs freshness when applying `InterpretedStyleResult`
- `BootstrapCoexistenceState` validates rollout safety for dev bootstrap path

## State transitions

- input extracted -> eligibility resolved -> category classification -> interpretation -> apply/diagnose
- applied/partial updates advance `latestAcceptedRevision`
- reset clears previously applied payload for object
- stale update emits `StylingDiagnostic(code=STALE_UPDATE)` without overriding latest state
- rollout check validates runtime path + safelist path coexistence before release gate
