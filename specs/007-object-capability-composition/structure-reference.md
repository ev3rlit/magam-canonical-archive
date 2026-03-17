# Structure Reference: Object Capability Composition

This document is a reference-only visual guide for how the feature changes code structure and dependency flow.

## Implementation Status

- Canonical normalization, capability precedence, and legacy inference are implemented in `app/features/render/`.
- Client editability now prefers canonical capability/profile metadata over stored alias-family hints.
- WS patch/method flows now reject content-contract violations with explicit diagnostics.
- Public alias rendering remains intact while internal gates use canonical metadata first.

## Scope of Structural Change

The feature does not replace the public authoring surface. It moves the internal decision center from alias/tag-name branching to canonical object normalization plus capability/content-based routing.

Primary code areas affected:

- `libs/core/src/components/{Node,Shape,Sticky,Image,Markdown,Sequence,Sticker}.tsx`
- `app/features/render/parseRenderGraph.ts`
- `app/features/editing/{editability,commands,createDefaults}.ts`
- `app/ws/{methods,filePatcher}.ts`
- `app/components/{GraphCanvas.tsx,ContextMenu.tsx,FloatingToolbar.tsx}`
- `app/components/editor/{WorkspaceClient.tsx,workspaceEditUtils.ts}`

## Before vs After

### Before

- Public alias identity and JSX tag names tend to drive render, editability, and patch behavior.
- Legacy props and alias-specific defaults are interpreted in multiple places.
- Content contract and style capability boundaries are easy to blur.

### After

- Public aliases remain as authoring sugar.
- `parseRenderGraph.ts` normalizes alias input and legacy props into a canonical object model.
- `editability.ts`, `commands.ts`, `methods.ts`, and `filePatcher.ts` consume canonical metadata instead of alias identity.
- Content contracts remain strict for `media`, `markdown`, and `sequence`.

## Code Structure

```mermaid
flowchart LR
    subgraph Public["Public Authoring Surface"]
        Node["Node.tsx"]
        Shape["Shape.tsx"]
        Sticky["Sticky.tsx"]
        Image["Image.tsx"]
        Markdown["Markdown.tsx"]
        Sequence["Sequence.tsx"]
        Sticker["Sticker.tsx"]
    end

    subgraph Normalize["Normalization Layer"]
        Parse["parseRenderGraph.ts"]
        Canonical["CanonicalObject\n(ObjectCore + SemanticRole + CapabilityBag)"]
    end

    subgraph Client["Client Editing Gates"]
        Editability["editability.ts"]
        Commands["commands.ts"]
        Defaults["createDefaults.ts"]
        UI["GraphCanvas.tsx\nWorkspaceClient.tsx\nContextMenu.tsx\nFloatingToolbar.tsx"]
    end

    subgraph Server["Server Validation/Patch"]
        Methods["methods.ts"]
        Patcher["filePatcher.ts"]
    end

    Node --> Parse
    Shape --> Parse
    Sticky --> Parse
    Image --> Parse
    Markdown --> Parse
    Sequence --> Parse
    Sticker --> Parse

    Parse --> Canonical
    Canonical --> Editability
    Canonical --> Commands
    Canonical --> UI
    Canonical --> Methods
    Defaults --> Commands
    Editability --> UI
    Commands --> Methods
    Methods --> Patcher
```

## Domain Model

```mermaid
classDiagram
    class ObjectCore {
      +id: string
      +position
      +relations
      +children
      +className
      +sourceMeta
    }

    class CanonicalObject {
      +core: ObjectCore
      +semanticRole: SemanticRole
      +capabilities: CapabilityBag
      +capabilitySources
      +alias
    }

    class CapabilityBag {
      +frame
      +material
      +texture
      +attach
      +ports
      +bubble
      +content
    }

    class ContentCapability {
      <<union>>
      +kind: text|markdown|media|sequence
    }

    class CapabilityProfile {
      +allowedUpdateKeys
      +allowedCommands
      +readOnlyReason
      +contentCarrier
    }

    class ValidationResult {
      +ok
      +code
      +message
      +path
    }

    class AliasNormalizationRule
    class SemanticRole
    class NormalizationSource

    CanonicalObject *-- ObjectCore
    CanonicalObject *-- CapabilityBag
    CanonicalObject --> SemanticRole
    CanonicalObject --> NormalizationSource
    CapabilityBag o-- ContentCapability
    AliasNormalizationRule --> CanonicalObject : produces
    CapabilityProfile --> CanonicalObject : derived from
    ValidationResult --> CanonicalObject : validates
```

## Dependency Direction

```mermaid
flowchart TD
    Alias["Public Alias\nNode/Shape/Sticky/Image/Markdown/Sequence/Sticker"]
    Legacy["Legacy Props"]
    Normalize["AliasNormalizationRule\nprecedence:\nexplicit > inferred > preset"]
    Role["SemanticRole\nminimal stable set"]
    Content["ContentKind contract"]
    Profile["CapabilityProfile"]
    Renderer["Renderer routing"]
    Editor["Editability + Commands"]
    Patcher["WS Methods + FilePatcher"]
    Error["ValidationResult"]

    Alias --> Normalize
    Legacy --> Normalize
    Normalize --> Role
    Normalize --> Content
    Normalize --> Profile
    Role --> Renderer
    Content --> Renderer
    Profile --> Editor
    Content --> Editor
    Profile --> Patcher
    Content --> Patcher
    Normalize --> Error
    Content --> Error
    Profile --> Error
```

## Key Policy Effects

- Public aliases stay, but they are no longer the internal source of truth.
- Legacy documents are normalized by inference instead of requiring upfront migration.
- Explicit user capability wins over alias preset defaults.
- `Sticky` keeps `sticky-note` semantic even if some sticky-default capabilities are removed.
- Content-kind mismatch is rejected explicitly instead of being silently repaired.
