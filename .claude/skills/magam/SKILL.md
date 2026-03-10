---
name: magam
description: This skill should be used when creating visual diagrams, mind maps, flowcharts, architecture diagrams, sticky note compositions, washi tape overlays, or any code-based visual representation using the Magam library. Triggers on tasks involving diagram creation, mind map generation, visual documentation, system architecture visualization, sticky/paper-material styling, or when users mention "magam", "mindmap", "diagram", "flowchart", "sticky", "washi tape", or "canvas".
---

# Magam

## Overview

Magam is a React-based library for creating visual diagrams through code. It enables AI-first diagram creation where users describe their intent in natural language, and the AI generates React/TSX code that renders as visual diagrams. The philosophy is "describing" rather than "drawing" - transforming thoughts into structured visual representations.

## When to Use This Skill

- Creating mind maps to organize ideas or knowledge
- Building system architecture diagrams
- Visualizing flowcharts and processes
- Creating overview/brainstorming diagrams with sticky notes
- Adding washi tape style overlays for labels and emphasis
- Generating visual documentation from text descriptions
- Any task requiring code-based diagram generation

## References

- `reference/frame.md`: `frame(...)` for reusable graph components across Canvas and MindMap, including nested frame composition.
- `reference/sticky.md`: Sticky patterns, shapes, sizing modes, and `at` placement workflows.
- `reference/washi_tape.md`: WashiTape patterns, placement modes, and sticker-mix layout examples.

## Editing Nodes with Copy Node ID

Magam supports a node ID copy feature that enables targeted editing of specific nodes. Users can select a node in the canvas and copy its fully-qualified ID, then paste it into a prompt for the AI to locate and edit.

### How It Works

1. **Select** a node by clicking it on the canvas
2. **Copy** with `Cmd+C` (Mac) / `Ctrl+C` (Windows/Linux)
3. The fully-qualified node ID is copied to clipboard (e.g., `mindmap.mindmap-0.ai-table-demo`)
4. **Paste** the ID into a prompt to tell the AI which node to edit

### Node ID Format

Node IDs follow the pattern: `{mindmapId}.{nodeId}`

- If the MindMap has an explicit `id` prop (e.g., `<MindMap id="main">`), the prefix is that ID (e.g., `main.intro`)
- If no explicit `id`, an auto-generated ID like `mindmap-0` is used (e.g., `mindmap-0.root`)
- Top-level canvas elements (Shape, Sticky, Text) outside a MindMap use their own `id` directly
- Inside EmbedScope, IDs are prefixed with the scope: `<EmbedScope id="auth">` + `id="jwt"` = `"auth.jwt"`
- EmbedScope + MindMap combines: `<EmbedScope id="auth">` + `<MindMap id="map">` + `<Node id="root">` = `"auth.map.root"`

### AI Workflow for Targeted Edits

When a user provides a copied node ID, the AI should:

1. **Find the node** in the TSX source by matching the `id` prop value (the last segment of the path)
2. **Identify the MindMap** it belongs to by matching the MindMap `id` prop (the first segment)
3. **Edit the node's content** as requested

**Example prompt from user:**
> "Add a row for 'Alice' to the table in `mindmap.mindmap-0.ai-table-demo`"

**AI interpretation:**
- MindMap: auto-generated `mindmap-0` (the first/default MindMap in the file)
- Node: `ai-table-demo`
- Action: Find `<Node id="ai-table-demo">` and add a table row

### Multi-Select

Multiple nodes can be selected and copied at once. Each ID is separated by a newline in the clipboard. The AI should handle each node independently when editing.

## Core Components

All components are imported from `@magam/core`:

```tsx
import { Canvas, Shape, Sticky, Sticker, Image, WashiTape, MindMap, Node, Edge, Text, Markdown, frame } from '@magam/core';
```

## Reusable Composition with `frame(...)`

Use `frame(...)` when the user wants reusable diagram components that can be mounted in Canvas or MindMap.

- Prefer `frame(...)` over exposing `EmbedScope` or `MindMapEmbed` in newly generated user-facing code.
- Treat `EmbedScope` and `MindMapEmbed` as low-level primitives unless the user is explicitly working on core internals.
- Keep ids inside a frame local, such as `app`, `db`, `details`.
- Let the runtime expand scoped ids at mount time.
- A frame can contain child frames.

