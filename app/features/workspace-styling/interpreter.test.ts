import { describe, expect, it } from 'bun:test';
import { resolveEligibleObjectProfile } from './eligibility';
import { interpretWorkspaceStyle } from './interpreter';
import type {
  EligibleObjectProfile,
  WorkspaceStyleInput,
  WorkspaceStyleRuntimeContext,
} from './types';

function makeInput(overrides?: Partial<WorkspaceStyleInput>): WorkspaceStyleInput {
  return {
    objectId: 'node-1',
    className: 'w-32 bg-slate-100 shadow-md ring-2',
    sourceRevision: 'rev-1',
    timestamp: 1_000,
    groupId: undefined,
    ...overrides,
  };
}

function makeEligibleProfile(overrides?: Partial<EligibleObjectProfile>): EligibleObjectProfile {
  return {
    objectId: 'node-1',
    hasClassNameSurface: true,
    supportsStylingProps: true,
    supportsSizeProps: true,
    isEligible: true,
    ...overrides,
  };
}

function makeRuntimeContext(
  overrides?: Partial<WorkspaceStyleRuntimeContext>,
): WorkspaceStyleRuntimeContext {
  return {
    colorScheme: 'light',
    viewportWidth: 640,
    ...overrides,
  };
}

describe('workspace-styling/interpreter', () => {
  it('returns reset when className is empty', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({ className: '   ' }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result).toMatchObject({
      status: 'reset',
      appliedTokens: [],
      ignoredTokens: [],
    });
    expect(interpreted.diagnostics).toEqual([]);
  });

  it('returns unsupported + diagnostic for out-of-scope objects', () => {
    const profile = resolveEligibleObjectProfile({
      objectId: 'node-1',
      capabilities: {
        hasClassNameSurface: false,
        supportsStylingProps: true,
        supportsSizeProps: true,
      },
    });
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput(),
      eligibleProfile: profile,
    });

    expect(interpreted.result.status).toBe('unsupported');
    expect(interpreted.diagnostics).toHaveLength(1);
    expect(interpreted.diagnostics[0]).toMatchObject({
      code: 'OUT_OF_SCOPE_OBJECT',
      severity: 'warning',
    });
  });

  it('applies supported category tokens and returns deterministic category order', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'ring-2 shadow-md bg-slate-100 w-32',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.appliedCategories).toEqual([
      'size',
      'basic-visual',
      'shadow-elevation',
      'outline-emphasis',
    ]);
    expect(interpreted.result.appliedTokens).toEqual([
      'w-32',
      'bg-slate-100',
      'shadow-md',
      'ring-2',
    ]);
    expect(interpreted.result.resolvedStylePayload?.style).toMatchObject({
      width: '8rem',
      backgroundColor: '#f1f5f9',
    });
    expect(String(interpreted.result.resolvedStylePayload?.style.boxShadow)).toContain('#6366f1');
    expect(interpreted.diagnostics).toEqual([]);
  });

  it('supports arbitrary values for priority categories', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'w-[320px] bg-[#1f2937] border-2 border-white rounded-xl',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.resolvedStylePayload?.style).toMatchObject({
      width: '320px',
      backgroundColor: '#1f2937',
      borderWidth: '2px',
      borderColor: 'white',
      borderRadius: '0.75rem',
    });
  });

  it('applies expanded typography, spacing, alpha, and border tokens', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'bg-white/80 text-lg font-semibold italic tracking-[0.15em] px-4 py-2 m-auto gap-2 border-l-4 border-dashed border-violet-500',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.appliedCategories).toEqual(['basic-visual']);
    expect(interpreted.result.resolvedStylePayload?.style).toMatchObject({
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      fontSize: '1.125rem',
      fontWeight: 600,
      fontStyle: 'italic',
      letterSpacing: '0.15em',
      paddingLeft: '1rem',
      paddingRight: '1rem',
      paddingTop: '0.5rem',
      paddingBottom: '0.5rem',
      margin: 'auto',
      gap: '0.5rem',
      borderLeftWidth: '4px',
      borderStyle: 'dashed',
      borderColor: '#8b5cf6',
      borderWidth: '1px',
    });
  });

  it('supports font family aliases and not-italic reset tokens', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'text-sm font-mono not-italic tracking-wide',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.resolvedStylePayload?.style).toMatchObject({
      fontSize: '0.875rem',
      fontFamily: 'monospace',
      fontStyle: 'normal',
      letterSpacing: '0.025em',
    });
  });

  it('activates dark and md variants only when runtime context matches', () => {
    const darkAndWide = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'dark:bg-slate-900 md:w-64 md:ring-2',
      }),
      eligibleProfile: makeEligibleProfile(),
      runtimeContext: makeRuntimeContext({
        colorScheme: 'dark',
        viewportWidth: 960,
      }),
    });

    expect(darkAndWide.result.status).toBe('applied');
    expect(darkAndWide.result.appliedTokens).toEqual([
      'md:w-64',
      'dark:bg-slate-900',
      'md:ring-2',
    ]);
    expect(darkAndWide.result.resolvedStylePayload?.style).toMatchObject({
      backgroundColor: '#0f172a',
      width: '16rem',
    });
    expect(String(darkAndWide.result.resolvedStylePayload?.style.boxShadow)).toContain('#6366f1');

    const lightAndNarrow = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'dark:bg-slate-900 md:w-64',
      }),
      eligibleProfile: makeEligibleProfile(),
      runtimeContext: makeRuntimeContext(),
    });

    expect(lightAndNarrow.result.status).toBe('applied');
    expect(lightAndNarrow.result.appliedTokens).toEqual([
      'md:w-64',
      'dark:bg-slate-900',
    ]);
    expect(lightAndNarrow.result.appliedCategories).toEqual([]);
    expect(lightAndNarrow.result.resolvedStylePayload?.style).toEqual({});
    expect(lightAndNarrow.diagnostics).toEqual([]);
  });

  it('supports lg and xl breakpoints in the runtime context', () => {
    const desktop = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'md:w-48 lg:w-72 xl:w-96',
      }),
      eligibleProfile: makeEligibleProfile(),
      runtimeContext: makeRuntimeContext({
        viewportWidth: 1366,
      }),
    });

    expect(desktop.result.status).toBe('applied');
    expect(desktop.result.appliedTokens).toEqual([
      'md:w-48',
      'lg:w-72',
      'xl:w-96',
    ]);
    expect(desktop.result.resolvedStylePayload?.style).toMatchObject({
      width: '24rem',
    });

    const tablet = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'md:w-48 lg:w-72 xl:w-96',
      }),
      eligibleProfile: makeEligibleProfile(),
      runtimeContext: makeRuntimeContext({
        viewportWidth: 900,
      }),
    });

    expect(tablet.result.resolvedStylePayload?.style).toMatchObject({
      width: '12rem',
    });
  });

  it('emits hover style payload separately from base style', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white lg:hover:ring-2 lg:hover:ring-cyan-500',
      }),
      eligibleProfile: makeEligibleProfile(),
      runtimeContext: makeRuntimeContext({
        viewportWidth: 1280,
      }),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.appliedTokens).toEqual([
      'bg-slate-100',
      'text-slate-700',
      'hover:bg-slate-900',
      'hover:text-white',
      'lg:hover:ring-2',
      'lg:hover:ring-cyan-500',
    ]);
    expect(interpreted.result.resolvedStylePayload?.style).toMatchObject({
      backgroundColor: '#f1f5f9',
      color: '#334155',
    });
    expect(interpreted.result.resolvedStylePayload?.hoverStyle).toMatchObject({
      backgroundColor: '#0f172a',
      color: 'white',
    });
    expect(String(interpreted.result.resolvedStylePayload?.hoverStyle?.boxShadow)).toContain('#06b6d4');
  });

  it('emits focus style payload separately from base style', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'bg-amber-100 text-slate-700 focus:bg-amber-200 focus:text-slate-900 focus:ring-4 focus:ring-amber-500 focus:outline-dotted focus:outline-offset-4',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.appliedTokens).toEqual([
      'bg-amber-100',
      'text-slate-700',
      'focus:bg-amber-200',
      'focus:text-slate-900',
      'focus:ring-4',
      'focus:ring-amber-500',
      'focus:outline-dotted',
      'focus:outline-offset-4',
    ]);
    expect(interpreted.result.resolvedStylePayload?.style).toMatchObject({
      backgroundColor: '#fef3c7',
      color: '#334155',
    });
    expect(interpreted.result.resolvedStylePayload?.focusStyle).toMatchObject({
      backgroundColor: '#fde68a',
      color: '#0f172a',
      outlineStyle: 'dotted',
      outlineOffset: '4px',
    });
    expect(String(interpreted.result.resolvedStylePayload?.focusStyle?.boxShadow)).toContain('#f59e0b');
  });

  it('emits active style payload separately from base style', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'bg-violet-100 text-slate-700 active:bg-violet-500 active:text-white active:ring-4 active:ring-violet-500 active:shadow-xl',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.appliedTokens).toEqual([
      'bg-violet-100',
      'text-slate-700',
      'active:bg-violet-500',
      'active:text-white',
      'active:shadow-xl',
      'active:ring-4',
      'active:ring-violet-500',
    ]);
    expect(interpreted.result.resolvedStylePayload?.style).toMatchObject({
      backgroundColor: '#ede9fe',
      color: '#334155',
    });
    expect(interpreted.result.resolvedStylePayload?.activeStyle).toMatchObject({
      backgroundColor: '#8b5cf6',
      color: 'white',
    });
    expect(String(interpreted.result.resolvedStylePayload?.activeStyle?.boxShadow)).toContain('#8b5cf6');
  });

  it('emits group-hover style payload for grouped nodes', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'bg-cyan-100 text-slate-700 group-hover:bg-cyan-300 group-hover:ring-2 group-hover:ring-cyan-500',
        groupId: 'map-1',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.appliedTokens).toEqual([
      'bg-cyan-100',
      'text-slate-700',
      'group-hover:bg-cyan-300',
      'group-hover:ring-2',
      'group-hover:ring-cyan-500',
    ]);
    expect(interpreted.result.resolvedStylePayload?.style).toMatchObject({
      backgroundColor: '#cffafe',
      color: '#334155',
    });
    expect(interpreted.result.resolvedStylePayload?.groupHoverStyle).toMatchObject({
      backgroundColor: '#67e8f9',
    });
    expect(String(interpreted.result.resolvedStylePayload?.groupHoverStyle?.boxShadow)).toContain('#06b6d4');
  });

  it('supports finer shadow and outline utilities', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'shadow-inner shadow-violet-500/40 ring-inset ring-[5px] ring-cyan-500 ring-offset-2 ring-offset-slate-100 outline-dotted outline-offset-4',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('applied');
    expect(interpreted.result.appliedCategories).toEqual([
      'shadow-elevation',
      'outline-emphasis',
    ]);
    expect(interpreted.result.resolvedStylePayload?.style).toMatchObject({
      outlineStyle: 'dotted',
      outlineOffset: '4px',
    });
    expect(String(interpreted.result.resolvedStylePayload?.style.boxShadow)).toContain('0 0 0 2px #f1f5f9');
    expect(String(interpreted.result.resolvedStylePayload?.style.boxShadow)).toContain('inset 0 0 0 7px #06b6d4');
    expect(String(interpreted.result.resolvedStylePayload?.style.boxShadow)).toContain('rgba(139, 92, 246, 0.4)');
  });

  it('returns partial and mixed diagnostics for mixed input', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'w-20 foo-bar hover:bg-red-100 shadow-sm',
      }),
      eligibleProfile: makeEligibleProfile(),
      runtimeContext: makeRuntimeContext({
        viewportWidth: 640,
      }),
    });

    expect(interpreted.result.status).toBe('partial');
    expect(interpreted.result.appliedTokens).toEqual(['w-20', 'hover:bg-red-100', 'shadow-sm']);
    expect(interpreted.result.ignoredTokens).toEqual(['foo-bar']);
    expect(interpreted.diagnostics.map((item) => item.code)).toEqual([
      'UNSUPPORTED_CATEGORY',
      'MIXED_INPUT',
    ]);
  });

  it('diagnoses group-hover tokens on nodes without group identity', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'group-hover:bg-cyan-300 shadow-sm',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('partial');
    expect(interpreted.result.appliedTokens).toEqual(['shadow-sm']);
    expect(interpreted.result.ignoredTokens).toEqual(['group-hover:bg-cyan-300']);
    expect(interpreted.diagnostics.map((item) => item.code)).toEqual([
      'UNSUPPORTED_TOKEN',
      'MIXED_INPUT',
    ]);
  });

  it('rejects multiple interaction variants on a single token', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'hover:active:ring-2 bg-slate-100',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('partial');
    expect(interpreted.result.appliedTokens).toEqual(['bg-slate-100']);
    expect(interpreted.result.ignoredTokens).toEqual(['hover:active:ring-2']);
    expect(interpreted.diagnostics.map((item) => item.code)).toEqual([
      'UNSUPPORTED_TOKEN',
      'MIXED_INPUT',
    ]);
  });

  it('returns unsupported when no token is applicable', () => {
    const interpreted = interpretWorkspaceStyle({
      styleInput: makeInput({
        className: 'foo-bar md:unknown baz',
      }),
      eligibleProfile: makeEligibleProfile(),
    });

    expect(interpreted.result.status).toBe('unsupported');
    expect(interpreted.result.appliedTokens).toEqual([]);
    expect(interpreted.result.ignoredTokens).toEqual(['foo-bar', 'md:unknown', 'baz']);
    expect(interpreted.diagnostics.length).toBeGreaterThan(0);
  });
});
