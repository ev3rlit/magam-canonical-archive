This document outlines the core aesthetic and functional principles of our design system. It establishes a consistent visual language across all products, ensuring a cohesive and intuitive user experience.

## Core UX Principle

Simplicity alone is not the product goal. The primary UI value is delivering good UX in a way that feels natural to the user without requiring extra explanation, training, or exception-handling friction.

- Prefer interfaces that make the next action obvious through structure and context, not instructional copy.
- Reduce the need for users to understand system rules before they can act.
- Design defaults, editing flows, and feedback so that users can proceed confidently without being stopped by avoidable edge-case ceremony.
- When choosing between a visually simple UI and a more intuitive UX, prefer the option that better supports immediate user understanding and flow.

## Label and Descriptor Policy

Visible labels, captions, helper text, and descriptive modifiers are not decorative. They should appear only when they add decision-making value that the UI cannot already communicate through structure, contrast, preview, grouping, or placement.

- Do not add visible text that merely restates what the user can already identify at a glance from the control itself.
- If an icon, swatch, thumbnail, preview card, shape sample, border sample, status dot, alignment control, layout toggle, or mode button is already self-explanatory in context, prefer no visible suffix, adjective, or explanatory label.
- Avoid redundant modifiers such as shape adjectives, appearance narration, or visual restatements when adjacent options are already distinguishable by silhouette, color, stroke, spacing, direction, or composition.
- Prefer section labels, grouping, and ordering over repeating micro-labels on every option.
- Keep accessibility labels for non-text controls, but do not let accessibility requirements force redundant visible copy.
- Use visible text only when it resolves real ambiguity, improves searchability, prevents likely mistakes, or communicates information that is not visually inferable.
- Helper text should explain consequence, constraint, or meaning. It should not narrate the obvious.
- If removing a label does not reduce comprehension, confidence, or action accuracy, remove it.

Apply this rule broadly across option pickers, toolbars, inspectors, floating menus, cards, chips, toggles, segmented controls, and visual selectors. This is not limited to shape, color, or image UI.

### Prompt For UI Writing And Review

When designing or reviewing UI, aggressively remove redundant visible labels and descriptive modifiers. Do not add text that simply repeats what the user can already understand from the visual itself, nearby grouping, or surrounding context. Favor recognition through layout, preview, iconography, color, state, and position over explanatory copy. Keep visible labels only when they disambiguate similar options, expose non-visual meaning, improve search/scanning, or prevent a likely user mistake. Accessibility labels may remain in code, but they must not be used as justification for extra visible copy. If a user can correctly choose an option after one glance without the text, the text should usually be removed.

## Theme Overview

### Color Palette

Our color palette is built around a vivid indigo primary, complemented by a light neutral background. This combination aims for clarity, focus, and a modern canvas-first feel.

- **Primary Color:** `#5851FF` - Used for primary actions, interactive elements, and key brand accents.
- **Neutral Color:** `#F8F9FA` - Serves as the base for backgrounds, surfaces, and less prominent UI elements, providing a clean canvas.

### Typography

We employ a clear and readable typography system to enhance content legibility and visual hierarchy.

- **Headlines:** `manrope` - Chosen for its modern and approachable character, suitable for titles and prominent text.
- **Body Text:** `inter` - A highly versatile and legible sans-serif, ideal for long-form content and general UI text.
- **Labels:** `inter` - Consistent with body text for clarity and straightforward communication in interactive elements.

### Shape and Form

Our UI elements feature a subtle level of roundedness, providing a soft yet defined appearance.

- **Roundedness:** `1` (Subtle roundedness) - Edges are gently rounded to be friendly without losing crispness.

### Spacing

The design system adopts a normal, balanced approach to spacing, ensuring readability and comfortable visual flow without feeling overly dense or sparse.

- **Spacing:** `2` (Normal) - Provides ample breathing room between elements, contributing to a clean layout and easy navigation.
