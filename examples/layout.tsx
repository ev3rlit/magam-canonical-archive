import { Canvas, MindMap, Node, Text, Markdown } from '@magam/core';

// Layout Strategy Comparison
// The same mind map structure rendered with tree and bidirectional layouts

function DesignSystemNodes({ label }: { label: string }) {
  return (
    <>
      <Node id="root">
        <Markdown>{`# Design System
*${label}*`}</Markdown>
      </Node>

      <Node id="foundations" from="root">
        <Text className="font-bold">Foundations</Text>
      </Node>
      <Node id="colors" from="foundations">Colors</Node>
      <Node id="typography" from="foundations">Typography</Node>
      <Node id="spacing" from="foundations">Spacing</Node>

      <Node id="components" from="root">
        <Text className="font-bold">Components</Text>
      </Node>
      <Node id="buttons" from="components">Buttons</Node>
      <Node id="inputs" from="components">Inputs</Node>
      <Node id="cards" from="components">Cards</Node>
      <Node id="modals" from="components">Modals</Node>

      <Node id="patterns" from="root">
        <Text className="font-bold">Patterns</Text>
      </Node>
      <Node id="forms" from="patterns">Forms</Node>
      <Node id="navigation" from="patterns">Navigation</Node>
      <Node id="data-display" from="patterns">Data Display</Node>
    </>
  );
}

export default function LayoutComparison() {
  return (
    <Canvas>
      {/* Tree layout (unidirectional, left to right) */}
      <MindMap id="tree-map" layout="tree">
        <DesignSystemNodes label='layout="tree"' />
      </MindMap>

      {/* Bidirectional layout (children split left and right) */}
      <MindMap id="bidir-map" layout="bidirectional" x={0} y={500}>
        <DesignSystemNodes label='layout="bidirectional"' />
      </MindMap>
    </Canvas>
  );
}