Typical pattern:

```tsx
const ServiceFrame = frame(function ServiceFrame({ label }: { label: string }) {
  return (
    <>
      <Shape id="app" x={0} y={0}>{label} Service</Shape>
      <Shape id="db" anchor="app" position="bottom" gap={48}>Database</Shape>
    </>
  );
});
```

Canvas usage:

```tsx
<Canvas>
  <ServiceFrame id="auth" x={120} y={120} label="Auth" />
  <ServiceFrame id="billing" anchor="auth.db" position="right" gap={220} label="Billing" />
</Canvas>
```

MindMap usage:

```tsx
<MindMap id="services">
  <Node id="platform">Platform</Node>
  <ServiceFrame id="auth" from="platform" label="Auth" />
</MindMap>
```

For more complete examples, see `reference/frame.md`.

### Canvas (Required Root)

Every Magam diagram must be wrapped in a Canvas component.

```tsx
<Canvas>
  {/* All diagram elements go here */}
</Canvas>
```

### Shape

Rectangle/box element for architecture diagrams and flowcharts.

**Props:**
- `id` (required): Unique identifier
- `x`, `y`: Absolute position coordinates
- `size`: Token-first sizing (`'xs'|'s'|'m'|'l'|'xl'`, `number`, or object union)
- `type`: `rectangle` | `circle` | `triangle` (default ratio: rectangle=landscape, circle/triangle=square)
- `label`: Text label (alternative to children)
- `className`: Tailwind CSS classes for styling
- `anchor`: ID of another Shape for relative positioning
- `position`: Position relative to anchor ("right", "bottom", "left", "top")
- `gap`: Distance from anchor element
- Legacy `width`/`height`: not part of the standardized contract (runtime warning + ignore)

**Usage Patterns:**

```tsx
{/* Absolute positioning */}
<Shape id="box1" x={100} y={100}>Content</Shape>

{/* Token-first size */}
<Shape id="box2" x={200} y={100} size="m">Sized Box</Shape>

{/* Ratio / widthHeight variants */}
<Shape id="box3" x={380} y={100} size={{ token: 's', ratio: 'portrait' }}>Portrait Box</Shape>
<Shape id="box4" x={560} y={100} size={{ widthHeight: 'l' }}>Square Box</Shape>

{/* Relative positioning with anchor */}
<Shape id="api" anchor="users" position="right" gap={120}>
  <Text>API Server</Text>
  <Edge to="users" />
</Shape>

{/* With Tailwind styling */}
<Shape id="success" className="bg-green-50 border-green-300 text-green-700">
  Success State
</Shape>
```

### Sticky

Sticky note element for memo-centric layouts.  
Use Sticky for "idea cards", "action notes", "context labels", and diary note blocks.

**Core props (improved):**
- `id` (required): Unique node ID
- Placement: either `x` + `y`, or `at` (`anchor` / `attach`)
- Material: `pattern` (`preset` / `solid` / `svg` / `image`)
- Shape: `shape` (`rectangle` | `heart` | `cloud` | `speech`)
- Sizing: token-first `size` (`number|token|{token,ratio}|{widthHeight}|{width,height}`)
- Default ratio: `landscape` (primitive `number`/`token`도 동일 경로로 해석)
- Legacy bridge: old `color` still works (internally normalized to `solid(color)`)
- Legacy `width`/`height`: standardized size contract에서는 미지원 (runtime warning + ignore)

```tsx
{/* Default postit preset (pattern omitted) */}
<Sticky id="idea" x={100} y={100}>
  Core Idea
  <Edge to="target" />
</Sticky>

{/* Preset + shape + token size */}
<Sticky
  id="retro-note"
  x={340}
  y={90}
  size={{ token: 'm', ratio: 'portrait' }}
  shape="cloud"
  pattern={{ type: 'preset', id: 'lined-warm' }}
>
  Retro Actions
</Sticky>

{/* Primitive number and widthHeight are both supported */}
<Sticky id="retro-note-2" x={620} y={90} size={160}>Numeric Primitive</Sticky>
<Sticky id="retro-note-3" x={820} y={90} size={{ widthHeight: 's' }}>Square Sticky</Sticky>

{/* Relative placement with at={anchor(...)} */}
<Sticky
  id="follow-up"
  at={{ type: 'anchor', target: 'retro-note', position: 'right', gap: 24 }}
  pattern={{ type: 'preset', id: 'kraft-natural' }}
>
  Follow-up
</Sticky>
```

