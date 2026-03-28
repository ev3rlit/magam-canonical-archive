import type { Node } from 'reactflow';

export type SearchMode = 'global' | 'page';
export type SearchResultType = 'element';
export type MatchKind = 'exact' | 'prefix' | 'contains';

export interface SearchIndexElementItem {
  type: 'element';
  elementId: string;
  elementType: string;
  canvasId: string | null;
  labelPlain: string;
  searchableText: string;
}

export interface SearchResult {
  type: SearchResultType;
  key: string;
  title: string;
  subtitle?: string;
  canvasId?: string;
  score: number;
  matchKind: MatchKind;
}

interface BuildSearchResultsParams {
  nodes: Node[];
  currentCanvasId: string | null;
  query: string;
  mode: SearchMode;
  maxResults?: number;
}

const SEARCH_SCORE = {
  exact: 100,
  prefix: 70,
  contains: 40,
} as const;

const normalizeCache = new Map<string, string>();

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

export const normalize = (value: string): string => {
  const cached = normalizeCache.get(value);
  if (cached !== undefined) {
    return cached;
  }

  const normalized = value
    .toLowerCase()
    .trim();

  normalizeCache.set(value, normalized);
  return normalized;
};

export const getMatchKind = (text: string, query: string): MatchKind | undefined => {
  const normalizedText = normalize(text);
  const normalizedQuery = normalize(query);

  if (!normalizedText || !normalizedQuery) {
    return undefined;
  }

  if (normalizedText === normalizedQuery) {
    return 'exact';
  }

  if (normalizedText.startsWith(normalizedQuery)) {
    return 'prefix';
  }

  if (normalizedText.includes(normalizedQuery)) {
    return 'contains';
  }

  return undefined;
};

export const buildSearchIndex = (nodes: Node[], currentCanvasId: string | null): SearchIndexElementItem[] => {
  const nodeItems: SearchIndexElementItem[] = nodes.map((node) => {
    const data = (node as Node<Record<string, unknown>>).data || {};
    const sourceMeta = (data as { sourceMeta?: { canvasId?: unknown } }).sourceMeta;
    const canvasId = typeof sourceMeta?.canvasId === 'string'
      ? sourceMeta.canvasId
      : currentCanvasId;
    const label = [
      toText(data.label),
      toText(data.title),
      toText((data as { content?: string }).content),
      toText(data.text),
      toText(data.type),
      toText((data as { nodeType?: string }).nodeType),
      toText((data as { kind?: string }).kind),
    ].filter(Boolean).join(' | ');

    return {
      type: 'element',
      elementId: node.id,
      elementType: toText((data as { type?: string }).type || node.type),
      canvasId,
      labelPlain: label || node.id,
      searchableText: [
        node.id,
        node.type,
        (data as { type?: string }).type,
        label,
      ].filter(Boolean).join(' ').toLowerCase(),
    };
  });

  return nodeItems;
};

const sortSearchResults = (results: SearchResult[], currentCanvasId: string | null): SearchResult[] => {
  return results.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    const aCurrent = a.canvasId === currentCanvasId ? 1 : 0;
    const bCurrent = b.canvasId === currentCanvasId ? 1 : 0;
    if (aCurrent !== bCurrent) {
      return bCurrent - aCurrent;
    }

    if (a.title.length !== b.title.length) {
      return a.title.length - b.title.length;
    }

    return a.title.localeCompare(b.title);
  });
};

const buildElementResult = (item: SearchIndexElementItem, query: string): SearchResult | null => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return null;
  }

  const candidates = [
    item.elementId,
    item.labelPlain,
    item.elementType,
    item.canvasId ?? '',
    item.searchableText,
  ];

  let bestMatch: MatchKind | undefined;

  for (const candidate of candidates) {
    const match = getMatchKind(candidate, normalizedQuery);
    if (match === 'exact') {
      bestMatch = 'exact';
      break;
    }

    if (!bestMatch && (match === 'prefix' || match === 'contains')) {
      bestMatch = match;
    }
  }

  if (!bestMatch) {
    return null;
  }

  const matchScore = SEARCH_SCORE[bestMatch];
  const idBonus = getMatchKind(item.elementId, normalizedQuery) ? 10 : 0;

  return {
    type: 'element',
    key: item.elementId,
    title: item.labelPlain,
    subtitle: `${item.elementType}${item.canvasId ? ` · ${item.canvasId}` : ''}`,
    canvasId: item.canvasId ?? undefined,
    score: matchScore + idBonus,
    matchKind: bestMatch,
  };
};

export const buildSearchResults = ({
  nodes,
  currentCanvasId,
  query,
  mode,
  maxResults = 30,
}: BuildSearchResultsParams): SearchResult[] => {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return [];
  }

  const elementItems = buildSearchIndex(nodes, currentCanvasId)
    .map((item) => buildElementResult(item, normalizedQuery))
    .filter((item): item is SearchResult => item !== null);

  return sortSearchResults(elementItems, currentCanvasId).slice(0, maxResults);
};
