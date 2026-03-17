# Contract: Workspace Style Interpretation

## Purpose

Define how raw workspace `className` input is interpreted into deterministic, category-based style outcomes.

## Contract surface

- Input:
  - raw `className` string
  - eligible object profile
  - class category definitions and priority
  - current workspace revision/session context
- Output:
  - applied category set
  - applied token set
  - ignored token set
  - status: `applied | partial | reset | unsupported`
  - render-consumable style payload (when applicable)
  - style payload fields may include width/height constraints, colors, typography, spacing, border/radius, opacity, outline, and composed box-shadow

## Behavioral guarantees

- Same input + same eligible profile + same category matrix yields same output.
- Empty or removed `className` yields `reset` and clears previous interpreted payload.
- Mixed supported/unsupported category input yields `partial`, not silent success.
- Out-of-scope object input yields `unsupported` with diagnostic-ready context.
- Older stale updates must not override newer accepted style state.

## V1 category requirements

- Interpretation must explicitly support:
  - size
  - basic visual styling
  - shadow/elevation
  - outline/emphasis
- Interpretation order must be deterministic and documented by category priority.

## Current implementation notes

- Arbitrary values are supported for the current priority categories when they can be mapped directly to style payload values.
- Current `basic-visual` coverage includes text sizing, font weight/family/style, tracking, padding, margin, gap, border-side width, and border style in addition to background/text color, radius, and opacity.
- Variant-prefixed tokens currently support `hover:`, `focus:`, `active:`, `group-hover:`, `dark:`, `md:`, `lg:`, `xl:`, and `2xl:` within the runtime surface.
- `hover:`, `focus:`, `active:`, and `group-hover:` tokens are emitted into dedicated interaction style layers instead of being folded into the base inline style payload.
- `group-hover:` requires a `groupId`-backed runtime group surface.
- Combined interaction tokens such as `hover:focus:*` or `hover:active:*` are diagnosed and ignored.
- Mixed input keeps supported tokens in priority order and emits diagnostics for ignored tokens.

## Out of scope

- Full compatibility with every utility syntax in v1
- Automatic semantic correction of unsupported categories or tokens