**Behavior notes:**
- If both `at` and `x`/`y` exist, `at` wins.
- Invalid or unknown pattern input falls back to the default Sticky preset (`postit`) without throwing.
- For full examples and migration guidance, see `reference/sticky.md`.

### Sticker

Die-cut decoration element for practical visual styling (journal/deco/scrapbook style).  
Use Sticker when the user asks to "decorate" rather than to model strict architecture.

**Props:**
- `id` (required): Unique identifier
- Position: either `x` + `y`, or `anchor` + `position` (+ optional `gap`, `align`)
- Size hints: `width`, `height`
- Style: `outlineWidth`, `outlineColor`, `shadow`, `padding`
- Rotation: `rotation` (optional)

**Rotation policy:**
- Default: omit `rotation` to use automatic deterministic jitter.
- Use explicit `rotation` only for 1-2 highlight stickers as intentional accents.

```tsx
<Sticker id="title" x={120} y={80}>
  2026 Diary
</Sticker>

{/* Explicit rotation only for a small accent */}
<Sticker id="accent" x={320} y={82} rotation={-8}>
  ✔ Done
</Sticker>
```

### Sticker Content Patterns

Sticker content should prioritize practical decoration content types:
- `text` (plain text children)
- `emoji` (emoji-only or text + emoji)
- `Image` (`<Image ... />`)
- inline SVG (`<svg>...</svg>`)

```tsx
{/* Text */}
<Sticker id="s-text" x={80} y={80}>Top 3 goals today</Sticker>

{/* Emoji */}
<Sticker id="s-emoji" x={280} y={80}>🌼🫧🖇️🎀</Sticker>

{/* Image */}
<Sticker id="s-image" x={460} y={80}>
  <Image src={photoDataUri} alt="Photo sticker" width={140} height={100} />
</Sticker>

{/* Inline SVG */}
<Sticker id="s-svg" x={640} y={80}>
  <svg viewBox="0 0 120 100" width="120" height="100">
    <path d="M60 6 L74 38 L108 38 L81 58 L92 92 L60 72 L28 92 L39 58 L12 38 L46 38 Z" fill="#fde047" stroke="#1e3a8a" strokeWidth="6" />
  </svg>
</Sticker>
```

**Discouraged patterns for Sticker:**
- Markdown inside Sticker (it usually looks like a card block, not a die-cut sticker)
- Overusing explicit rotation on many stickers (causes visual noise)

### WashiTape

WashiTape is a single object for tape-like labels and emphasis strips.  
Use it when the user asks for FigJam-like tape effects, highlight bands, or object-bound label strips.

**Props (common):**
- `id` (required)
- Placement: either `x` + `y`, or `at` (`polar` / `segment` / `attach`)
- Style: `preset` or `pattern` (`preset` / `solid` / `svg` / `image`)
- Fine-tuning: `edge`, `texture`, `text`, `opacity`

```tsx
<WashiTape id="w1" x={120} y={80} width={220} height={34} preset="pastel-dots">
  Top Priority
</WashiTape>

<WashiTape
  id="w2"
  at={{ type: 'segment', from: { x: 380, y: 280 }, to: { x: 650, y: 320 }, thickness: 34 }}
  pattern={{ type: 'solid', color: '#fed7aa' }}
  edge={{ torn: true, roughness: 1.3 }}
>
  Review Window
</WashiTape>
```

**WashiTape + Sticker layout policy:**
- Keep WashiTape in the main content lane.
- Keep Sticker in side/top decoration lanes.
- Avoid placing decorative stickers over functional tape labels.
- For full examples and API details, see `reference/washi_tape.md`.

### MindMap

Container for hierarchical mind map structures.

