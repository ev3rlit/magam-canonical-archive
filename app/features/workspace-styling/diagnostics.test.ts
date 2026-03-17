import { describe, expect, it } from 'bun:test';
import {
  createMixedInputDiagnostic,
  createOutOfScopeObjectDiagnostic,
  createStaleUpdateDiagnostic,
  createUnsupportedCategoryDiagnostic,
  createUnsupportedTokenDiagnostic,
  dedupeDiagnostics,
} from './diagnostics';

describe('workspace-styling/diagnostics', () => {
  it('creates out-of-scope diagnostic with warning severity', () => {
    const diagnostic = createOutOfScopeObjectDiagnostic({
      objectId: 'node-a',
      revision: 'rev-1',
      reason: 'MISSING_CLASSNAME_SURFACE',
    });

    expect(diagnostic).toMatchObject({
      objectId: 'node-a',
      revision: 'rev-1',
      code: 'OUT_OF_SCOPE_OBJECT',
      severity: 'warning',
    });
    expect(diagnostic.message).toContain('MISSING_CLASSNAME_SURFACE');
  });

  it('creates unsupported token/category diagnostics with token context', () => {
    expect(createUnsupportedCategoryDiagnostic({
      objectId: 'node-a',
      revision: 'rev-2',
      token: 'foo-bar',
    })).toMatchObject({
      code: 'UNSUPPORTED_CATEGORY',
      token: 'foo-bar',
      severity: 'warning',
    });

    expect(createUnsupportedTokenDiagnostic({
      objectId: 'node-a',
      revision: 'rev-2',
      token: 'peer-hover:w-4',
      category: 'size',
    })).toMatchObject({
      code: 'UNSUPPORTED_TOKEN',
      token: 'peer-hover:w-4',
      category: 'size',
      severity: 'warning',
    });
  });

  it('explains unsupported or conflicting variants in token diagnostics', () => {
    expect(createUnsupportedTokenDiagnostic({
      objectId: 'node-a',
      revision: 'rev-2',
      token: 'peer-hover:w-4',
      category: 'size',
    }).message).toContain('unsupported variant "peer-hover"');

    expect(createUnsupportedTokenDiagnostic({
      objectId: 'node-a',
      revision: 'rev-2',
      token: 'group-hover:w-4',
      category: 'size',
    }).message).toContain('requires a groupId-backed runtime group surface');

    expect(createUnsupportedTokenDiagnostic({
      objectId: 'node-a',
      revision: 'rev-2',
      token: 'hover:active:ring-2',
      category: 'outline-emphasis',
    }).message).toContain('multiple interaction variants');
  });

  it('creates mixed/stale diagnostics with info severity', () => {
    expect(createMixedInputDiagnostic({
      objectId: 'node-a',
      revision: 'rev-3',
      ignoredTokenCount: 2,
    })).toMatchObject({
      code: 'MIXED_INPUT',
      severity: 'info',
    });

    expect(createStaleUpdateDiagnostic({
      objectId: 'node-a',
      revision: 'rev-1',
      latestAcceptedRevision: 'rev-2',
    })).toMatchObject({
      code: 'STALE_UPDATE',
      severity: 'info',
    });
  });

  it('deduplicates diagnostics by object/revision/code/category/token', () => {
    const duplicate = createUnsupportedCategoryDiagnostic({
      objectId: 'node-a',
      revision: 'rev-2',
      token: 'foo-bar',
    });

    expect(dedupeDiagnostics([duplicate, duplicate])).toHaveLength(1);
  });
});
