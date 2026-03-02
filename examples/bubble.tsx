import { Canvas, MindMap, Node, Shape, Markdown, Text } from '@magam/core';

/**
 * Semantic Zoom: Bubble Label Example
 * 
 * When zoomed out, nodes with the `bubble` prop display a floating label overlay.
 * The label text is auto-extracted from the first line of the content.
 * 
 * Test: Zoom out the canvas to maximum (zoom < 0.4) to see bubbles appear.
 */
export default function BubbleExample() {
    return (
        <Canvas>
            <Text id="features.seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
            {/* MindMap with bubble labels */}
            <MindMap id="features" layout="bidirectional">
                <Node id="root" from={{ node: 'features.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    <Markdown bubble>{`
# 🔍 Semantic Zoom

Display mode changes based on zoom level.
          `}</Markdown>
                </Node>

                {/* Left side: Basic Usage */}
                <Node id="basic" from="root">
                    <Markdown bubble>{`
## Basic Usage

Just add the \`bubble\` prop.
          `}</Markdown>
                </Node>

                <Node id="example1" from="basic" bubble>
                    <Text>Add bubble prop</Text>
                </Node>

                <Node id="example2" from="basic">
                    <Markdown bubble>{`
### Auto Extract

First line of label is shown in bubble.
          `}</Markdown>
                </Node>

                {/* Right side: How it Works */}
                <Node id="behavior" from="root">
                    <Markdown bubble>{`
## How It Works

Activates when \`zoom < 0.4\`
          `}</Markdown>
                </Node>

                <Node id="floating" from="behavior">
                    <Markdown bubble>{`
### Floating Overlay

Appears on top of original content.
          `}</Markdown>
                </Node>

                <Node id="truncation" from="behavior">
                    <Markdown bubble>{`
### 40 Char Truncation

Long text is auto-trimmed with ...
          `}</Markdown>
                </Node>

                <Node id="optin" from="behavior">
                    <Text>No bubble without prop</Text>
                </Node>
            </MindMap>
        </Canvas>
    );
}
