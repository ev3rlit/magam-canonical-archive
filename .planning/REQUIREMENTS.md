# Requirements: Magam 1.0

**Defined:** 2026-03-19
**Core Value:** AI and humans can reliably create, review, and evolve a shared knowledge canvas through the same canonical mutation backbone.

## v1 Requirements

### Agent Handoff

- [ ] **AGENT-01**: User can send the active document or current selection from mobile or web to a personal agent host
- [ ] **AGENT-02**: Personal agent host can execute user-owned AI tooling without routing through a provider proxy controlled by Magam
- [ ] **AGENT-03**: AI output returns as canonical mutation proposals instead of direct file overwrites or raw AST patches

### Proposal and Revision

- [ ] **PROP-01**: User can inspect a dry-run mutation proposal before it changes the document
- [ ] **PROP-02**: User can approve or reject a proposal from desktop or mobile
- [ ] **PROP-03**: Approved proposals append document revisions with provenance
- [ ] **PROP-04**: User can compare, audit, and roll back document revisions in the 1.0 path

### Authoring Core

- [ ] **AUTH-01**: User can create, open, and switch database-backed workspaces and documents through the primary app flow
- [ ] **AUTH-02**: User can create, select, move, edit, and delete canvas objects through the canonical DB path
- [ ] **AUTH-03**: User can complete the core authoring loop on both desktop and mobile shells
- [ ] **AUTH-04**: User can edit ordered block bodies inside a single object with mixed content such as text, markdown, chart, and table blocks
- [ ] **AUTH-05**: User can reach key canvas actions through toolbar, context menu, floating selection menu, or command surface without depending on an in-app AI chat entrypoint
- [ ] **AUTH-06**: User can use composable block bodies at 1.0 quality as part of normal object editing flows

### Reliability and Delivery

- [ ] **RELI-01**: External agent jobs survive reconnects, queueing, and resume flows without losing proposal state
- [ ] **RELI-02**: Host, sync, and proposal failures surface actionable timeout, offline, and retry states
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
| AGENT-01 | Phase 1 | Pending |
| AGENT-02 | Phase 1 | Pending |
| AGENT-03 | Phase 1 | Pending |
| PROP-01 | Phase 1 | Pending |
| PROP-02 | Phase 1 | Pending |
| PROP-03 | Phase 1 | Pending |
| RELI-02 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| RELI-01 | Phase 2 | Pending |
| PROP-04 | Phase 3 | Pending |
| AUTH-06 | Phase 3 | Pending |
| DELV-01 | Phase 3 | Pending |
| DELV-02 | Phase 3 | Pending |
| DELV-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after initial definition*
