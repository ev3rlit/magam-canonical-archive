<!--
  Sync Impact Report
  ==================
  Version change: 2.0.0 → 3.0.0

  Modified principles:
    - II. Simplicity First → II. Structural Simplicity
    - III. Surgical Changes → VI. Surgical Changes
    - IV. Goal-Driven Execution → VII. Goal-Driven and Verifiable Execution

  Added principles:
    - III. Feature-Oriented Modular Monolith
    - IV. Dependency-Linear Design
    - V. Promptable Modules and Minimal Context Surfaces

  Removed principles:
    - None

  Added sections:
    - Architecture and Engineering Constraints
    - Development Workflow

  Removed sections:
    - None

  Expanded / codified requirements:
    - CLI-first TSX canvas application identity
    - Modular monolith within a monorepo
    - Feature/domain-oriented structure over layer-first organization
    - Clean Architecture / Dependency Rule enforcement
    - DDD Lite modeling expectations
    - Contract-first boundaries for parallel work
    - Acyclic dependency requirements
    - Interface Segregation and Information Hiding requirements
    - Composition over Inheritance preference
    - Promptable modules for AI/human collaboration
    - Context window minimization / minimal task file surface
    - Explicit ownership and task decomposition guidance
    - Machine-verifiable invariants and architecture test expectations
    - ADR requirements for major architectural changes

  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible
    - .specify/templates/spec-template.md ✅ compatible
    - .specify/templates/tasks-template.md ✅ compatible
    - .specify/templates/checklist-template.md ✅ compatible
    - .specify/templates/agent-file-template.md ⚠ should be updated to reflect:
      - module purpose / non-goals
      - ownership boundary
      - dependency direction
      - verification strategy
      - promptable-module guidance
    - CLAUDE.md ⚠ should be updated to mirror:
      - modular monolith + feature-oriented structure
      - dependency-linear design rules
      - promptable modules / minimal context surfaces
      - architecture-test and ADR expectations

  Follow-up TODOs:
    - Add module template guidance for "what this module does / does not do"
    - Add architecture-test coverage for dependency direction and forbidden imports
    - Add ADR template references for boundary, contract, and ownership changes
    - Review local guidance files for consistency with Constitution 3.0.0
-->

# Magam Constitution

## Core Principles

### I. Think Before Coding

**Do not assume. Do not hide ambiguity. Make tradeoffs explicit before code exists.**

Before implementing:

- State assumptions explicitly.
- If multiple interpretations exist, present them rather than silently choosing one.
- If there is a structurally simpler design, explain why it is simpler in terms of ownership, safety, and change locality.
- If a requirement, boundary, or contract is unclear, stop and name the ambiguity before implementation.

Design discussion MUST precede broad code motion when the task affects:

- public CLI contracts,
- cross-module boundaries,
- shared schemas or validators,
- render/composition behavior,
- dependency direction,
- or ownership across multiple contributors or agents.

**Rationale**: Ambiguity resolved before implementation is cheaper than ambiguity resolved after code, tests, and integration have already spread.

### II. Structural Simplicity

**Simplicity is judged by local reasoning, safe change, and explicit ownership—not by low file count.**

- Prefer structures that make the next change easier to locate, safer to apply, and easier for another engineer or agent to understand.
- Abstractions are allowed only when they provide current value: boundary clarity, repeated logic removal, contract stability, ownership isolation, testability, or dependency linearization.
- Do NOT add abstractions for speculative reuse.
- Do NOT collapse distinct responsibilities merely to reduce line count.
- A modest increase in file count or code size is acceptable when it materially improves maintainability, module clarity, or parallel-work readiness.

**Rationale**: Systems become difficult not because they contain abstractions, but because their boundaries, responsibilities, and dependency paths are unclear.

### III. Feature-Oriented Modular Monolith

**Magam is a modular monolith inside a monorepo. Features are the primary unit of structure and ownership.**

- Organize by feature, domain, or vertical slice before organizing by technical layer.
- Each module MUST have a clear purpose, explicit boundary, and documented ownership expectation.
- Modules MUST be understandable in relative isolation.
- Public surfaces MUST be narrow. Internal details MUST remain hidden.
- Shared code MUST be minimal, stable, and justified by repeated real usage.
- Domain logic, rendering logic, orchestration logic, infrastructure logic, and CLI adapter logic MUST remain separable even when they live in the same repository.