**Props:**
- `id`: MindMap identifier (required for multiple MindMaps)
- `x`, `y`: Position on canvas (default: 0, 0)
- `layout`: "tree" (horizontal), "bidirectional" (left+right), or "radial" (circular)
- `spacing`: Gap between nodes

```tsx
<MindMap id="main" layout="tree" spacing={80}>
  <Node id="root">Root Topic</Node>
  <Node id="child1" from="root">Child 1</Node>
  <Node id="child2" from="root">Child 2</Node>
  <Node id="grandchild" from="child1">Grandchild</Node>
</MindMap>
```

### Node

MindMap node element. Must be used inside a MindMap.

**Props:**
- `id` (required): Unique identifier
- `from`: Parent node ID (creates connection automatically)
- `bubble`: Enable floating label when zoomed out (semantic zoom)

**Content Options:**
- Plain text: `<Node id="x">Plain text</Node>`
- Text component: `<Node id="x"><Text>Styled</Text></Node>`
- Multiple Text: `<Node id="x"><Text>Line 1</Text><Text>Line 2</Text></Node>`
- Markdown: `<Node id="x"><Markdown>content</Markdown></Node>`
- Markdown with bubble: `<Node id="x"><Markdown bubble>{content}</Markdown></Node>`

### Semantic Zoom (Bubble)

When zoomed out (zoom < 0.4), nodes with the `bubble` prop display a floating label overlay. The label text is auto-extracted from the first line of content.

**Usage:**
```tsx
{/* On Node directly */}
<Node id="x" bubble>
  <Text>This text becomes bubble label</Text>
</Node>

{/* On Markdown inside Node */}
<Node id="x">
  <Markdown bubble>{`
# Heading becomes bubble
Content here...
  `}</Markdown>
</Node>

{/* On Shape */}
<Shape id="x" label="Bubble text" bubble>
  <Text>Shape content</Text>
</Shape>
```

**Behavior:**
- First line of content is extracted as bubble text
- Markdown syntax (headings, bold, etc.) is cleaned
- Text over 40 characters is truncated with `...`
- Bubble appears as floating overlay on top of original content

**Best Practices:**

| Level | Recommendation | Reason |
|-------|----------------|--------|
| Root node | Always use | Main topic visibility at any zoom |
| Level 1-2 (children of root) | Recommended | Section titles remain readable when zoomed out |
| Level 3 | Selective | Only for key concepts that need visibility |
| Level 4+ | Usually skip | Too many bubbles cause visual clutter |

- **Use for navigation nodes**: Nodes with Table of Contents or section headers benefit from bubbles
- **Use for key landmarks**: Important concepts users need to locate quickly
- **Skip for leaf nodes**: Detail nodes don't need bubble labels—users will zoom in to read them
- **Skip for repetitive content**: If many siblings have similar structure, bubble only the parent

```tsx
{/* Good: bubbles on structural nodes */}
<MindMap id="docs">
  <Node id="root" bubble>Main Topic</Node>
  <Node id="section1" from="root" bubble>Section 1</Node>
  <Node id="section2" from="root" bubble>Section 2</Node>
  <Node id="detail1" from="section1">Detail (no bubble)</Node>
</MindMap>
```


### Text

Standalone or inline text element.

**Props:**
- `id`: Identifier (for standalone)
- `x`, `y`: Position (for standalone)
- `fontSize`: `number | 'xs'|'s'|'m'|'l'|'xl'`
- `className`: Tailwind CSS classes

```tsx
{/* Standalone text on canvas */}
<Text id="title" x={200} y={30} fontSize="xl">Page Title</Text>

{/* Styled text */}
<Text fontSize="s" className="font-bold text-blue-600">Styled Text</Text>

{/* Inside Shape */}
<Shape id="box">
  <Text fontSize="m" className="font-bold">Title</Text>
  <Text fontSize={12} className="text-gray-500">Subtitle</Text>
</Shape>
```

### Markdown

Rich text content with Markdown support. Typically used inside Node.

**Size contract (`size` single entry):**
- Primitive (`number|token`) => 1D typography scaling
- Object (`{ token, ratio } | { widthHeight } | { width, height }`) => 2D frame sizing

