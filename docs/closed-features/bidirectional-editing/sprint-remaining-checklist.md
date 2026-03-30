# Bidirectional Editing Remaining Sprint Checklist

Updated: 2026-02-17

## Ticket Status

- [x] **BIDI-013** node.update expansion (anchor/markdown/id) + edge ref updates on id change — **done**
- [x] **BIDI-014** node.create — **done**
- [x] **BIDI-015** node.reparent + cycle detection (40902) — **done**
- [x] **BIDI-020** conflict handling + rollback UX — **done**
- [x] **BIDI-021** self-origin loop prevention hardening across relevant paths — **done**
- [x] **BIDI-022** patcher unit tests for update/create/reparent/cycle — **done**
- [x] **BIDI-023** integration tests for RPC→save→notify→rerender — **done**
- [x] **BIDI-024** manual QA checklist doc + results template — **done**

## Notes / Blockers

- TypeScript workspace has pre-existing unrelated errors outside bidirectional editing scope; targeted Bun tests for changed areas pass.