DDD Lite applies:

- Use domain concepts where they improve clarity.
- Model invariants explicitly.
- Avoid domain theater and unnecessary ceremony.
- Prefer value-oriented contracts and simple aggregates over over-engineered enterprise patterns.

**Rationale**: Feature-oriented modularity reduces cognitive load, minimizes cross-cutting edits, and supports both human and AI parallel work without premature microservice complexity.

### IV. Dependency-Linear Design

**Dependencies MUST be explicit, acyclic, contract-first, and one-way. Internal policy must not depend on external implementation.**

- Follow the Dependency Rule: inner policy layers MUST NOT know about outer implementation details.
- Prefer dependency flows such as:
  - composition -> application/orchestration -> contracts -> infrastructure adapters
  - CLI entry -> use case -> domain policy -> external adapter

- Cyclic dependencies are prohibited.
- Shared contracts, types, schemas, and validators belong in the lowest stable layer that multiple higher layers can depend on safely.
- Interface Segregation is required: favor small interfaces tailored to the actual consumer so testing, mocking, and agent replacement remain easy.
- Prefer composition over inheritance.
- Hide implementation details behind explicit module boundaries.
- Boundary-crossing behavior MUST be contract-first when multiple contributors or agents are expected to work in parallel.

**Rationale**: One-way dependency flow reduces debugging cost, merge conflict risk, hidden coupling, and architecture drift.

### V. Promptable Modules and Minimal Context Surfaces

**Modules MUST be designed so a human or agent can answer: what this module does, what it does not do, what it depends on, and how to verify it.**

Every meaningful module SHOULD make the following discoverable:

- purpose,
- non-goals,
- public API,
- dependency direction,
- owned invariants,
- verification strategy,
- related CLI commands or compositions.

Modules SHOULD be shaped to minimize context requirements:

- keep the number of files needed for a single task low,
- keep public entrypoints obvious,
- avoid hidden side effects,
- avoid broad implicit shared state,
- and keep contracts machine-readable where possible.

A module is considered **promptable** when a reviewer or agent can modify it safely without scanning unrelated areas of the repository.

**Rationale**: AI collaboration quality degrades when tasks require excessive repository context, hidden assumptions, or broad implicit coupling.

### VI. Surgical Changes

**Touch only what the task requires. Refactor only to expose or protect the boundary being changed.**

When editing existing code:

- Do NOT clean unrelated code, comments, or formatting unless the task requires it.
- Do NOT refactor unrelated modules because they could be better.
- Match local style unless it would hide or worsen the requested boundary.
- If unrelated technical debt is noticed, mention it separately rather than bundling it into the task.

Boundary refactors are allowed when they are the smallest safe way to:

- isolate the requested change,
- make dependency direction explicit,
- improve interface segregation,
- reduce merge conflict risk,
- preserve information hiding,
- or enable parallel ownership.

When changes create orphans:

- Remove imports, symbols, and helpers made unused by the current change.
- Do NOT remove pre-existing dead code unless asked.

**Rationale**: Large incidental diffs obscure intent. Zero refactoring can also trap change inside an unclear boundary. The correct rule is minimal necessary boundary refactoring.

### VII. Goal-Driven and Verifiable Execution

**Every task must terminate in a verifiable outcome, not in subjective confidence.**

Transform requested work into explicit checks:

- “Add validation” -> define invalid cases and verify them.
- “Fix the bug” -> reproduce, then verify the fix.
- “Refactor” -> preserve behavior with tests or equivalent checks.
- “Add a module” -> verify boundary rules, ownership clarity, and contract shape.

For multi-step work, define short success criteria:

```text
1. Define boundary and contract -> verify: affected files/modules are explicit
2. Implement change -> verify: tests/build/manual behavior
3. Validate architecture -> verify: dependency and boundary rules still hold
```

Verification may include:

- unit tests,
- contract tests,
- integration tests,
- architecture tests,
- build checks,
- render/output checks,
- or targeted manual confirmation.

**Rationale**: Without explicit exit criteria, scope drifts and “done” becomes untestable.

## Architecture and Engineering Constraints

The following constraints are non-negotiable across the Magam codebase:

1. **Runtime and Tooling**
   - Bun is the package manager and script runner. Use `bun`, not `npm` or `yarn`.
   - Monorepo conventions, workspace boundaries, and path aliases MUST remain consistent.
   - Generated code and authored code MUST be clearly separated.