**Supported Features:**
- Headers: `# H1`, `## H2`, `### H3`
- Emphasis: `**bold**`, `*italic*`
- Lists: `- item` or `1. item`
- Code: `` `inline` `` and code blocks with ```
- Tables: `| col1 | col2 |`
- Blockquotes: `> quote`

```tsx
<Node id="docs">
  <Markdown size="s">{`
### API Reference

| Method | Endpoint |
|--------|----------|
| GET    | /users   |
| POST   | /users   |

\`\`\`typescript
function hello() {
  return "world";
}
\`\`\`
  `}</Markdown>
</Node>

<Node id="docs-card">
  <Markdown size={{ token: 'm', ratio: 'portrait' }}>{`## Card Layout`}</Markdown>
</Node>
```

### Node Links (Internal Navigation)

Navigate between nodes using the `node:` scheme in Markdown links. Clicking a node link smoothly animates the viewport to the target node.

**Syntax:** `[link text](node:/mindmapId/nodeId)`

```tsx
<Node id="intro">
  <Markdown>{`
## Introduction

Learn the basics first, then move on.

[Next: Core Concepts](node:/main/concepts)
  `}</Markdown>
</Node>

<Node id="concepts" from="intro">
  <Markdown>{`
## Core Concepts

- Canvas: Infinite drawing area
- MindMap: Auto-layout container
- Node: Content container

[← Previous](node:/main/intro) | [Next →](node:/main/examples)
  `}</Markdown>
</Node>
```

**Path Formats:**
- `/mindmapId/nodeId` → navigates to `mindmapId.nodeId`
- `/nodeId` → navigates to `nodeId` (for single MindMap)

**Styling:** Node links are styled with indigo color and arrow prefix (→) to distinguish from external links.

### Standardized Size Scope (v1)

- In scope: `Text.fontSize`, `Shape.size`, `Sticky.size`, `Markdown.size`
- Out of scope: `Sequence` size tokenization (keep existing spacing props)
- Out of scope: `Sticker` size tokenization (sticker remains content-driven die-cut)
- Legacy experimental `width`/`height` sizing APIs are unsupported in the standardized contract

### EmbedScope

ID namespace isolation for reusable components. Wrapping elements in `EmbedScope` automatically prefixes all child IDs with the scope name, preventing collisions when the same component is used multiple times.

**Props:**
- `id` (required): Scope identifier. Becomes the prefix for all child IDs.
- `children`: React nodes to scope.

**How it works:**
- Child `id` props are automatically prefixed: `id="app"` inside `<EmbedScope id="auth">` becomes `"auth.app"`
- Child `anchor` props are automatically resolved to scoped IDs when a matching node exists in the same scope
- Edge `from`/`to` props are also scoped automatically
- IDs containing a dot (e.g., `"billing.app"`) are treated as already qualified and not prefixed
- Nesting is supported: scopes chain (e.g., `"infra"` > `"aws"` > `"ec2"` = `"infra.aws.ec2"`)
- EmbedScope adds no visual element to the canvas - it is purely logical

**Basic usage:**

```tsx
{/* Reusable component - uses local IDs only */}
function ServiceCluster({ label }: { label: string }) {
  return (
    <>
      <Shape id="lb" anchor="gateway" position="bottom" gap={80} size={{ token: 's', ratio: 'landscape' }}>
        Load Balancer
      </Shape>
      <Shape id="app" anchor="lb" position="bottom" gap={60} size={{ token: 's', ratio: 'landscape' }}>
        {label} Server
        <Edge to="db" />
      </Shape>
      <Shape id="db" anchor="app" position="bottom" gap={60} size={{ token: 's', ratio: 'landscape' }}>
        Database
      </Shape>
      <Edge from="lb" to="app" />
    </>
  );
}

