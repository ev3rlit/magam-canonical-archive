import type { CreatePayload } from './commands';
import { getAppMessages } from '@/features/i18n';

export function getDefaultNodeIdSeed(nodeType: CreatePayload['nodeType']): string {
  const { nodeIdSeeds } = getAppMessages().defaultContent;
  return nodeIdSeeds[nodeType] ?? nodeType;
}

export function getDefaultNodeContent(nodeType: CreatePayload['nodeType']): string | undefined {
  const { nodeContent } = getAppMessages().defaultContent;

  switch (nodeType) {
    case 'shape':
      return nodeContent.shape;
    case 'text':
      return nodeContent.text;
    case 'markdown':
      return nodeContent.markdown;
    case 'sticky':
      return nodeContent.sticky;
    case 'sticker':
      return nodeContent.sticker;
    default:
      return undefined;
  }
}

export function getDefaultImageSource(): string {
  return getAppMessages().defaultContent.imageSource;
}

export function getDefaultPluginInstanceDisplayName(): string {
  return getAppMessages().defaultContent.pluginDisplayName;
}

export function getDefaultChartExampleContent() {
  const pluginExamples = getAppMessages().defaultContent.pluginExamples;
  return {
    title: pluginExamples.chartTitle,
    seriesLabels: pluginExamples.chartSeriesLabels,
    fallbackSeriesLabel: pluginExamples.chartFallbackSeriesLabel,
  };
}
