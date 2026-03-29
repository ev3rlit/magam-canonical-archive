export interface CreatedCanvasBootstrapInput {
  canvasId: string;
  sourceVersion: string;
  latestRevision: number | null;
}

export function resolveCreatedCanvasBootstrapGraph(
  input: CreatedCanvasBootstrapInput,
) {
  return {
    nodes: [],
    edges: [],
    sourceVersion: input.sourceVersion,
    canvasVersions: {
      [input.canvasId]: input.sourceVersion,
    },
    canvasRevisionsById: input.latestRevision === null
      ? {}
      : {
          [input.canvasId]: input.latestRevision,
        },
    assetBasePath: null,
  };
}