2. **Application Identity**
   - Magam is a CLI-first TSX canvas application.
   - The CLI is the primary contract surface for automation, composition execution, validation, diagnostics, and scripted workflows.
   - Core capabilities SHOULD be invocable through stable CLI commands.
   - CLI outputs SHOULD support both machine-readable and human-readable modes.

3. **Composition Model**
   - TSX is the canonical composition authoring format.
   - Magam components are processed by a custom React Reconciler and do NOT represent normal DOM output.
   - Code that assumes DOM semantics where the composition model does not provide them is incorrect.
   - Composition files SHOULD describe rendering intent, not infrastructure orchestration.

4. **State and Side Effects**
   - Existing state management conventions MUST be respected unless an explicit architectural change is approved.
   - Hidden mutable global state is prohibited in critical flows.
   - Time, randomness, environment assumptions, and filesystem behavior MUST be controlled or injected at relevant boundaries.

5. **Error Handling and Contracts**
   - In `@magam/core`, functions MUST use `neverthrow`-style `Result` / `ResultAsync` flows instead of unchecked exception-based control flow.
   - Public interfaces MUST be typed.
   - External inputs and unstable boundaries MUST have runtime validation.
   - Contracts SHOULD be stable, explicit, and machine-readable where practical.

6. **Dependency Rules**
   - New shared contracts, validators, orchestration helpers, and adapters MUST be placed to preserve acyclic dependency flow.
   - Architecture rules MUST be testable.
   - Modules MUST NOT reach across boundaries by convenience imports when an explicit contract already exists.

7. **Observability and Diagnostics**
   - Failures MUST be actionable.
   - Diagnostics SHOULD identify failing module, composition, command, asset, or stage when possible.
   - Silent failure, swallowed exceptions, and opaque generic errors are prohibited.

## Development Workflow

1. **Spec and ADR Discipline**
   - Significant architectural or boundary changes MUST start with a spec, task brief, or ADR.
   - ADRs are required when changing:
     - top-level module boundaries,
     - dependency direction,
     - shared public contracts,
     - composition system structure,
     - or core CLI semantics.

2. **Task Decomposition and Ownership**
   - Work SHOULD be decomposed into units that can be completed with minimal unrelated context.
   - Each module or sub-area SHOULD have clear ownership expectations.
   - When parallel work is expected, define contracts and ownership boundaries before implementation spreads.

3. **Verification Before Completion**
   - No task is complete without a verification step.
   - Verification MUST match the risk level of the change.
   - Bug fixes SHOULD include regression coverage.

4. **Architecture Test Requirement**
   - Architectural constraints are not advisory text only.
   - Dependency rules, allowed import directions, module boundary rules, and other structural invariants SHOULD be enforced by architecture tests where practical.
   - If a rule is important enough to guide repeated review comments, it should be considered for codification.

5. **Diff Hygiene**
   - Diffs MUST contain only task-relevant edits plus the minimum boundary refactor needed to implement the task safely.
   - Unrelated cleanup SHOULD be split into separate work.

6. **Documentation and Local Guidance**
   - New modules, commands, major composition systems, or shared contracts MUST include local documentation.
   - Folder-level guidance MAY exist in `CLAUDE.md` or equivalent local guidance files.
   - Local guidance MUST remain consistent with this constitution.

## Governance

- This constitution supersedes conflicting ad-hoc practice.
- All specs, tasks, ADRs, and reviews SHOULD evaluate compliance with it.
- Any exception MUST be explicit, documented, justified, and narrowly scoped.
- Amendments require:
  1. documented rationale,
  2. explicit text change,
  3. impact analysis,
  4. owner approval,
  5. version bump according to semantic meaning.

### Versioning Policy

- **MAJOR**: backward-incompatible removal or redefinition of a principle
- **MINOR**: addition of a principle, section, or materially expanded guidance
- **PATCH**: clarifications, wording updates, typo fixes, non-semantic edits

### Compliance Expectations

- Reviewers SHOULD check not only correctness but also:
  - dependency direction,
  - module boundary clarity,
  - context-surface minimization,
  - contract stability,
  - and verification quality.

- Complexity bears the burden of proof.
- Hidden coupling, speculative abstractions, and architecture drift MUST be challenged rather than silently accepted.

**Version**: 3.0.0 | **Ratified**: 2026-03-01 | **Last Amended**: 2026-03-14
