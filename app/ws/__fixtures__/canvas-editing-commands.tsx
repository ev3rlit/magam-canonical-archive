export const CANVAS_EDITING_COMMANDS_FIXTURE_TSX = `
export default function CanvasEditingCommandsFixture() {
  return (
    <Canvas>
      <Node id="shape-1" x={40} y={80} label={"Primary shape"} fill={"#f8fafc"} stroke={"#0f172a"} />
      <Text id="text-1" x={240} y={120}>Standalone text</Text>
      <Node id="doc-1" x={420} y={120}>
        <Markdown>{\`# Start\\ncontent\`}</Markdown>
      </Node>
      <Sticker id="sticker-1" x={120} y={260} outlineColor={"#ffffff"} outlineWidth={4} shadow={"md"} padding={8}>
        Sticker
      </Sticker>
      <WashiTape
        id="washi-1"
        at={{ type: "attach", target: "shape-1", placement: "top", span: 0.8, align: 0.5, offset: 12 }}
        pattern={{ type: "preset", id: "pastel-dots" }}
        opacity={0.9}
      />
      <MindMap id="map-1">
        <Node id="root">Root</Node>
        <Node id="child" from="root">Child</Node>
      </MindMap>
    </Canvas>
  );
}
`;