export default function Example() {
  return (
    <Canvas>
      <Shape id="gateway" x={0} y={0} size={{ token: 's', ratio: 'landscape' }}>API Gateway</Shape>

      {/* IDs become auth.lb, auth.app, auth.db */}
      <EmbedScope id="auth">
        <ServiceCluster label="Auth" />
      </EmbedScope>

      {/* IDs become billing.lb, billing.app, billing.db */}
      <EmbedScope id="billing">
        <ServiceCluster label="Billing" />
      </EmbedScope>

      {/* Cross-scope edge using fully qualified IDs */}
      <Edge from="auth.app" to="billing.app" label="verify" />
    </Canvas>
  );
}
```

**Anchor resolution inside EmbedScope:**

Inside a scope, `anchor` props referencing sibling nodes are automatically resolved:
- `anchor="lb"` inside `<EmbedScope id="auth">` resolves to `"auth.lb"` (because `"auth.lb"` exists)
- `anchor="gateway"` inside `<EmbedScope id="auth">` stays as `"gateway"` (because `"auth.gateway"` does not exist - it is an external reference)

This means reusable components work without any modification. Internal anchor chains resolve within the scope, while references to external nodes pass through unchanged.

**Cross-boundary edges:**

```tsx
{/* From Canvas to scope: use fully qualified ID */}
<Edge from="gateway" to="auth.lb" />

{/* Between scopes: use fully qualified IDs */}
<Edge from="auth.app" to="billing.app" />

{/* Inside a component, reference external node with dot notation */}
<Shape id="app" ...>
  <Edge to="billing.app" />  {/* dot = already qualified, not prefixed */}
</Shape>
```

### Edge

Connection line between elements.

**Props:**
- `from`: Source element ID
- `to`: Target element ID

```tsx
{/* Standalone edge */}
<Edge from="box1" to="box2" />

{/* Inside Shape (only 'to' needed) */}
<Shape id="api">
  <Text>API</Text>
  <Edge to="database" />
</Shape>
```

## Styling with Tailwind CSS

All components support `className` prop for Tailwind CSS styling.

### Colors and States
```tsx
<Shape className="bg-green-50 border-green-300 text-green-700">Success</Shape>
<Shape className="bg-yellow-50 border-yellow-300 text-yellow-700">Warning</Shape>
<Shape className="bg-red-50 border-red-300 text-red-700">Error</Shape>
```

### Effects
```tsx
<Shape className="bg-gradient-to-r from-blue-400 to-purple-500 text-white border-none">
  Gradient
</Shape>
<Shape className="shadow-xl">Shadow</Shape>
<Sticky className="bg-white/50 backdrop-blur-sm">Glass Effect</Sticky>
```

### Borders
```tsx
<Shape className="rounded-2xl">Rounded</Shape>
<Shape className="border-dashed border-2">Dashed</Shape>
<Shape className="border-4 border-indigo-500">Thick Border</Shape>
```

### Sizing
```tsx
<Shape size="m">Token-first sizing</Shape>
<Shape size={{ token: 's', ratio: 'portrait' }}>Ratio sizing</Shape>
<Shape size={{ widthHeight: 'l' }}>Unified width/height token</Shape>
```

## Common Patterns

### Decoration Intent Handling

When user intent is decoration-oriented, switch from architecture/mind map defaults to Sticker-first composition.

**Intent keywords (trigger examples):**
- `꾸미기`, `다이어리`, `스티커`, `데코`, `감성`
- `scrapbook`, `journal`, `decorate`, `deco`, `sticker`

**Default behavior: Diary-deco preset**
- Build a dense composition with multiple `Sticker` elements.
- Mix practical sticker content types: text + emoji + inline SVG + `Image`.
- Minimize or omit `Edge` connections unless the user explicitly asks for linked structure.
- Exclude Markdown inside Sticker by default.

**Output guidance**
- Return immediately runnable TSX first.
- Prefer direct `x`/`y` placement for decoration tasks (faster iteration and visual control).
- Keep explicit `rotation` to 1-2 stickers max; rely on automatic jitter for the rest.

### Architecture Diagram

```tsx
<Canvas>
  <Text id="title" x={200} y={30}>System Architecture</Text>

  <Shape id="users" x={50} y={100}>
    <Text>Users</Text>
  </Shape>

  <Shape id="api" anchor="users" position="right" gap={120}>
    <Text>API Server</Text>
    <Edge to="users" />
  </Shape>

  <Shape id="db" anchor="api" position="right" gap={120}>
    <Text>Database</Text>
    <Edge to="api" />
  </Shape>

  <Shape id="auth" anchor="api" position="bottom" gap={80}>
    <Text>Auth Service</Text>
    <Edge to="api" />
  </Shape>
