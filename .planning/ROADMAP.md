# Roadmap: Magam

## Overview

Magam already has the render, canonical persistence, CLI, and plugin foundations needed for a database-first canvas product. This roadmap turns that brownfield base into a 1.0 experience by first opening a usable BYO agent handoff and proposal path, then converging the primary authoring loop on the canonical DB-backed flow, then hardening the surrounding revision, sharing, import and export, and plugin surfaces into a stable release.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions if scope must land between milestone phases

- [ ] **Phase 1: Agent Handoff Baseline** - Open the first usable share-to-host-to-proposal path
- [ ] **Phase 2: Canonical Authoring Beta** - Make DB-backed authoring the primary product loop
- [ ] **Phase 3: Magam 1.0 Fast Path** - Polish the core loop into a stable 1.0 release

## Phase Details

### Phase 1: Agent Handoff Baseline
**Goal**: Open a usable BYO Agent Runtime flow from mobile or web handoff to approved canonical mutation proposals.
**Depends on**: Nothing (first phase)
**Requirements**: [AGENT-01, AGENT-02, AGENT-03, PROP-01, PROP-02, PROP-03, RELI-02]
**Success Criteria** (what must be TRUE):
  1. User can send the active document or selection to a personal agent host from mobile or web share surfaces
  2. Agent output appears as a reviewable canonical mutation proposal instead of editing source files directly
  3. User can approve or reject a proposal and see approved changes appended as a new document revision
  4. Timeout, offline, and retry failures surface clearly enough to recover without corrupting document state
**Plans**: 4 plans

Plans:
- [ ] 01-01: Personal agent host contract and transport
- [ ] 01-02: Mobile and web share handoff envelope
- [ ] 01-03: Canonical mutation proposal review, approval, and provenance append
- [ ] 01-04: Minimal reliability for timeout, retry, and offline handling

### Phase 2: Canonical Authoring Beta
**Goal**: Make canonical DB-backed workspace, document, and canvas authoring the primary UX and replace in-app AI chat with external proposal surfaces.
**Depends on**: Phase 1
**Requirements**: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, RELI-01]
**Success Criteria** (what must be TRUE):
  1. User can create, open, and switch DB-backed workspaces and documents as the normal app flow
  2. User can complete the core object editing loop on canvas across desktop and mobile without falling back to file-first paths
  3. User can review external proposals in a real work queue while reconnect and resume behavior preserves state
  4. In-app AI chat and session entrypoints are gone, and key actions are reachable through command or contextual surfaces
  5. Mixed block bodies inside a single object support a product-usable first version of text, markdown, chart, and table composition
**Plans**: 7 plans

Plans:
- [ ] 02-01: Workspace, document, and canvas authoring convergence
- [ ] 02-02: External proposal console and review queue
- [ ] 02-03: Host reliability, reconnect, and resume
- [ ] 02-04: Mobile full editing shell
- [ ] 02-05: Canonical app open and save convergence
- [ ] 02-06: In-app AI chat removal and command surface minimum
- [ ] 02-07: Composable block body v1

### Phase 3: Magam 1.0 Fast Path
**Goal**: Polish the beta foundation into a stable 1.0 release with revision hardening, sharing, delivery reliability, and plugin minimum.
**Depends on**: Phase 2
**Requirements**: [PROP-04, AUTH-06, DELV-01, DELV-02, DELV-03]
**Success Criteria** (what must be TRUE):
  1. User can compare, audit, and roll back revisions created by direct editing or approved AI proposals
  2. Desktop and mobile authoring flows feel stable enough for daily use at 1.0 quality
  3. User can open read-only or review links and move documents through import and export flows without losing canonical fidelity
  4. At least two production-ready plugin or widget types run safely inside the plugin runtime
  5. Composable block bodies feel integrated into normal authoring instead of experimental
**Plans**: 7 plans

Plans:
- [ ] 03-01: Revision and approval backbone hardening
- [ ] 03-02: Desktop authoring UX convergence
- [ ] 03-03: Mobile full editing polish
- [ ] 03-04: Share and review links
- [ ] 03-05: Plugin runtime productization minimum
- [ ] 03-06: Import and export reliability
- [ ] 03-07: Composable block body v2

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Agent Handoff Baseline | 0/4 | Not started | - |
| 2. Canonical Authoring Beta | 0/7 | Not started | - |
| 3. Magam 1.0 Fast Path | 0/7 | Not started | - |
