import { chartExampleManifest } from './chart/manifest';
import { chartExampleDefaults } from './chart';
import { tableExampleManifest } from './table/manifest';
import { tableExampleDefaults } from './table';
import type { ExamplePluginManifest } from './types';
import type {
  PluginExportDescriptor,
  PluginInstanceConfig,
  PluginVersionRegistration,
} from '../types';
import type { PluginRuntimeRegistry } from '../registry';
import { getDefaultChartExampleContent } from '@/features/editing/defaultContent';

const defaultChartContent = getDefaultChartExampleContent();

export interface ExamplePluginCatalogEntry {
  manifest: ExamplePluginManifest;
  defaults: Record<string, unknown>;
}

export const examplePluginCatalog: ExamplePluginCatalogEntry[] = [
  {
    manifest: chartExampleManifest,
    defaults: { ...chartExampleDefaults },
  },
  {
    manifest: tableExampleManifest,
    defaults: { ...tableExampleDefaults },
  },
];

export function getExamplePluginByExportName(exportName: string): ExamplePluginCatalogEntry | null {
  return examplePluginCatalog.find((entry) => entry.manifest.exportName === exportName) ?? null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function buildChartHtml(instance: PluginInstanceConfig): string {
  const props = {
    ...chartExampleDefaults,
    ...readRecord(instance.props),
  };
  const title = typeof props.title === 'string' ? props.title : chartExampleDefaults.title;
  const series = Array.isArray(props.series) ? props.series : chartExampleDefaults.series;
  const palette = Array.isArray(props.palette) && props.palette.length > 0
    ? props.palette.filter((item): item is string => typeof item === 'string')
    : chartExampleDefaults.palette || ['#0ea5e9'];
  const maxValue = Math.max(
    1,
    ...series.map((row) => {
      const value = readRecord(row).value;
      return typeof value === 'number' ? value : 0;
    }),
  );

  const bars = series.map((row, index) => {
    const item = readRecord(row);
    const label = typeof item.label === 'string' ? item.label : defaultChartContent.fallbackSeriesLabel(index);
    const value = typeof item.value === 'number' ? item.value : 0;
    const height = Math.max(8, Math.round((value / maxValue) * 100));
    const color = palette[index % palette.length];
    return `<li class="bar-item">
  <span class="bar-value">${escapeHtml(String(value))}</span>
  <span class="bar-visual" style="height:${height}%;background:${escapeHtml(color)};"></span>
  <span class="bar-label">${escapeHtml(label)}</span>
</li>`;
  }).join('');

  return `<section class="chart-widget">
  <header>${escapeHtml(title)}</header>
  <ul class="bar-list">${bars}</ul>
</section>`;
}

function buildTableHtml(instance: PluginInstanceConfig): string {
  const props = {
    ...tableExampleDefaults,
    ...readRecord(instance.props),
  };
  const columns = Array.isArray(props.columns)
    ? props.columns.filter((value): value is string => typeof value === 'string')
    : tableExampleDefaults.columns;
  const rows = Array.isArray(props.rows) ? props.rows.map(readRecord) : tableExampleDefaults.rows;
  const dense = props.dense === true;

  const header = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
  const body = rows.map((row) => {
    const cells = columns.map((column) => `<td>${escapeHtml(String(row[column] ?? ''))}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<section class="table-widget ${dense ? 'dense' : ''}">
  <table>
    <thead><tr>${header}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</section>`;
}

function createChartDescriptor(entry: ExamplePluginCatalogEntry): PluginExportDescriptor {
  const { manifest } = entry;
  return {
    packageName: manifest.packageName,
    version: manifest.version,
    exportName: manifest.exportName,
    displayName: manifest.displayName,
    capabilities: manifest.capabilities,
    render: ({ instance }) => ({
      html: buildChartHtml(instance),
      css: `
.chart-widget{height:100%;display:flex;flex-direction:column;gap:10px;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff}
.chart-widget header{font:600 11px/1.2 ui-sans-serif,system-ui;color:#64748b;text-transform:uppercase;letter-spacing:.08em}
.bar-list{display:flex;align-items:flex-end;gap:8px;list-style:none;padding:0;margin:0;flex:1}
.bar-item{display:flex;flex:1;min-width:0;flex-direction:column;align-items:center;gap:4px}
.bar-value,.bar-label{font-size:10px;color:#64748b}
.bar-visual{display:block;width:100%;min-height:8px;border-radius:4px}
`,
      script: `
const root = document.getElementById('plugin-root');
if (root) {
  const nextHeight = Math.max(180, root.scrollHeight + 12);
  window.MagamHost.requestResize({ height: nextHeight });
}
`,
      initialHeight: 220,
    }),
  };
}

function createTableDescriptor(entry: ExamplePluginCatalogEntry): PluginExportDescriptor {
  const { manifest } = entry;
  return {
    packageName: manifest.packageName,
    version: manifest.version,
    exportName: manifest.exportName,
    displayName: manifest.displayName,
    capabilities: manifest.capabilities,
    render: ({ instance }) => ({
      html: buildTableHtml(instance),
      css: `
.table-widget{height:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;overflow:auto}
.table-widget table{width:100%;border-collapse:collapse;font:500 11px/1.35 ui-sans-serif,system-ui}
.table-widget thead{background:#f8fafc}
.table-widget th,.table-widget td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;color:#334155}
.table-widget.dense th,.table-widget.dense td{padding:4px 8px}
`,
      script: `
const root = document.getElementById('plugin-root');
if (root) {
  const nextHeight = Math.max(160, root.scrollHeight + 8);
  window.MagamHost.requestResize({ height: nextHeight });
}
`,
      initialHeight: 220,
    }),
  };
}

function toPluginVersionRegistration(entry: ExamplePluginCatalogEntry): PluginVersionRegistration {
  const descriptor = entry.manifest.exportName === chartExampleManifest.exportName
    ? createChartDescriptor(entry)
    : createTableDescriptor(entry);

  return {
    packageName: entry.manifest.packageName,
    version: entry.manifest.version,
    exports: [descriptor],
  };
}

export function registerExamplePluginCatalog(registry: PluginRuntimeRegistry): void {
  examplePluginCatalog.forEach((entry) => {
    registry.registerVersion(toPluginVersionRegistration(entry));
  });
}
