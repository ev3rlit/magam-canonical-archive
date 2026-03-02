import {
  Canvas,
  Edge,
  MindMap,
  Node,
  Shape,
  Sticker,
  Sticky,
  Text,
} from '@magam/core';

/**
 * Font Hierarchy Example
 *
 * 1) Default/global font: open this file as-is (inherits global preset).
 * 2) Canvas custom font: uncomment `fontFamily` on <Canvas>.
 * 3) Object font override: see per-node `fontFamily` props below.
 */
export default function FontHierarchyExample() {
  return (
    <Canvas
      // Canvas-level override sample:
      // fontFamily="hand-caveat"
    >
      <Text id="font-title" x={56} y={24} className="text-2xl font-bold text-slate-800">
        Font Hierarchy Sample
      </Text>
      <Text id="font-guide" x={56} y={62} className="text-sm text-slate-500">
        Global (default) -&gt; Canvas (optional) -&gt; Node
      </Text>

      {/* Global/Canvas inherited */}
      <Shape id="inherit-shape" x={60} y={110} width={220} height={96}>
        Inherit global/canvas
      </Shape>
      <Sticky id="inherit-sticky" x={328} y={110}>
        Inherit global/canvas
      </Sticky>
      <Sticker id="inherit-sticker" x={560} y={126}>
        Inherit global/canvas
      </Sticker>
      <Edge
        id="inherit-edge"
        from="inherit-shape"
        to="inherit-sticky"
        label="Edge label inherits too"
      />

      {/* Object-level overrides */}
      <Shape
        id="override-shape"
        x={60}
        y={248}
        width={220}
        height={96}
        fontFamily="sans-inter"
      >
        Node override: sans-inter
      </Shape>
      <Text id="override-text" x={328} y={260} fontFamily="hand-caveat">
        Node override: hand-caveat
      </Text>
      <Sticky id="override-sticky" x={328} y={292} fontFamily="hand-gaegu">
        Node override: hand-gaegu
      </Sticky>
      <Sticker id="override-sticker" x={560} y={266} fontFamily="sans-inter">
        Sticker override: sans-inter
      </Sticker>
      <Edge
        id="override-edge"
        from="override-shape"
        to="override-sticky"
        label="Edge override: hand-caveat"
        fontFamily="hand-caveat"
      />

      {/* MindMap node-level override */}
      <Text id="font-map.seed" x={60} y={432} className="text-[1px] text-transparent select-none">.</Text>
      <MindMap id="font-map" x={60} y={432} layout="tree" spacing={90}>
        <Node id="root" from={{ node: 'font-map.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
          MindMap inherit
        </Node>
        <Node id="child-a" from="root">Inherit global/canvas</Node>
        <Node id="child-b" from="root" fontFamily="sans-inter">
          Node override sans-inter
        </Node>
        <Node id="child-c" from="root" fontFamily="hand-caveat">
          Node override hand-caveat
        </Node>
      </MindMap>
    </Canvas>
  );
}
