import { describe, expect, it } from 'bun:test';
import {
  classifyToken,
  classifyTokens,
  getClassCategoryDefinitions,
  getCategoryPriority,
  isSupportedVariant,
  resolveTokenCategory,
  sortCategoriesByPriority,
} from './classCategories';

describe('workspace-styling/classCategories', () => {
  it('contains all mandatory v1 categories with unique priorities', () => {
    const definitions = getClassCategoryDefinitions();
    const categories = definitions.map((item) => item.category);
    expect(categories).toEqual([
      'size',
      'basic-visual',
      'shadow-elevation',
      'outline-emphasis',
    ]);

    const priorities = definitions.map((item) => item.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it('resolves category from base tokens', () => {
    expect(resolveTokenCategory('w-32')).toBe('size');
    expect(resolveTokenCategory('bg-slate-100')).toBe('basic-visual');
    expect(resolveTokenCategory('text-sm')).toBe('basic-visual');
    expect(resolveTokenCategory('px-4')).toBe('basic-visual');
    expect(resolveTokenCategory('font-semibold')).toBe('basic-visual');
    expect(resolveTokenCategory('tracking-wide')).toBe('basic-visual');
    expect(resolveTokenCategory('border-l-4')).toBe('basic-visual');
    expect(resolveTokenCategory('shadow-lg')).toBe('shadow-elevation');
    expect(resolveTokenCategory('ring-2')).toBe('outline-emphasis');
    expect(resolveTokenCategory('unknown-token')).toBeNull();
  });

  it('accepts supported runtime variants', () => {
    const classified = classifyToken('lg:group-hover:w-32');
    expect(classified.category).toBe('size');
    expect(classified.supported).toBe(true);
    expect(classified.variants).toEqual(['lg', 'group-hover']);
    expect(classified.baseToken).toBe('w-32');
  });

  it('keeps unsupported runtime variants rejected', () => {
    expect(isSupportedVariant('dark')).toBe(true);
    expect(isSupportedVariant('md')).toBe(true);
    expect(isSupportedVariant('lg')).toBe(true);
    expect(isSupportedVariant('hover')).toBe(true);
    expect(isSupportedVariant('focus')).toBe(true);
    expect(isSupportedVariant('active')).toBe(true);
    expect(isSupportedVariant('group-hover')).toBe(true);
    expect(isSupportedVariant('peer-hover')).toBe(false);
    expect(classifyToken('peer-hover:bg-slate-100')).toMatchObject({
      category: 'basic-visual',
      supported: false,
      variants: ['peer-hover'],
      baseToken: 'bg-slate-100',
    });
  });

  it('classifies plain supported tokens', () => {
    expect(classifyToken('shadow-md')).toMatchObject({
      category: 'shadow-elevation',
      supported: true,
      variants: [],
      baseToken: 'shadow-md',
    });
  });

  it('sorts categories by deterministic priority', () => {
    expect(sortCategoriesByPriority(['outline-emphasis', 'size', 'shadow-elevation'])).toEqual([
      'size',
      'shadow-elevation',
      'outline-emphasis',
    ]);
    expect(getCategoryPriority('size')).toBeLessThan(getCategoryPriority('outline-emphasis'));
  });

  it('filters empty tokens in classifyTokens', () => {
    const result = classifyTokens(['  w-10 ', '', '   ', 'border', 'shadow-sm']);
    expect(result.map((item) => item.baseToken)).toEqual(['w-10', 'border', 'shadow-sm']);
  });
});
