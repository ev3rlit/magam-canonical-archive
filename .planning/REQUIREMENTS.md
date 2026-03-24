# Requirements: Magam 1.0

**Defined:** 2026-03-19
**Core Value:** AI and humans can reliably create, review, and evolve a shared knowledge canvas through the same canonical mutation backbone.

## v1 Requirements

### Workspace and Canvas Core

- [ ] **AUTH-01**: User can create, open, and switch database-backed workspaces and documents through the primary app flow
- [ ] **AUTH-02**: User can pan and zoom the canvas smoothly with mouse, trackpad, and keyboard shortcuts
- [ ] **AUTH-03**: User can marquee-select, multi-select, and deselect objects predictably on the canvas
- [ ] **AUTH-04**: User can drag selected objects directly on the canvas, including multi-selection movement
- [ ] **AUTH-05**: User can resize and rotate selected objects through visible handles
- [ ] **AUTH-06**: User can use core keyboard shortcuts for delete, duplicate, copy/paste, undo/redo, select all, zoom, and grouping
- [ ] **AUTH-07**: User can group and ungroup objects and preserve basic z-order behavior

### Shapes and Interaction Surfaces

- [ ] **SHAP-01**: User can create rectangle, ellipse, diamond, text, arrow/line, and sticky objects from the primary creation flow
- [ ] **SHAP-02**: User can quick-edit object style and geometry through toolbar, floating actions, or contextual actions without opening a hidden inspector-first flow
- [ ] **SHAP-03**: User can use a Miro-style context menu for selected objects as a primary productivity surface
- [ ] **SHAP-04**: User can complete the core authoring loop on both desktop and mobile shells with the same canonical editing truth

### Object Content and Block Body

- [x] **BODY-01**: Every object exposes an editable content surface instead of behaving like a fixed visual shell only
- [x] **BODY-02**: User can write markdown inside an object's content area as the default text authoring mode
- [ ] **BODY-03**: User can compose multiple ordered markdown blocks inside a single object similar to a Notion-style block body
- [ ] **BODY-04**: User can place image, chart, and table blocks inside the same object body alongside markdown blocks
- [ ] **BODY-05**: Shape shell editing and object body editing can be entered and exited without conflicting with canvas selection behavior
- [ ] **BODY-06**: The object body model can host future sandboxed interactive blocks built from `html`, `css`, and `javascript` without breaking canonical contracts

### Agent Handoff and Proposal Flow

- [ ] **AGENT-01**: User can send the active document or current selection from mobile or web to a personal agent host
- [ ] **AGENT-02**: Personal agent host can execute user-owned AI tooling without routing through a provider proxy controlled by Magam
- [ ] **AGENT-03**: AI output returns as canonical mutation proposals instead of direct file overwrites or raw AST patches
- [ ] **PROP-01**: User can inspect a dry-run mutation proposal before it changes the document
- [ ] **PROP-02**: User can approve or reject a proposal from desktop or mobile
- [ ] **PROP-03**: Approved proposals append document revisions with provenance
- [ ] **RELI-01**: External agent jobs survive reconnects, queueing, and resume flows without losing proposal state
- [ ] **RELI-02**: Host, sync, and proposal failures surface actionable timeout, offline, and retry states

### Delivery and 1.0 Hardening

- [ ] **PROP-04**: User can compare, audit, and roll back document revisions in the 1.0 path
- [ ] **DELV-01**: User can open read-only or review links for a document
- [ ] **DELV-02**: User can import or export document, JSON, PNG, or SVG formats reliably from the canonical data path
- [ ] **DELV-03**: At least two sandboxed plugin or widget types work at production quality without becoming the source of truth for document data

## v2 Requirements

### Collaboration Expansion

- **COLL-01**: User can see lightweight presence on a shared document
- **COLL-02**: User can participate in a controlled realtime pilot for shared documents
- **COLL-03**: Team can migrate legacy TSX documents into the canonical DB workflow without manual rebuilds

## Out of Scope

| Feature | Reason |
|---------|--------|
| Provider proxy SaaS | Product direction is BYO agent runtime rather than hosted model mediation |
| In-app AI chat and session UI | Proposal review and approval is the intended AI surface |
| File-first `.tsx` editing as primary truth | Canonical DB path is the committed product direction |
| Full realtime multiplayer before 1.0 | Deferred until the core authoring and approval loop is stable |
| Plugin marketplace | Productization of the plugin ecosystem is outside the current 1.0 path |
| Enterprise permission matrix | Not required to validate the core product loop |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| SHAP-01 | Phase 1 | Pending |
| SHAP-02 | Phase 1 | Pending |
| SHAP-03 | Phase 1 | Pending |
| SHAP-04 | Phase 1 | Pending |
| BODY-01 | Phase 1 | Complete |
| BODY-02 | Phase 1 | Complete |
| BODY-03 | Phase 2 | Pending |
| BODY-04 | Phase 2 | Pending |
| BODY-05 | Phase 2 | Pending |
| BODY-06 | Phase 3 | Pending |
| AGENT-01 | Phase 2 | Pending |
| AGENT-02 | Phase 2 | Pending |
| AGENT-03 | Phase 2 | Pending |
| PROP-01 | Phase 2 | Pending |
| PROP-02 | Phase 2 | Pending |
| PROP-03 | Phase 2 | Pending |
| RELI-01 | Phase 2 | Pending |
| RELI-02 | Phase 2 | Pending |
| PROP-04 | Phase 3 | Pending |
| DELV-01 | Phase 3 | Pending |
| DELV-02 | Phase 3 | Pending |
| DELV-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-20 after Phase 01 shape body-entry gap closure*
