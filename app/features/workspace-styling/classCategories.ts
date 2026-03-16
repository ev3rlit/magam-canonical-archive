import type {
  ClassCategoryDefinition,
  ClassifiedToken,
  WorkspaceStyleCategory,
} from './types';

const CATEGORY_DEFINITIONS: ClassCategoryDefinition[] = [
  {
    category: 'size',
    priority: 10,
    status: 'supported',
    tokenPatterns: ['w-*', 'h-*', 'min-w-*', 'min-h-*', 'max-w-*', 'max-h-*'],
  },
  {
    category: 'basic-visual',
    priority: 20,
    status: 'supported',
    tokenPatterns: [
      'bg-*',
      'text-*',
      'font-*',
      'italic',
      'not-italic',
      'tracking-*',
      'border*',
      'rounded*',
      'opacity-*',
      'p*',
      'm*',
      'gap-*',
    ],
  },
  {
    category: 'shadow-elevation',
    priority: 30,
    status: 'supported',
    tokenPatterns: ['shadow', 'shadow-*'],
  },
  {
    category: 'outline-emphasis',
    priority: 40,
    status: 'supported',
    tokenPatterns: ['outline*', 'ring*', 'ring-offset*'],
  },
];

const SIZE_TOKEN_PATTERN = /^(?:w|h|min-w|min-h|max-w|max-h)-.+$/;
const BASIC_VISUAL_TOKEN_PATTERN = /^(?:bg|text|font|tracking|opacity|gap)-.+$|^(?:italic|not-italic)$|^(?:border(?:-.+)?)$|^(?:rounded(?:-.+)?)$|^(?:[mp][trblxy]?-.+)$/;
const SHADOW_TOKEN_PATTERN = /^(?:shadow(?:-.+)?)$/;
const OUTLINE_TOKEN_PATTERN = /^(?:outline(?:-.+)?)$|^(?:ring(?:-.+)?)$|^(?:ring-offset(?:-.+)?)$/;
const SUPPORTED_VARIANTS = new Set(['hover', 'focus', 'active', 'group-hover', 'dark', 'md', 'lg', 'xl', '2xl']);

function splitVariants(token: string): { variants: string[]; baseToken: string } {
  const parts = token.split(':').filter((part) => part.length > 0);
  if (parts.length <= 1) {
    return {
      variants: [],
      baseToken: token,
    };
  }

  return {
    variants: parts.slice(0, -1),
    baseToken: parts[parts.length - 1],
  };
}

export function getClassCategoryDefinitions(): ClassCategoryDefinition[] {
  return CATEGORY_DEFINITIONS.map((definition) => ({
    ...definition,
    tokenPatterns: [...definition.tokenPatterns],
  }));
}

export function getCategoryPriority(category: WorkspaceStyleCategory): number {
  return CATEGORY_DEFINITIONS.find((definition) => definition.category === category)?.priority ?? Number.MAX_SAFE_INTEGER;
}

export function resolveTokenCategory(baseToken: string): WorkspaceStyleCategory | null {
  if (SIZE_TOKEN_PATTERN.test(baseToken)) return 'size';
  if (BASIC_VISUAL_TOKEN_PATTERN.test(baseToken)) return 'basic-visual';
  if (SHADOW_TOKEN_PATTERN.test(baseToken)) return 'shadow-elevation';
  if (OUTLINE_TOKEN_PATTERN.test(baseToken)) return 'outline-emphasis';
  return null;
}

export function isSupportedTokenInCategory(baseToken: string, category: WorkspaceStyleCategory): boolean {
  switch (category) {
    case 'size':
      return SIZE_TOKEN_PATTERN.test(baseToken);
    case 'basic-visual':
      return BASIC_VISUAL_TOKEN_PATTERN.test(baseToken);
    case 'shadow-elevation':
      return SHADOW_TOKEN_PATTERN.test(baseToken);
    case 'outline-emphasis':
      return OUTLINE_TOKEN_PATTERN.test(baseToken);
    default:
      return false;
  }
}

export function isSupportedVariant(variant: string): boolean {
  return SUPPORTED_VARIANTS.has(variant);
}

export function classifyToken(token: string): ClassifiedToken {
  const normalizedToken = token.trim();
  const { variants, baseToken } = splitVariants(normalizedToken);
  const category = resolveTokenCategory(baseToken);

  if (!category) {
    return {
      token: normalizedToken,
      baseToken,
      variants,
      category: null,
      supported: false,
    };
  }

  if (variants.length > 0 && variants.some((variant) => !isSupportedVariant(variant))) {
    return {
      token: normalizedToken,
      baseToken,
      variants,
      category,
      supported: false,
    };
  }

  return {
    token: normalizedToken,
    baseToken,
    variants,
    category,
    supported: isSupportedTokenInCategory(baseToken, category),
  };
}

export function classifyTokens(tokens: string[]): ClassifiedToken[] {
  return tokens
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => classifyToken(token));
}

export function sortCategoriesByPriority(categories: WorkspaceStyleCategory[]): WorkspaceStyleCategory[] {
  return [...categories].sort((left, right) => getCategoryPriority(left) - getCategoryPriority(right));
}
