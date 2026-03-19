---
phase: 01
slug: canvas-core-authoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 01 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test + Vitest + Playwright |
| **Config file** | `playwright.config.ts`; Bun test uses workspace defaults |
| **Quick run command** | `bun test app/features/editing app/store app/components` |
| **Full suite command** | `bun test && bun run test:e2e` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test app/features/editing app/store app/components`
- **After every plan wave:** Run `bun test`
- **Before `$gsd-verify-work`:** `bun test && bun run test:e2e`
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01 | integration | `bun test app/components/editor app/store` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | AUTH-02, AUTH-03, AUTH-04, AUTH-05 | unit + e2e | `bun test app/features/editing app/store && bun run test:e2e --grep "canvas"` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | SHAP-01, SHAP-02 | integration | `bun test app/features/editing app/components && bun run test:e2e --grep "create"` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | AUTH-06, SHAP-02, SHAP-03 | unit + integration | `bun test app/processes/canvas-runtime app/components/editor` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 2 | AUTH-07, AUTH-03, AUTH-04 | integration + e2e | `bun test app/store app/components && bun run test:e2e --grep "group"` | ❌ W0 | ⬜ pending |
| 01-06-01 | 06 | 2 | BODY-01, BODY-02, SHAP-04 | unit + e2e | `bun test app/components/nodes app/store && bun run test:e2e --grep "markdown"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Wave 0 Requirements

- [ ] `app/features/editing/*.test.ts` - command, create-default, and editability regression tests for Phase 1 behaviors
- [ ] `app/store/graph*.test.ts` - selection, text-edit, entrypoint-runtime, and undo/redo state tests for authoring flows
- [ ] `app/components/editor/*.test.tsx` - entry and shell/body interaction tests
- [ ] `e2e/canvas-core-authoring.spec.ts` - end-to-end Phase 1 authoring loop coverage

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop direct-manipulation feel matches the Excalidraw-fast target | AUTH-02, AUTH-03, AUTH-04, AUTH-05 | Perceived latency and motion tuning still need a human pass | Run the app, open a document, pan/zoom, marquee-select, drag, resize, and rotate several objects; confirm motion feels light and predictable |
| Mobile shell makes mode transitions explicit without changing canonical behavior | SHAP-04 | Mobile affordance clarity is partially subjective | Open the same document on a narrow/mobile viewport and confirm create, selection, group entry, and body-edit transitions remain understandable |
| Floating actions stay compact while context menu owns lower-frequency actions | SHAP-02, SHAP-03 | Surface hierarchy quality is easier to judge manually | Select single and multi-object cases, verify floating actions stay compact and context menu carries structural actions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
