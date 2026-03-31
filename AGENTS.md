# AGENTS.md

This file defines how agents should work in this repository. It focuses on project and task principles, not codebase inventory.

## Primary References

- For product direction, architecture, runtime modes, editor-shell structure, killer features, and the current target tech stack, read `TECHSPEC.md` first and treat it as the primary product/technical reference.
- For TypeScript design philosophy, interface shape, type usage, and abstraction rules, read `RULE.md` first and treat it as the primary programming reference.
- For design, layout, and visual language decisions, read `DESIGN.md` first and treat it as the primary design reference.

## Product Identity

Magam은 AI와 사람이 "그리기"보다 "설명하기"로 캔버스를 만들고, 그 결과를 데이터로 축적하는 AI-native programmable whiteboard입니다.

Magam is being rebuilt from scratch as a canvas-first MVP. Existing implementation should not be treated as a compatibility target by default; if current code conflicts with this direction, prefer the new product direction and replace complexity instead of preserving it.

The detailed product direction and current target technology stack live in `TECHSPEC.md`. When repository code or older docs diverge from that document, prefer `TECHSPEC.md` unless the task explicitly updates the spec itself.

### Core Concepts

- 설명 가능한 캔버스 모델: 사용자는 시각 요소를 직접 그리는 대신 의도와 구조를 설명하고, 시스템은 이를 canonical canvas data로 정렬한다.
- 캔버스 편집 제공: 생성, 수정, 선택, 관계 편집, 스타일 편집은 모두 설명 가능한 캔버스 객체를 다루는 방향으로 수렴한다.
- 자동 레이아웃: 배치는 수동 좌표 입력보다 구조와 관계를 우선하며, 레이아웃 엔진은 사용자의 의도를 정리하는 역할을 맡는다.
- DB First runtime: 파일이나 임시 UI 상태가 아니라 데이터베이스가 캔버스 상태의 기준 source of truth다.
- AI 확장성: AI agent, headless runtime, plugin/runtime surface는 모두 canonical canvas data를 읽고 쓰는 확장 레이어다.
- 단일 워크스페이스 = 단일 데이터베이스 파일: workspace boundary는 곧 persistence boundary이며, 기능 설계는 이 1:1 대응을 깨지 않는 방향을 우선한다.

### Rebuild Mandate

- Treat the current codebase as disposable implementation, not as architecture to preserve.
- Do not keep old subsystems alive just because they already exist.
- Prefer deletion, replacement, and narrower re-foundation over compatibility layers, bridge abstractions, or migration-heavy designs unless a task explicitly requires migration.
- Build the new app from the smallest coherent canvas-first MVP, then expand only after the core loop is working end-to-end.

### MVP Roadmap

- Canvas first: establish one clear canvas surface before broader workspace/platform concerns.
- Single workspace, single database file: make workspace boundary and persistence boundary identical from day one.
- DB-first canvas runtime: every read/write path should converge on the database-backed canonical canvas model.
- Core canvas editing: support the minimum create/select/move/edit/grouping flow needed for real canvas work.
- Automatic layout: provide structure-aware layout as a core behavior, not an optional afterthought.
- AI extensibility: add AI entrypoints only after the canonical canvas runtime and MVP editing loop are stable.

### Direction Rules

- Do not describe Magam primarily as a code editor, code archive, TSX authoring tool, or file-first visual programming environment.
- Prefer data contracts, runtime mutations, projections, and workspace persistence boundaries over file-first abstractions.
- Treat canvas data, not source code, as the primary product artifact.
- When choosing between adapting existing complexity and rebuilding a smaller core, prefer rebuilding the smaller core.
- Do not introduce "temporary" compatibility architecture unless the task explicitly demands it and the cost is justified.

## 1. Think Before Coding

Do not guess through ambiguity.

- State assumptions explicitly before implementation when requirements, boundaries, or contracts are unclear.
- Surface competing interpretations instead of silently picking one.
- Prefer the structurally simpler design when it improves ownership clarity, change safety, and local reasoning.
- Stop and name the ambiguity before broad code motion if the task affects shared contracts, dependency direction, rendering behavior, or cross-team ownership.

## 2. Structural Simplicity

Optimize for maintainability, not cleverness or low line count.

- Add no feature or abstraction beyond the task.
- Introduce abstractions only when they provide present-day value: clearer boundaries, repeated logic removal, contract stability, ownership isolation, testability, or cleaner dependency flow.
- Do not merge distinct responsibilities just to reduce file count.
- Make invariants explicit, but avoid ceremony that does not improve current change safety.

## 3. Dependency-Linear Design

Keep dependencies explicit, narrow, and one-way.

