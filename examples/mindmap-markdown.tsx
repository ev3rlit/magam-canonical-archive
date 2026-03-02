import { Canvas, MindMap, Node, Markdown, Text } from '@magam/core';

/**
 * Markdown Showcase Example
 * 
 * Demonstrates all Markdown features available in Magam
 */
export default function MarkdownShowcaseExample() {
    return (
        <Canvas>
            <Text id="markdown-showcase.seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <MindMap id="markdown-showcase" layout="tree" spacing={100}>

                {/* Root: Magam */}
                <Node id="root" from={{ node: 'markdown-showcase.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown>
                        {`# 📝 Magam

> **Describe, Don't Draw.**

Create diagrams with *code* and **AI**.`}
                    </Markdown>
                </Node>

                {/* Features with Lists */}
                <Node id="features" from="root">
                    <Markdown>
                        {`## ✨ Features

- **Declarative Syntax**
- *AI-First* Design  
- React Components
- Markdown Support
- Live File Sync`}
                    </Markdown>
                </Node>

                {/* Code Block */}
                <Node id="code" from="root">
                    <Markdown>
                        {`## 💻 Code Example

\`\`\`tsx
<MindMap layout="tree">
  <Node id="root">
    Hello World
  </Node>
  <Node id="child" from="root">
    Child Node
  </Node>
</MindMap>
\`\`\``}
                    </Markdown>
                </Node>

                {/* Table */}
                <Node id="components" from="root">
                    <Markdown>
                        {`## 🧩 Components

| Name | Description |
|------|-------------|
| \`Canvas\` | Root container |
| \`Shape\` | Rectangle node |
| \`MindMap\` | Auto-layout tree |
| \`Node\` | MindMap node |
| \`Edge\` | Connection line |`}
                    </Markdown>
                </Node>

                {/* Blockquote & Links */}
                <Node id="philosophy" from="root">
                    <Markdown>
                        {`## 💡 Philosophy

> Knowledge work should be
> **describing intent**, not drawing.

\`Inline code\` is also supported.`}
                    </Markdown>
                </Node>

                {/* Nested List */}
                <Node id="layouts" from="features">
                    <Markdown>
                        {`### Layout Options

1. **Tree** (horizontal)
2. **Radial** (circular)  
3. **Vertical** (top-down)

---

*Powered by ELK.js*`}
                    </Markdown>
                </Node>

                {/* Checklist */}
                <Node id="roadmap" from="features">
                    <Markdown>
                        {`### Roadmap

- [x] MindMap Component
- [x] Markdown Support
- [x] File Sync
- [ ] Export to PNG
- [ ] Obsidian Plugin`}
                    </Markdown>
                </Node>

            </MindMap>
        </Canvas>
    );
}
