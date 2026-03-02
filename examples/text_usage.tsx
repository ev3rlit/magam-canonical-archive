import { Canvas, Shape, MindMap, Node, Text, Markdown } from '@magam/core';

/**
 * Text Usage Example
 * 
 * Demonstrates all the ways to add text content in Magam
 */
export default function TextUsageExample() {
    return (
        <Canvas>
            {/* ===== 1. Standalone Text ===== */}
            <Text id="section-1" x={50} y={30}>1. Standalone Text</Text>

            <Text id="simple" x={50} y={70}>Simple text on canvas</Text>
            <Text id="styled" x={50} y={100} className="text-xl font-bold text-blue-600">
                Styled with className
            </Text>

            {/* ===== 2. Shape with text children ===== */}
            <Text id="section-2" x={50} y={170}>2. Shape with text children</Text>

            <Shape id="label-1" x={50} y={210}>Using text child</Shape>
            <Shape id="label-2" x={250} y={210}>{`Multi-line\nWith \\n`}</Shape>

            {/* ===== 3. Shape with plain text child ===== */}
            <Text id="section-3" x={50} y={330}>3. Shape with plain text child</Text>

            <Shape id="plain-1" x={50} y={370}>Plain text child</Shape>
            <Shape id="plain-2" x={250} y={370}>🚀 With emoji</Shape>

            {/* ===== 4. Shape with Text component child ===== */}
            <Text id="section-4" x={50} y={490}>4. Shape with Text children</Text>

            <Shape id="text-1" x={50} y={530}>
                <Text>Single Text component</Text>
            </Shape>
            <Shape id="text-2" x={250} y={530}>
                <Text>Title</Text>
                <Text>Subtitle</Text>
            </Shape>
            <Shape id="text-3" x={450} y={530}>
                <Text className="font-bold">Styled Title</Text>
                <Text className="text-sm text-gray-500">Gray subtitle</Text>
            </Shape>

            {/* ===== 5. MindMap Node text ===== */}
            <Text id="text-map.seed" x={50} y={680} className="text-[1px] text-transparent select-none">.</Text>
            <MindMap id="text-map" x={50} y={680} layout="tree">
                <Node id="mm-title" from={{ node: 'text-map.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    5. MindMap Node text
                </Node>

                <Node id="mm-plain" from="mm-title">Plain text</Node>
                <Node id="mm-emoji" from="mm-title">🎯 With emoji</Node>
                <Node id="mm-text" from="mm-title">
                    <Text>Text component</Text>
                </Node>
                <Node id="mm-multi" from="mm-title">
                    <Text>Line 1</Text>
                    <Text>Line 2</Text>
                </Node>
            </MindMap>

            {/* ===== 6. Markdown in Node ===== */}
            <Text id="markdown-map.seed" x={500} y={680} className="text-[1px] text-transparent select-none">.</Text>
            <MindMap id="markdown-map" x={500} y={680} layout="tree">
                <Node id="md-title" from={{ node: 'markdown-map.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    6. Markdown
                </Node>

                <Node id="md-basic" from="md-title">
                    <Markdown>{`**Bold** and *italic*`}</Markdown>
                </Node>
                <Node id="md-list" from="md-title">
                    <Markdown>{`
- Item 1
- Item 2
                    `}</Markdown>
                </Node>
                <Node id="md-code" from="md-title">
                    <Markdown>{`\`inline code\``}</Markdown>
                </Node>
            </MindMap>
        </Canvas>
    );
}
