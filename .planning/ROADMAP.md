# Roadmap: Magam

## Overview

Magam already has the render, canonical persistence, CLI, and plugin foundations needed for a database-first canvas product. This roadmap now prioritizes the core canvas authoring loop first, so the product behaves like a credible Excalidraw-grade canvas with Miro-style contextual actions before the external agent handoff and proposal layers become the next major focus. After that baseline is strong, the roadmap hardens revision, sharing, import/export, and plugin surfaces into a stable 1.0 release.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions if scope must land between milestone phases

- [ ] **Phase 1: Canvas Core Authoring** - Make the canonical canvas loop feel like a real product
- [ ] **Phase 2: External Agent and Block Body Beta** - Layer agent handoff and richer object bodies on top of the canvas core
- [ ] **Phase 3: Magam 1.0 Fast Path** - Polish the core loop into a stable 1.0 release

## Phase Details

### Phase 1: Canvas Core Authoring
**Goal**: Make the database-backed canvas authoring loop feel fast, legible, and complete enough to stand beside Excalidraw-style core manipulation while using Miro-style contextual actions for selected objects.
**Depends on**: Nothing (first phase)
**Requirements**: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, SHAP-01, SHAP-02, SHAP-03, SHAP-04, BODY-01, BODY-02]
**Success Criteria** (what must be TRUE):
  1. User can create or open a document and immediately pan, zoom, select, drag, resize, rotate, and group objects through a smooth primary flow
  2. User can create rectangle, ellipse, diamond, text, arrow/line, and sticky objects and edit them through toolbar, floating actions, and a Miro-style context menu
  3. User can use keyboard shortcuts for the high-frequency canvas actions without breaking selection or editing state
  4. Every object exposes an editable content surface with markdown as the default body entry point
  5. Desktop and mobile share the same canonical editing truth even if shell-level UI differs
**Plans**: 8 plans

Plans:
- [x] 01-01-PLAN.md — Workspace and document canvas entry convergence
- [x] 01-02-PLAN.md — Viewport, selection, drag, resize, and rotate baseline
- [x] 01-03-PLAN.md — Minimal shape set and creation flows
- [x] 01-04-PLAN.md — Context menu, floating actions, and keyboard shortcuts
- [x] 01-05-PLAN.md — Grouping, z-order, and multi-selection behavior
- [x] 01-06-PLAN.md — Editable object content surface and markdown-first body entry
- [x] 01-07-PLAN.md — Untitled document materialization and first-create contract alignment
- [ ] 01-08-PLAN.md — Selection anchor-space alignment and fresh-group structural continuity

### Phase 2: External Agent and Block Body Beta
**Goal**: Add BYO agent handoff, proposal review, and richer Notion-style object block bodies on top of the stabilized canvas core.
**Depends on**: Phase 1
**Requirements**: [BODY-03, BODY-04, BODY-05, AGENT-01, AGENT-02, AGENT-03, PROP-01, PROP-02, PROP-03, RELI-01, RELI-02]
**Success Criteria** (what must be TRUE):
  1. User can send the active document or current selection to a personal agent host and receive a canonical mutation proposal back
  2. User can review, approve, or reject proposals from desktop or mobile without falling back to file patches
  3. Rich object bodies support multiple ordered markdown blocks plus image, chart, and table blocks inside the same object
  4. Shape-shell editing and body-block editing feel like one coherent object editing model
  5. Queueing, reconnect, resume, timeout, and retry behavior keep proposal state recoverable
**Plans**: 7 plans

Plans:
- [ ] 02-01: Personal agent host contract and handoff transport
- [ ] 02-02: External proposal console and review queue
- [ ] 02-03: Canonical mutation proposal approval and provenance append
- [ ] 02-04: Host reliability, reconnect, queue, and resume
- [ ] 02-05: Multi-block markdown body composition
- [ ] 02-06: Typed content blocks for image, chart, and table
- [ ] 02-07: Mobile and desktop parity for proposal and body editing flows

### Phase 3: Magam 1.0 Fast Path
**Goal**: Polish the beta foundation into a stable 1.0 release with revision hardening, sharing, delivery reliability, plugin minimum, and forward-compatible interactive object bodies.
**Depends on**: Phase 2
**Requirements**: [BODY-06, PROP-04, DELV-01, DELV-02, DELV-03]
**Success Criteria** (what must be TRUE):
  1. User can compare, audit, and roll back revisions created by direct editing or approved AI proposals
  2. Desktop and mobile authoring flows feel stable enough for daily use at 1.0 quality
  3. User can open read-only or review links and move documents through import and export flows without losing canonical fidelity
  4. At least two production-ready plugin or widget types run safely inside the plugin runtime
  5. The object body model is ready to host future sandboxed interactive `html`/`css`/`javascript` blocks without reworking the core canvas contract
**Plans**: 7 plans

Plans:
- [ ] 03-01: Revision and approval backbone hardening
- [ ] 03-02: Desktop authoring UX convergence
- [ ] 03-03: Mobile full editing polish
- [ ] 03-04: Share and review links
- [ ] 03-05: Plugin runtime productization minimum
- [ ] 03-06: Import and export reliability
- [ ] 03-07: Interactive object body runtime contract

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Canvas Core Authoring | 7/8 | In progress | - |
| 2. External Agent and Block Body Beta | 0/7 | Not started | - |
| 3. Magam 1.0 Fast Path | 0/7 | Not started | - |
