import { Canvas, MindMap, Node, Text, Markdown } from '@magam/core';

/**
 * MindMap Features Example
 * 
 * Showcases the main features of Magam MindMap
 */
export default function MindMapFeaturesExample() {
  return (
    <Canvas>
      <Text id="mindmap-features-a.seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
      <MindMap id="mindmap-features-a" layout="bidirectional">
        {/* Root node */}
        <Node
          id="mindmap"
          from={{ node: 'mindmap-features-a.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}
        >
          🧠 MindMap Features
        </Node>

        {/* Node types */}
        <Node id="node-types" from="mindmap">Node Types</Node>
        <Node id="basic-node" from="node-types">Plain Text</Node>
        <Node id="text-node" from="node-types">
          <Text>With Text Component</Text>
          <Text>Multiple Lines</Text>
        </Node>
        <Node id="markdown-node" from="node-types">
          <Markdown>{`
**Markdown** supported!
- Bold, *italic*
- Lists, \`code\`
                    `}</Markdown>
        </Node>

        {/* Markdown features */}
        <Node id="md-features" from="mindmap">Markdown Features</Node>

        <Node id="code-block" from="md-features">
          <Markdown>{`
\`\`\`typescript
function hello() {
  return "world";
}
\`\`\`
                    `}</Markdown>
        </Node>

        <Node id="table" from="md-features">
          <Markdown>{`
| Method | Path |
|--------|------|
| GET | /api/users |
| POST | /api/users |
                    `}</Markdown>
        </Node>

        {/* Layout options */}
        <Node id="layouts" from="mindmap">Layout Options</Node>
        <Node id="tree-layout" from="layouts">Tree (Horizontal)</Node>
        <Node id="radial-layout" from="layouts">Radial (Circular)</Node>

        {/* Connections */}
        <Node id="connections" from="mindmap">Connections</Node>
        <Node id="from-prop" from="connections">Use from prop</Node>
        <Node id="auto-edges" from="connections">Auto edge generation</Node>
      </MindMap>

      <Text id="mindmap-features-b.seed" x={12} y={12} className="text-[1px] text-transparent select-none">.</Text>
      <MindMap id="mindmap-features-b" layout="bidirectional">
        {/* Root node */}
        <Node
          id="mindmap"
          from={{ node: 'mindmap-features-b.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}
        >
          🧠 MindMap Features
        </Node>

        {/* Node types */}
        <Node id="node-types" from="mindmap">Node Types</Node>
        <Node id="basic-node" from="node-types">Plain Text</Node>
        <Node id="text-node" from="node-types">
          <Text>With Text Component</Text>
          <Text>Multiple Lines</Text>
        </Node>
        <Node id="markdown-node" from="node-types">
          <Markdown>{`
**Markdown** supported!
- Bold, *italic*
- Lists, \`code\`
                    `}</Markdown>
        </Node>

        {/* Markdown features */}
        <Node id="md-features" from="mindmap">Markdown Features</Node>

        <Node id="code-block" from="md-features">
          <Markdown>{`
\`\`\`typescript
function hello() {
  return "world";
}
\`\`\`
                    `}</Markdown>
        </Node>

        <Node id="table" from="md-features">
          <Markdown>{`
| Method | Path |
|--------|------|
| GET | /api/users |
| POST | /api/users |
                    `}</Markdown>
        </Node>

        {/* Layout options */}
        <Node id="layouts" from="mindmap">Layout Options</Node>
        <Node id="tree-layout" from="layouts">Tree (Horizontal)</Node>
        <Node id="radial-layout" from="layouts">Radial (Circular)</Node>

        {/* Connections */}
        <Node id="connections" from="mindmap">Connections</Node>
        <Node id="from-prop" from="connections">Use from prop</Node>
        <Node id="auto-edges" from="connections">Auto edge generation</Node>
      </MindMap>
    </Canvas>
  );
}
