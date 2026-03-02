import { Canvas, MindMap, Node, Markdown, Text } from '@magam/core';

/**
 * Node Links Example
 * 
 * Navigate to other nodes using the node: scheme.
 * 
 * Syntax: [link text](node:/mindmapId/nodeId)
 */
export default function NodeLinks() {
    return (
        <Canvas>
            <Text id="main.seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <MindMap id="main" layout="bidirectional">
                <Node id="title" from={{ node: 'main.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown>{`
# Node Link Navigation

Navigate sequentially through the mindmap

[Get Started →](node:/main/intro)
          `}</Markdown>
                </Node>

                <Node id="intro" from="title">
                    <Markdown>{`
## 1. Introduction

Create interactive documents with Magam.

**Next Steps:**
- [View Core Concepts](node:/main/concepts)
- [View Examples](node:/main/examples)
          `}</Markdown>
                </Node>

                <Node id="concepts" from="intro">
                    <Markdown>{`
## 2. Core Concepts

- **Canvas**: Infinite canvas
- **MindMap**: Automatic node layout
- **Node**: Content container

[← Previous](node:/main/intro) | [Examples →](node:/main/examples)
          `}</Markdown>
                </Node>

                <Node id="examples" from="concepts">
                    <Markdown>{`
## 3. Examples

Using links in markdown:
\`\`\`markdown
[Next Section](node:/main/nodeId)
\`\`\`

[← Previous](node:/main/concepts) | [Conclusion →](node:/main/conclusion)
          `}</Markdown>
                </Node>

                <Node id="conclusion" from="title">
                    <Markdown>{`
## 4. Conclusion

Sequential navigation is possible with node links!

[Back to Start](node:/main/title)
          `}</Markdown>
                </Node>
            </MindMap>
        </Canvas>
    );
}
