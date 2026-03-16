import type {
  CanonicalCapabilityKey,
  CanonicalObject,
  CanonicalObjectAlias,
  NormalizationSource,
  ValidationResult,
} from '../canonicalObject';

export type CanonicalFixtureScenario =
  | 'legacy-alias-inference'
  | 'explicit-overrides-preset'
  | 'sticky-semantic-preservation'
  | 'content-kind-mismatch';

export interface CanonicalFixtureRenderNodeInput {
  type: string;
  props: Record<string, unknown>;
  children?: CanonicalFixtureRenderNodeInput[];
}

export interface CanonicalFixtureExpectedObject {
  semanticRole: CanonicalObject['semanticRole'];
  alias: CanonicalObject['alias'];
  capabilities?: Partial<CanonicalObject['capabilities']>;
  capabilitySources?: Partial<Record<CanonicalCapabilityKey, NormalizationSource>>;
  forbidCapabilities?: readonly CanonicalCapabilityKey[];
}

export interface CanonicalNormalizationFixture {
  readonly id: string;
  readonly scenario: CanonicalFixtureScenario;
  readonly input: {
    readonly alias: CanonicalObjectAlias;
    readonly node: CanonicalFixtureRenderNodeInput;
  };
  readonly expectedCanonical?: CanonicalFixtureExpectedObject;
  readonly expectedValidation?: ValidationResult;
}

export const LEGACY_ALIAS_INFERENCE_FIXTURE: CanonicalNormalizationFixture = {
  id: 'legacy-alias-inference-topic',
  scenario: 'legacy-alias-inference',
  input: {
    alias: 'Node',
    node: {
      type: 'graph-node',
      props: {
        id: 'legacy-topic',
        x: 8,
        y: 12,
        text: 'legacy alias inference',
      },
      children: [],
    },
  },
  expectedCanonical: {
    semanticRole: 'topic',
    alias: 'Node',
    capabilities: {
      content: {
        kind: 'text',
        value: 'legacy alias inference',
      },
    },
    capabilitySources: {
      content: 'explicit',
    },
  },
};

export const EXPLICIT_OVERRIDE_PRESET_FIXTURE: CanonicalNormalizationFixture = {
  id: 'explicit-overrides-preset-shape-frame',
  scenario: 'explicit-overrides-preset',
  input: {
    alias: 'Shape',
    node: {
      type: 'graph-shape',
      props: {
        id: 'shape-explicit-override',
        x: 20,
        y: 24,
        type: 'rectangle',
        fill: '#0f172a',
        stroke: '#38bdf8',
        strokeWidth: 3,
      },
      children: [],
    },
  },
  expectedCanonical: {
    semanticRole: 'shape',
    alias: 'Shape',
    capabilities: {
      frame: {
        shape: 'rectangle',
        fill: '#0f172a',
        stroke: '#38bdf8',
        strokeWidth: 3,
      },
    },
    capabilitySources: {
      frame: 'explicit',
    },
  },
};

export const STICKY_SEMANTIC_PRESERVATION_FIXTURE: CanonicalNormalizationFixture = {
  id: 'sticky-semantic-preserved-with-removed-defaults',
  scenario: 'sticky-semantic-preservation',
  input: {
    alias: 'Sticky',
    node: {
      type: 'graph-sticky',
      props: {
        id: 'sticky-semantic',
        x: 60,
        y: 120,
        text: 'keep sticky-note semantic even if defaults are reduced',
      },
      children: [],
    },
  },
  expectedCanonical: {
    semanticRole: 'sticky-note',
    alias: 'Sticky',
    capabilities: {
      content: {
        kind: 'text',
        value: 'keep sticky-note semantic even if defaults are reduced',
      },
    },
    capabilitySources: {
      content: 'explicit',
    },
  },
};

export const CONTENT_KIND_MISMATCH_FIXTURE: CanonicalNormalizationFixture = {
  id: 'content-kind-mismatch-input',
  scenario: 'content-kind-mismatch',
  input: {
    alias: 'Image',
    node: {
      type: 'graph-image',
      props: {
        id: 'image-mismatch',
        x: 10,
        y: 10,
        src: 'https://example.com/media.png',
        alt: 'media',
        text: '# mismatch should fail validation',
      },
      children: [],
    },
  },
  expectedValidation: {
    ok: false,
    code: 'CONTENT_CONTRACT_VIOLATION',
    path: 'capabilities.content',
    message: 'mixed media and non-media content sources',
  },
};

export const CANONICAL_OBJECT_FIXTURE_CATALOG: Record<string, CanonicalNormalizationFixture> = {
  [LEGACY_ALIAS_INFERENCE_FIXTURE.id]: LEGACY_ALIAS_INFERENCE_FIXTURE,
  [EXPLICIT_OVERRIDE_PRESET_FIXTURE.id]: EXPLICIT_OVERRIDE_PRESET_FIXTURE,
  [STICKY_SEMANTIC_PRESERVATION_FIXTURE.id]: STICKY_SEMANTIC_PRESERVATION_FIXTURE,
  [CONTENT_KIND_MISMATCH_FIXTURE.id]: CONTENT_KIND_MISMATCH_FIXTURE,
};

export const CANONICAL_OBJECT_FIXTURE_SETS = {
  legacyAliasInference: LEGACY_ALIAS_INFERENCE_FIXTURE,
  explicitOverridePreset: EXPLICIT_OVERRIDE_PRESET_FIXTURE,
  stickySemanticPreservation: STICKY_SEMANTIC_PRESERVATION_FIXTURE,
  contentKindMismatch: CONTENT_KIND_MISMATCH_FIXTURE,
} as const;
