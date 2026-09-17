'use client';
import ExportMenu from '../ExportMenu';
import { ToolResultEvent } from './types';

interface ToolResultTableProps {
  result: ToolResultEvent;
  conversationTitle?: string | null;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'ai-report'
  );
}

export default function ToolResultTable({ result, conversationTitle }: ToolResultTableProps) {
  const { summary, table } = result;
  const filename = slugify(conversationTitle || summary || 'ai-report');

  return (
    <div className="max-w-[95%] rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
      <div className="flex items-start justify-between gap-2 px-3.5 py-2.5 border-b border-gray-100 bg-gray-50/60">
        <p className="text-xs text-gray-600 leading-snug">{summary}</p>
        {table && table.rows?.length > 0 && (
          <ExportMenu
            columns={table.columns}
            data={table.rows}
            filename={filename}
            title={summary}
          />
        )}
      </div>

      {table && table.rows?.length > 0 && (
        <div className="overflow-x-auto max-h-64">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {table.columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left font-semibold text-gray-500 px-3 py-2 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {table.rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  {table.columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {formatCell(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatCell(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return value.name || value.label || value.title || JSON.stringify(value);
  return String(value);
}
