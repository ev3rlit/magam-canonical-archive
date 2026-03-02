import { Canvas, MindMap, Node, Markdown, Text } from '@magam/core';

// Multiple MindMaps Feature Showcase
// Demonstrates placing multiple independent MindMaps on a single Canvas

export default function MultipleMindMapsShowcase() {
    return (
        <Canvas>
            <Text id="features.seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <Text id="usecases.seed" x={700} y={-50} className="text-[1px] text-transparent select-none">.</Text>
            <Text id="start.seed" x={0} y={350} className="text-[1px] text-transparent select-none">.</Text>

            {/* First MindMap: Feature Overview - Using bidirectional layout */}
            <MindMap id="features" layout="bidirectional">
                <Node id="root" from={{ node: 'features.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown>{`# 🚀 Multiple MindMaps
**New Feature**`}</Markdown>
                </Node>

                <Node id="scoped" from="root">
                    <Markdown>{`### 🔒 Scoped IDs
Each MindMap has its own
ID namespace. No conflicts!`}</Markdown>
                </Node>

                <Node id="position" from="root">
                    <Markdown>{`### 📍 Flexible Positioning
- Default: \`(0, 0)\`
- Custom: \`x={600}\``}</Markdown>
                </Node>

                <Node id="layout" from="root">
                    <Markdown>{`### 🎨 Per-Map Layout
Each map can use:
- \`tree\`
- \`bidirectional\`
- \`radial\``}</Markdown>
                </Node>

                <Node id="dot" from="root">
                    <Markdown>{`### 🔗 Dot Notation
Cross-map references:
\`map1.nodeId\``}</Markdown>
                </Node>
            </MindMap>

            {/* Second MindMap: Use Cases - Positioned to the right */}
            <MindMap id="usecases" layout="tree" x={700} y={-50}>
                <Node id="root" from={{ node: 'usecases.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown>{`## 💡 Use Cases`}</Markdown>
                </Node>

                <Node id="complex" from="root">
                    <Markdown>{`**Complex Topics**
Break large subjects into
smaller, focused maps`}</Markdown>
                </Node>

                <Node id="compare" from="root">
                    <Markdown>{`**Comparison**
Side-by-side analysis
of different approaches`}</Markdown>
                </Node>

                <Node id="modular" from="root">
                    <Markdown>{`**Modular Design**
Separate concerns into
independent structures`}</Markdown>
                </Node>
            </MindMap>

            {/* Third MindMap: Getting Started - Positioned below */}
            <MindMap id="start" layout="tree" x={0} y={350}>
                <Node id="root" from={{ node: 'start.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown>{`## 📖 Getting Started`}</Markdown>
                </Node>

                <Node id="step1" from="root">
                    <Markdown>{`**Step 1**
Add \`id\` prop to MindMap
\`\`\`tsx
<MindMap id="mymap">
\`\`\``}</Markdown>
                </Node>

                <Node id="step2" from="root">
                    <Markdown>{`**Step 2**
Position with \`x\` and \`y\`
\`\`\`tsx
<MindMap id="map2"
  x={600} y={0}>
\`\`\``}</Markdown>
                </Node>

                <Node id="step3" from="root">
                    <Markdown>{`**Step 3**
Connect across maps
\`\`\`tsx
<Edge from="map1.node"
      to="map2.node" />
\`\`\``}</Markdown>
                </Node>
            </MindMap>
        </Canvas>
    );
}
