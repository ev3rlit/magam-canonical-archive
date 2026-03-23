import { chartExampleManifest } from './manifest';
import type { ExamplePluginModule } from '../types';
import { getDefaultChartExampleContent } from '@/features/editing/defaultContent';

export interface ChartSeriesItem {
  label: string;
  value: number;
}

export interface ChartWidgetProps {
  title: string;
  series: ChartSeriesItem[];
  palette?: string[];
}

const defaultChartContent = getDefaultChartExampleContent();

export const chartExampleDefaults: ChartWidgetProps = {
  title: defaultChartContent.title,
  series: [
    { label: defaultChartContent.seriesLabels[0] ?? defaultChartContent.fallbackSeriesLabel(0), value: 12 },
    { label: defaultChartContent.seriesLabels[1] ?? defaultChartContent.fallbackSeriesLabel(1), value: 18 },
    { label: defaultChartContent.seriesLabels[2] ?? defaultChartContent.fallbackSeriesLabel(2), value: 9 },
    { label: defaultChartContent.seriesLabels[3] ?? defaultChartContent.fallbackSeriesLabel(3), value: 22 },
  ],
  palette: ['#0f766e', '#0ea5e9', '#f97316', '#84cc16'],
};

export function ChartExampleWidget(props: ChartWidgetProps) {
  const max = Math.max(...props.series.map((item) => item.value), 1);
  const palette = props.palette && props.palette.length > 0 ? props.palette : chartExampleDefaults.palette!;

  return (
    <section data-plugin-export={chartExampleManifest.exportName} className="flex h-full w-full flex-col gap-3 rounded-md border border-slate-200 bg-white p-3">
      <header className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.title}</header>
      <ul className="flex flex-1 items-end gap-2">
        {props.series.map((item, index) => {
          const heightPercent = Math.max((item.value / max) * 100, 6);
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-slate-500">{item.value}</span>
              <span
                className="w-full rounded-sm"
                style={{
                  height: `${heightPercent}%`,
                  minHeight: '8px',
                  backgroundColor: palette[index % palette.length],
                }}
              />
              <span className="truncate text-[10px] text-slate-600">{item.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const chartExampleModule: ExamplePluginModule<ChartWidgetProps> = {
  manifest: chartExampleManifest,
  defaults: chartExampleDefaults,
};
