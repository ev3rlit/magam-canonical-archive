import { tableExampleManifest } from './manifest';
import type { ExamplePluginModule } from '../types';

export interface TableWidgetProps {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  dense?: boolean;
}

export const tableExampleDefaults: TableWidgetProps = {
  columns: ['Task', 'Owner', 'Status'],
  rows: [
    { Task: 'Design runtime bridge', Owner: 'Core', Status: 'Done' },
    { Task: 'Wire plugin instance mutation', Owner: 'Server', Status: 'In progress' },
    { Task: 'Add fallback diagnostics', Owner: 'UI', Status: 'Todo' },
  ],
  dense: false,
};

export function TableExampleWidget(props: TableWidgetProps) {
  return (
    <section data-plugin-export={tableExampleManifest.exportName} className="h-full w-full overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="h-full w-full border-collapse text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {props.columns.map((column) => (
              <th key={column} className="border-b border-slate-200 px-2 py-2 font-semibold">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="align-top">
              {props.columns.map((column) => (
                <td
                  key={`${rowIndex}-${column}`}
                  className={props.dense ? 'border-b border-slate-100 px-2 py-1 text-slate-700' : 'border-b border-slate-100 px-2 py-2 text-slate-700'}
                >
                  {String(row[column] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export const tableExampleModule: ExamplePluginModule<TableWidgetProps> = {
  manifest: tableExampleManifest,
  defaults: tableExampleDefaults,
};