- Prefer acyclic dependency flow and obvious ownership boundaries.
- Keep public surfaces small and hide internal implementation details.
- Put shared contracts, types, schemas, and validators in the lowest stable place that can be depended on safely.
- Prefer composition over inheritance.
- When parallel work is expected, define contracts and ownership before implementation spreads.

## 4. Promptable Boundaries and Minimal Context

Shape modules so a human or agent can work safely without scanning unrelated parts of the repository.

- Keep the number of files needed for one task as low as practical.
- Make each module's purpose, non-goals, dependencies, and verification path easy to discover.
- Avoid hidden side effects, broad implicit shared state, and convenience imports that cross boundaries.
- Favor explicit, machine-readable contracts where practical.

## 5. Surgical Changes

Touch only what the task requires.

- Do not bundle unrelated cleanup, formatting, or opportunistic refactors into the same diff.
- Match local style unless the task requires exposing or protecting a clearer boundary.
- Refactor only when it is the smallest safe way to isolate the change, preserve dependency direction, or reduce hidden coupling.
- Remove imports, symbols, and helpers made unused by your change, but do not delete unrelated dead code unless asked.

## 6. Contracts, Errors, and Diagnostics

Be explicit at boundaries and make failures actionable.

- Type public interfaces and validate external or unstable inputs.
- Do not hide failures behind silent fallbacks or broad success-shaped defaults.
- Respect the repository's existing error-handling conventions instead of inventing a parallel style.
- Make diagnostics specific enough to identify the failing module, command, composition, or stage when possible.

## 7. Goal-Driven and Verifiable Execution

No task is done until the outcome is verified.

- Turn requests into concrete checks before or during implementation.
- Match verification depth to change risk.
- Bug fixes should include regression coverage when practical.
- Treat architecture and boundary rules as enforceable constraints, not as advisory prose.

## Working Workflow

- Start product, architecture, runtime, or technology-stack changes by reading `TECHSPEC.md`.
- Start significant architectural or boundary changes with a spec, task brief, or ADR.
- Decompose work into units that can be completed with minimal unrelated context.
- Keep diffs task-focused and split unrelated cleanup into separate work.
- Update local guidance when shared expectations change, and keep guidance files consistent with this document.
- Make exceptions explicit, narrow, and documented instead of relying on informal precedent.

## Absolute Programming Rules

- Follow `RULE.md` as the default TypeScript programming guide for this repository.
- Keep interfaces small and capability-based; prefer names that expose the role directly, such as `CanvasStore`, `ObjectLoader`, `PatchWriter`, `LayoutEngine`, `Reader`, `Writer`, `Clock`, or `Parser`.
- Prefer explicit inputs, outputs, side effects, and failure paths over hidden behavior, ambient state, or magic defaults.
- Prefer concrete data flow, small functions, and focused modules over broad abstractions, wrapper stacks, or speculative extension points.
- Use TypeScript to clarify runtime behavior; avoid type gymnastics, unnecessary generics, and assertion-driven design.
- Validate unstable input at boundaries and surface failures explicitly; do not hide errors behind silent fallbacks or success-shaped defaults.

## Design Guidance

- For any design, layout, visual language, or UI styling decision, read `DESIGN.md` first and treat it as the primary design reference.
- Do not introduce a visual direction that conflicts with `DESIGN.md` unless the task explicitly updates that document too.
- When design guidance in code, docs, or prior implementation conflicts with `DESIGN.md`, prefer `DESIGN.md`.

## i18n Guidance

- Editor UI strings should live under `editor/src/shared/config/` once locale-aware copy is introduced.
- Feature and widget code should consume shared copy adapters instead of embedding large inline string catalogs.
- User-visible default content should live in shared editor/domain boundaries, not inside widget components.
- CLI messages remain English-only unless a task explicitly requires locale-aware CLI output.

## Review Bar

- Review for correctness, boundary clarity, dependency direction, hidden coupling, contract stability, and verification quality.
- Complexity carries the burden of proof.
- Challenge speculative abstractions and architecture drift before they become normal practice.

## Current Repo State

- The repository currently contains a large pre-rebuild implementation in TypeScript, React, Bun, Next.js, Electron, and shared canvas/runtime libraries.
- That implementation is current repository state, not target product architecture.
- When reading existing code, distinguish between "what exists today" and "what we are choosing to preserve for the new MVP." Default to preserving as little as possible.

## Reset Status

- The project is in a reset/re-foundation phase toward a canvas-first MVP.
- Existing subsystems may be mined for ideas or utilities, but should not define the structure of the new app unless they clearly fit the MVP direction.
- New roadmap decisions should optimize for a small, coherent, database-backed canvas core with clear room for later AI extensibility.
