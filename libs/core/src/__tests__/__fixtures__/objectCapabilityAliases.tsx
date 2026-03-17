export type PublicAliasName = 'Node' | 'Shape' | 'Sticky' | 'Image' | 'Markdown' | 'Sticker' | 'Sequence';

export interface PublicAliasFixture {
  id: string;
  alias: PublicAliasName;
  scenario: 'legacy-alias-inference' | 'explicit-overrides-preset' | 'sticky-semantic-preservation' | 'content-kind-mismatch';
  source: string;
  description: string;
}

export const LEGACY_ALIAS_INFERENCE_FIXTURE_TSX = `
export default function LegacyAliasInferenceFixture() {
  return (
    <Canvas>
      <Node id="legacy-node" text="legacy alias inference" x={8} y={12} />
    </Canvas>
  );
}
`;

export const EXPLICIT_PRESET_OVERRIDE_FIXTURE_TSX = `
export default function ExplicitOverridePresetFixture() {
  return (
    <Canvas>
      <Shape
        id="shape-override"
        x={20}
        y={24}
        type="rectangle"
        fill="#0f172a"
        stroke="#38bdf8"
        strokeWidth={3}
      />
    </Canvas>
  );
}
`;

export const STICKY_SEMANTIC_PRESERVATION_FIXTURE_TSX = `
export default function StickySemanticPreservationFixture() {
  return (
    <Canvas>
      <Sticky
        id="sticky-semantic"
        x={60}
        y={120}
        text="keep sticky-note semantic even if defaults are reduced"
      />
    </Canvas>
  );
}
`;

export const CONTENT_KIND_MISMATCH_FIXTURE_TSX = `
export default function ContentKindMismatchFixture() {
  return (
    <Canvas>
      <Image
        id="image-mismatch"
        x={10}
        y={10}
        src="https://example.com/media.png"
        alt="media"
        text="# mismatch should fail validation"
      />
    </Canvas>
  );
}
`;

export const OBJECT_CAPABILITY_ALIAS_FIXTURES: Record<string, PublicAliasFixture> = {
  legacyAliasInference: {
    id: 'legacy-alias-inference-topic',
    alias: 'Node',
    scenario: 'legacy-alias-inference',
    source: LEGACY_ALIAS_INFERENCE_FIXTURE_TSX,
    description: 'Legacy Node alias with text content inferred into canonical text content.',
  },
  explicitOverridePreset: {
    id: 'explicit-overrides-preset-shape-frame',
    alias: 'Shape',
    scenario: 'explicit-overrides-preset',
    source: EXPLICIT_PRESET_OVERRIDE_FIXTURE_TSX,
    description: 'Shape alias with explicit frame-related props should override preset defaults.',
  },
  stickySemanticPreservation: {
    id: 'sticky-semantic-preserved-with-removed-defaults',
    alias: 'Sticky',
    scenario: 'sticky-semantic-preservation',
    source: STICKY_SEMANTIC_PRESERVATION_FIXTURE_TSX,
    description: 'Sticky alias remains semantic sticky-note when style defaults are not fully present.',
  },
  contentKindMismatch: {
    id: 'content-kind-mismatch-input',
    alias: 'Image',
    scenario: 'content-kind-mismatch',
    source: CONTENT_KIND_MISMATCH_FIXTURE_TSX,
    description: 'Image alias with disallowed text payload should be rejected by content-kind contract.',
  },
};

export const OBJECT_CAPABILITY_ALIAS_FIXTURE_TSX = {
  legacyAliasInference: LEGACY_ALIAS_INFERENCE_FIXTURE_TSX,
  explicitOverridePreset: EXPLICIT_PRESET_OVERRIDE_FIXTURE_TSX,
  stickySemanticPreservation: STICKY_SEMANTIC_PRESERVATION_FIXTURE_TSX,
  contentKindMismatch: CONTENT_KIND_MISMATCH_FIXTURE_TSX,
} as const;