</Canvas>
```

### Knowledge Mind Map

```tsx
<Canvas>
  <MindMap id="knowledge" layout="tree" spacing={80}>
    <Node id="root">
      <Markdown>{`# Main Topic`}</Markdown>
    </Node>

    <Node id="category1" from="root">Category 1</Node>
    <Node id="item1a" from="category1">Item 1A</Node>
    <Node id="item1b" from="category1">Item 1B</Node>

    <Node id="category2" from="root">Category 2</Node>
    <Node id="item2a" from="category2">
      <Markdown>{`
**Detailed Item**
- Point 1
- Point 2
      `}</Markdown>
    </Node>
  </MindMap>
</Canvas>
```

### Multiple MindMaps

Place multiple independent MindMaps on a single Canvas. Each MindMap has its own ID namespace, so node IDs won't conflict.

**Key Features:**
- **Scoped IDs**: Same node ID can exist in different MindMaps
- **Positioning**: Use `x`, `y` props to position each MindMap
- **Cross-MindMap Edges**: Use dot notation `mapId.nodeId` for references

```tsx
<Canvas>
  {/* First MindMap */}
  <MindMap id="concepts" layout="bidirectional">
    <Node id="root">
      <Markdown>{`# Core Concepts`}</Markdown>
    </Node>
    <Node id="feature1" from="root">Feature A</Node>
    <Node id="feature2" from="root">Feature B</Node>
  </MindMap>

  {/* Second MindMap - positioned to the right */}
  <MindMap id="details" layout="tree" x={600} y={0}>
    <Node id="root">
      <Markdown>{`## Details`}</Markdown>
    </Node>
    <Node id="item1" from="root">Detail 1</Node>
    <Node id="item2" from="root">Detail 2</Node>
  </MindMap>

  {/* Cross-MindMap connection using dot notation */}
  <Edge from="concepts.feature1" to="details.item1" />
</Canvas>
```

### Reusable Components with EmbedScope

Extract repeated patterns into components and use EmbedScope to isolate IDs. Anchor references inside a scope are automatically resolved to sibling nodes.

```tsx
function DatabaseCluster() {
  return (
    <>
      <Shape id="primary" x={0} y={0} size={{ token: 's', ratio: 'landscape' }}>Primary</Shape>
      <Shape id="replica" anchor="primary" position="right" gap={80} size={{ token: 's', ratio: 'landscape' }}>
        Replica
      </Shape>
      <Edge from="primary" to="replica" label="sync" />
    </>
  );
}

export default function MultiDB() {
  return (
    <Canvas>
      {/* "users" scope: users.primary, users.replica */}
      <EmbedScope id="users">
        <DatabaseCluster />
      </EmbedScope>

      {/* "orders" scope: orders.primary, orders.replica */}
      <EmbedScope id="orders">
        <DatabaseCluster />
      </EmbedScope>

      {/* Cross-scope connection */}
      <Edge from="users.primary" to="orders.primary" label="join" />
    </Canvas>
  );
}
```

### Brainstorming with Stickies

```tsx
<Canvas>
  <Text id="title" x={200} y={30}>Brainstorm</Text>

  <Sticky id="idea1" x={100} y={100}>
    Core Idea
    <Edge to="central" />
  </Sticky>

  <Sticky id="idea2" x={100} y={200}>
    Supporting Idea
    <Edge to="central" />
  </Sticky>

  <Shape id="central" x={300} y={150}>Central Concept</Shape>
</Canvas>
```

### Diary Decoration with Stickers

Use this when users ask for practical decoration (journal/scrapbook vibe) rather than strict diagram semantics.

```tsx
import { Canvas, Sticker, Image, Text } from '@magam/core';

