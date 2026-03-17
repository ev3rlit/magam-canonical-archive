# Contract: Workspace Style Surface

## Purpose

Define eligible object rules and category support surface for workspace `className` styling in v1.

## Contract surface

- Input:
  - target object identity (`objectId`)
  - target object capability flags (className surface, styling props support, size props support)
  - raw style input (`className`)
- Output:
  - eligibility classification: `eligible | out-of-scope`
  - category support classification per token
  - reason code when out-of-scope

## Behavioral guarantees

- Eligibility is determined by capability (existing styling/size props and className surface), not hard-coded node family names.
- Same object capability profile yields same eligibility result in the same release configuration.
- Out-of-scope objects never appear as successful style application.
- Support scope is traceable through a documented category matrix.
- In the current implementation, a present `className` surface is sufficient for eligibility even when explicit styling/size props are absent.
- Objects that do not expose a `className` surface remain out of scope even if they have other visual props.

## V1 required category coverage

- `size`
- `basic-visual`
  - background, text color and size
  - font weight/family/style and tracking
  - border width/style/color and radius
  - opacity
  - padding, margin, and gap
- `shadow-elevation`
- `outline-emphasis` (including sticker-outline-like emphasis)

## Current implementation notes

- Sticky and Sticker surfaces are expected to be eligible when they expose `className`.
- WashiTape remains out of scope until it exposes a `className` surface or an equivalent runtime style input boundary.

## Out of scope

- Runtime expansion of support scope without explicit release updates
- Automatic fallback to alternate styling channels for out-of-scope objects
