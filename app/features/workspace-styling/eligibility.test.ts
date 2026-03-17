import { describe, expect, it } from 'bun:test';
import { resolveEligibleObjectProfile } from './eligibility';

describe('workspace-styling/eligibility', () => {
  it('returns eligible when className surface exists and style capability exists', () => {
    expect(resolveEligibleObjectProfile({
      objectId: 'node-1',
      capabilities: {
        hasClassNameSurface: true,
        supportsStylingProps: true,
        supportsSizeProps: false,
      },
    })).toEqual({
      objectId: 'node-1',
      hasClassNameSurface: true,
      supportsStylingProps: true,
      supportsSizeProps: false,
      isEligible: true,
    });
  });

  it('returns eligible when className surface exists and size capability exists', () => {
    expect(resolveEligibleObjectProfile({
      objectId: 'node-2',
      capabilities: {
        hasClassNameSurface: true,
        supportsStylingProps: false,
        supportsSizeProps: true,
      },
    })).toEqual({
      objectId: 'node-2',
      hasClassNameSurface: true,
      supportsStylingProps: false,
      supportsSizeProps: true,
      isEligible: true,
    });
  });

  it('returns eligible when only className surface exists', () => {
    expect(resolveEligibleObjectProfile({
      objectId: 'node-5',
      capabilities: {
        hasClassNameSurface: true,
        supportsStylingProps: false,
        supportsSizeProps: false,
      },
    })).toEqual({
      objectId: 'node-5',
      hasClassNameSurface: true,
      supportsStylingProps: false,
      supportsSizeProps: false,
      isEligible: true,
    });
  });

  it('returns out-of-scope for missing className surface', () => {
    expect(resolveEligibleObjectProfile({
      objectId: 'node-3',
      capabilities: {
        hasClassNameSurface: false,
        supportsStylingProps: true,
        supportsSizeProps: true,
      },
    })).toMatchObject({
      objectId: 'node-3',
      isEligible: false,
      reasonIfIneligible: 'MISSING_CLASSNAME_SURFACE',
    });
  });

  it('keeps className-surface objects eligible even when explicit style/size props are absent', () => {
    expect(resolveEligibleObjectProfile({
      objectId: 'node-4',
      capabilities: {
        hasClassNameSurface: true,
        supportsStylingProps: false,
        supportsSizeProps: false,
      },
    })).toMatchObject({
      objectId: 'node-4',
      isEligible: true,
    });
  });
});