const photoDataUri =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="280" height="200" viewBox="0 0 280 200">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#f9a8d4" />
          <stop offset="100%" stop-color="#93c5fd" />
        </linearGradient>
      </defs>
      <rect width="280" height="200" rx="20" fill="url(#g)" />
      <text x="140" y="108" text-anchor="middle" font-size="30" fill="#111827" font-family="Inter, sans-serif">
        SNAP
      </text>
    </svg>
  `);

export default function DiaryDeco() {
  return (
    <Canvas>
      <Text id="title" x={72} y={28} className="text-2xl font-semibold text-slate-800">
        Weekend Journal
      </Text>

      <Sticker id="s-title" x={86} y={86}>Limited Edition</Sticker>
      <Sticker id="s-emoji-1" x={384} y={92}>🔥</Sticker>
      <Sticker id="s-emoji-2" x={448} y={132}>✨📌</Sticker>
      <Sticker id="s-note-1" x={102} y={172}>Focus Mode</Sticker>
      <Sticker id="s-note-2" x={264} y={214}>No Distractions</Sticker>
      <Sticker id="s-note-3" x={516} y={236} rotation={-4}>Top Priority</Sticker>

      <Sticker id="s-photo" x={640} y={86}>
        <Image src={photoDataUri} alt="Deco photo" width={170} height={124} />
      </Sticker>

      <Sticker id="s-svg" x={646} y={244}>
        <svg viewBox="0 0 120 100" width="120" height="100" aria-label="Inline badge">
          <path
            d="M60 6 L74 38 L108 38 L81 58 L92 92 L60 72 L28 92 L39 58 L12 38 L46 38 Z"
            fill="#fde047"
            stroke="#1e3a8a"
            strokeWidth="6"
          />
        </svg>
      </Sticker>

      <Sticker id="s-tag-1" x={90} y={286}>#daily</Sticker>
      <Sticker id="s-tag-2" x={202} y={304}>#routine</Sticker>
      <Sticker id="s-tag-3" x={320} y={326} rotation={3}>#ship-it</Sticker>
      <Sticker id="s-tag-4" x={432} y={292}>#focus</Sticker>
      <Sticker id="s-tag-5" x={548} y={320}>#done</Sticker>
      <Sticker id="s-tag-6" x={730} y={354}>💯</Sticker>
    </Canvas>
  );
}
```

## Best Practices

1. **Always use unique IDs** for all elements with id prop
2. **Use semantic IDs** that describe the element's purpose
3. **Prefer relative positioning** with `anchor`/`position`/`gap` for maintainable layouts
4. **Use Markdown** for rich content in mind map nodes
5. **Do not add emojis** unless the user explicitly requests them
6. **Emoji exception for Sticker decoration** - If the user intent is decoration (`꾸미기/deco/journal/scrapbook`), emoji use is allowed and recommended inside Sticker compositions
7. **Sticker practical mix** - For usable decoration results, combine text + emoji + inline SVG/Image instead of relying on a single content type
8. **Prefer Markdown outside Sticker** - Put rich markdown content in `Node`/`Markdown` components, not inside Sticker
9. **Limit explicit Sticker rotation** - Keep explicit `rotation` on only 1-2 stickers; rely on auto jitter for the rest
10. **Group related content** using comments in JSX
11. **Use consistent styling** with Tailwind utility classes
12. **Keep node content concise** - use child nodes for detailed breakdowns
13. **Split large MindMaps into multiple smaller ones** - Rather than cramming everything into one huge MindMap, separate by topic or section. This makes hierarchies clearer and improves readability. Use `anchor` positioning to arrange them spatially.
14. **Use `bubble` for semantic zoom** - Add `bubble` prop to root nodes and level 1-2 children so section titles remain visible when zoomed out. Skip bubbles on level 4+ detail nodes to avoid visual clutter.
15. **Use `EmbedScope` for reusable components** - When the same component pattern is used multiple times, wrap each instance in `<EmbedScope id="...">` to isolate IDs. Internal `anchor` references resolve automatically within the scope. Use dot notation (e.g., `"auth.app"`) for cross-scope references.

## File Structure

Magam files are TypeScript/TSX files that export a React component:

```tsx
import { Canvas, MindMap, Node, Text, Markdown, Sticker, Image } from '@magam/core';

export default function MyDiagram() {
  return (
    <Canvas>
      {/* Diagram content */}
    </Canvas>
  );
}
```

Files are typically placed in an `examples/` directory with descriptive names like `architecture.tsx`, `mindmap.tsx`, `overview.tsx`.
