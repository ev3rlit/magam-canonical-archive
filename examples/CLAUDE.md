# CLAUDE.md

Example `.tsx` files that demonstrate Magam components and patterns. These are user-facing reference implementations.

## File Format

Every example follows this pattern:

```tsx
import { Canvas, /* components */ } from '@magam/core';

export default function ExampleName() {
  return (
    <Canvas>
      {/* content */}
    </Canvas>
  );
}
```

Rules:
- Must default-export a function returning a `<Canvas>` element
- Import components from `@magam/core`
- Tailwind class names in `className` props are stored as strings (not compiled CSS)

## Example Files

| File | Demonstrates |
|------|-------------|
| `mindmap.tsx` | Basic MindMap: plain text, Text, Markdown, Code blocks, tables. Multiple layouts (tree, bidirectional, radial) |
| `mindmap-markdown.tsx` | Markdown features: headers, bold/italic, lists, code blocks, tables, checklists, blockquotes |
| `styling.tsx` | Tailwind CSS: sizing (width/height/className), colors, gradients, glass effects, shadows, borders |
| `anchor_positioning.tsx` | Relative positioning: cardinal directions (top/bottom/left/right), diagonals (top-left/top-right), chaining, gap control |
| `node_links.tsx` | `node:/mindmapId/nodeId` URI scheme for inter-node navigation |
| `embed_scope.tsx` | EmbedScope for ID namespacing, reusable components, cross-scope edges |
| `bubble.tsx` | Semantic zoom: `bubble` prop for floating labels at low zoom levels |
| `overview.tsx` | Mixed layout: Sticky notes, Shapes, Text, Edges with absolute positioning |
| `multiple_mindmaps.tsx` | Multiple independent MindMaps on one Canvas with different positions and layouts |
| `text_usage.tsx` | Text content patterns: label prop, plain text children, Text component, Markdown inside nodes |
| `font_hierarchy.tsx` | Font priority demo: global(default) inheritance, optional canvas-level override, object-level `fontFamily` override |
| `icons.tsx` | Emoji usage in Shape and MindMap nodes |
| `tinyurl_architecture.tsx` | System architecture diagram using Shapes with anchor positioning |
| `TODO.tsx` | Complex roadmap: multiple anchored MindMaps, rich Markdown, `bubble` prop, Korean text |
| `readme.tsx` | Project philosophy, AI-first workflow, code-based diagram concept |
| `washi_tape.tsx` | Washi tape object patterns and placements: preset/solid/svg/image + polar/segment/attach |

## Positioning Approaches

1. **Absolute** — `x={400} y={250}` on Shape/Sticky/Text
2. **Anchor-based** — `anchor="nodeId" position="right" gap={80}` relative to another node
3. **MindMap-relative** — `from="parentNodeId"` within a MindMap (layout engine handles positioning)

## Anchor Chaining

Anchors can chain: node A at absolute position, node B anchored to A, node C anchored to B. Only the root node needs coordinates.
