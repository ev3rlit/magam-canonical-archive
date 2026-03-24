# Design System Document: The Precision Canvas

## 1. Overview & Creative North Star

**Creative North Star: "The Ethereal Workspace"**

This design system moves away from the "boxy" utility of traditional SaaS and toward a high-end, editorial environment for ideation. The philosophy is rooted in **Ethereal Minimalism**: the interface should feel like a light-filled studio—spacious, quiet, and unobtrusive—where the user's content is the only thing with true "weight."

By leveraging a hierarchy of tonal whites and "frosted" surfaces, we break the "template" look. We favor intentional asymmetry in toolbars and floating panels that appear to hover over an infinite, breathing grid, rather than being anchored to rigid, high-contrast borders.

---

## 2. Colors & Surface Logic

The palette is a sophisticated range of architectural grays and whites, punctuated by a high-energy "Electric Violet" (`primary`) to denote action and presence.

### The "No-Line" Rule

**Standard 1px solid borders are strictly prohibited for sectioning.**
To define the relationship between a sidebar and the canvas, or a toolbar and its background, use background color shifts.

- **Canvas:** `surface` (#f5f6f7)
- **Floating Panels:** `surface_container_lowest` (#ffffff) sitting on `surface` creates a natural, soft distinction.
- **Contextual Sidebars:** Use `surface_container_low` (#eff1f2) to recede the UI and let the canvas breathe.

### Surface Hierarchy & Nesting

Treat the UI as a series of physical layers.

- **Level 0 (The Base):** `surface` or `background`.
- **Level 1 (The Work Area):** `surface_container` for persistent utility zones.
- **Level 2 (The Tool):** `surface_container_highest` for active selection states or pop-overs.

### The "Glass & Gradient" Rule

Floating toolbars and contextual menus must utilize **Glassmorphism**. Use `surface_container_lowest` at 80% opacity with a `24px` backdrop-blur. For primary actions, apply a subtle linear gradient from `primary` (#453bed) to `primary_container` (#9695ff) at a 135° angle to give buttons a "jewel-like" depth.

---

## 3. Typography

The system utilizes a dual-sans-serif pairing to balance high-end editorial flair with functional density.

- **Display & Headlines (Manrope):** Chosen for its geometric precision and modern "tech-boutique" feel. Use `display-md` for empty state headers and `headline-sm` for major panel titles.
- **Body & UI (Inter):** The workhorse. Inter’s tall x-height ensures maximum readability at small sizes (`body-sm`) within dense property inspectors or canvas labels.

**Hierarchy as Identity:**

- **Primary Actions:** `title-sm` (Inter, Medium weight) in `on_primary`.
- **Secondary Metadata:** `label-md` (Inter, Regular) in `on_surface_variant` (#595c5d).
- **Branding/Hero Moments:** `display-sm` (Manrope, Extra Bold) with tight letter-spacing (-0.02em).

---

## 4. Elevation & Depth

Depth is achieved through **Tonal Layering** and physics-based light simulation, not structural lines.

- **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container_low` background. The slight shift in brightness provides all the separation necessary for a premium feel.
- **Ambient Shadows:** For floating elements (like a central tool dock), use a "Sunlight Shadow":
- `Y: 8px, Blur: 32px, Color: rgba(44, 47, 48, 0.06)` (A tinted version of `on_surface`).
- **The "Ghost Border" Fallback:** If high-density content requires a container (e.g., a color picker), use the `outline_variant` (#abadae) at **15% opacity**. It should be felt, not seen.
- **Interaction States:** When an object on the canvas is selected, do not just thicken the border. Use a 2px outer glow of `primary_container` to make it appear "energized."

---

## 5. Components

### The Tool Dock (Primary Toolbar)

- **Structure:** A floating `full` rounded pill.
- **Surface:** `surface_container_lowest` (80% opacity) + Backdrop Blur.
- **Interaction:** Active tools use the `primary` color for the icon, with a `surface_container_high` circular background.

### Buttons

- **Primary:** Gradient fill (`primary` to `primary_container`), `xl` (0.75rem) roundedness. No border.
- **Secondary:** `surface_container_highest` fill with `on_surface` text.
- **Tertiary/Ghost:** No fill. `primary` text. Use for low-emphasis canvas actions.

### Input Fields

- **Style:** Minimalist. No bottom line or full border. Use `surface_container_low` as a solid fill with `sm` (0.125rem) roundedness.
- **Focus:** Transition background to `surface_container_lowest` and add a `primary` 1px Ghost Border.

### Contextual Menus & Lists

- **Cards/Lists:** **Forbid divider lines.** Separate list items using `spacing-2` (0.4rem) of vertical whitespace.
- **Hover State:** Use `surface_container_high` with an `md` (0.375rem) corner radius to highlight the entire row.

### Canvas Elements (Sticky Notes/Shapes)

- **Depth:** Use `surface_container_lowest` for a paper-like feel.
- **Shadow:** Large, soft `surface_dim` tint to suggest they are hovering just millimeters above the grid.

---

## 6. Do's and Don'ts

### Do

- **DO** use `spacing-16` and `spacing-20` for canvas margins to emphasize the "Infinite" feel.
- **DO** use `surface_bright` for the canvas background when the user is in "Focus Mode."
- **DO** pair `display-sm` (Manrope) with `body-md` (Inter) for a sophisticated contrast in onboarding screens.

### Don't

- **DON'T** use #000000 for text. Always use `on_surface` (#2c2f30) to maintain the soft, architectural aesthetic.
- **DON'T** use 1px solid borders to separate the sidebar from the canvas. Use a background tint of `surface_container_low`.
- **DON'T** use standard "drop shadows." Use wide, low-opacity ambient blurs tinted with the `on_surface` color.
- **DON'T** crowd the interface. If a panel isn't needed, use a "Fade & Slide" transition to hide it into the `surface_dim` edge.
