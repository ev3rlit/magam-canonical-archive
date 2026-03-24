# Magam

## What This Is

Magam is a programmable whiteboard for AI agent collaboration. It turns structured prompts and direct manipulation into canvas documents backed by canonical objects, with desktop, mobile, CLI, and automation surfaces converging on the same mutation and query backbone. This brownfield repo is past the foundation stage and is now focused on turning the database-first canvas architecture into a stable 1.0 product.

## Core Value

AI and humans can reliably create, review, and evolve a shared knowledge canvas through the same canonical mutation backbone.

## Requirements

### Validated

- ✓ User can author diagram content in Magam and render it into an interactive browser canvas through the existing web shell — existing
- ✓ User can edit rendered canvas objects through browser UI entrypoints and local runtime services — existing
- ✓ Canonical object persistence, query, and mutation foundations exist on Drizzle plus PGlite — existing
- ✓ Headless CLI and HTTP surfaces can evaluate documents and expose automation-friendly entrypoints — existing
- ✓ Plugin runtime v1 and canvas UI contribution points exist as extension foundations — existing

### Active

- [ ] Deliver a usable BYO Agent Runtime path from mobile or web handoff to approved canonical mutation proposals
- [ ] Make canonical DB-backed workspace, document, and canvas authoring the primary experience across desktop and mobile
- [ ] Ship the 1.0 fast path around revision hardening, share and review links, import and export reliability, and plugin minimum
- [ ] Hold collaboration expansion until the 1.0 authoring path is stable and validated

### Out of Scope

- In-app AI chat and session UI — AI input should arrive through external agents, CLI, MCP, or share handoff
- File-first `.tsx` as primary editing truth — the legacy file patcher is a compatibility path, not the product target
- Realtime collaboration before 1.0 — presence and shared realtime are post-1.0 expansion work
- Plugin marketplace and enterprise permission matrix — not required to close the current 1.0 path

## Context

- Brownfield monorepo: Next.js app shell, Bun local services, `@magam/core` render DSL, and shared canonical persistence and mutation contracts in `libs/shared`
- ADR-backed direction is already locked: database-first canvas platform and shared canonical contract split
- Existing repo docs already define milestone bundles `R0` through `R3`; this initialization converts that direction into GSD planning artifacts
- Current benchmark framing is FigJam, Freeform, Miro, and Excalidraw for the workspace -> document -> canvas -> object loop
- Legacy `.tsx` editing still exists in the repo, but the documented product target treats it as a transition adapter rather than the primary source of truth

## Constraints

- **Tech stack**: TypeScript, React 18, Next.js 15, Bun, Drizzle, and PGlite — current code and tooling are already standardized there
- **Product direction**: Canonical DB is the primary source of truth — roadmap decisions should reinforce it, not re-open file-first debates
- **AI surface**: BYO agent runtime only — avoid provider-proxy and in-app chat regressions
- **Platform split**: Desktop and mobile share the mutation backbone but keep distinct shells — mobile is not treated as a shrunk desktop
- **Compatibility**: Existing file patcher and runtime services must remain safe transition surfaces until canonical UX fully replaces them

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use canonical DB-backed objects as the primary document truth | Desktop, mobile, CLI, automation, and review flows need one shared data plane | ✓ Good |
| Treat `.tsx` and AST patching as compatibility, not primary authoring | The legacy path cannot remain the long-term source of truth for database-first workflows | ✓ Good |
| Keep AI outside the app shell and center proposals plus approval instead of chat sessions | Product direction prefers external agent tooling and auditability over embedded chat UX | ✓ Good |
| Organize project delivery around the existing R0 to R2 1.0 milestones and hold collaboration expansion for later | The repo already separates 1.0 completion from post-1.0 work | ✓ Good |
| Initialize GSD planning from current brownfield docs with coarse milestone phases | The repo already contains a documented 1.0 path, so initialization should mirror it instead of inventing a new structure | — Pending |

---
*Last updated: 2026-03-19 after initialization from brownfield docs and codebase map*
