# Magam (마감)

> Archive notice: this repository preserves the canonical object / DB-first canvas-first Magam line that was split out on April 2, 2026 for archival and retrospective purposes.
> The active `magam` repository may continue on a different product direction.

> **"The future of knowledge work is not 'drawing' but 'describing'."**

![Magam Example](./assets/readme.png)

Magam is a **programmable whiteboard for AI agent collaboration**.

### Why "마감"?

**마감**(magam) carries layered meanings in Korean:

- **감각적인 마인드맵** — *Ma* from mind map, *Gam* from 감각(sense). A sensory canvas for your thinking.
- **My Gam (나의 감각)** — Your personal sense, your way of seeing the world, externalized.
- **마감 = completion** — Not the stress of a deadline, but the aesthetics of finishing. The satisfaction of shaping raw thoughts into something whole.

This app is a space to freely unfold your ideas, expressions, notes, and learning. Thoughts, knowledge, study — everything you carry in your head — spread across an infinite canvas and take shape. That process of expanding and completing your thinking: that's 마감.

Diagrams defined in code are **faster than hand-drawing, clearer in intent, and easier to archive**.
This app is designed **AI-First**, not Mobile-First.

## Installation

```
Install the skill from https://github.com/ev3rlit/magam
```

## Philosophy

- **Describe, don't draw** — Tell the AI what you want; it writes React code that renders as diagrams
- **Code as archive** — All visuals are stored as readable, versionable React code
- **Auto-layout** — ELK engine handles positioning; you focus on logic

## Usage

Ask your AI agent to create diagrams:

```
"Create a mind map about microservices architecture"
"Draw a flowchart for user authentication"
"Visualize this system design as a tree diagram"
```

For detailed API and examples, ask the AI with `/magam`:

```
/magam show me the Node API
/magam create a simple mind map example
```

## Examples

| File | Description |
|------|-------------|
| `mindmap.tsx` | MindMap features: node types, markdown, layouts |
| `styling.tsx` | Styling & sizing with Tailwind CSS |
| `icons.tsx` | Using emoji icons in Shapes and MindMap |
| `anchor_positioning.tsx` | Relative positioning with anchors |
| `node_links.tsx` | Node linking and edge examples |
| `multiple_mindmaps.tsx` | Multiple MindMaps on one canvas |
| `bubble.tsx` | Semantic Zoom: Bubble Label Example |

**Describe in words, archive in code. Magam draws for you.**
