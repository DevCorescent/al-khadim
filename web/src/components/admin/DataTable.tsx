'use client';
import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Plus, Upload, Download } from 'lucide-react';
import { clsx } from 'clsx';
import ExportMenu from './ExportMenu';
import ImportCSVModal, { ImportField } from './ImportCSVModal';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
  /** Plain-value accessor used for export when render() returns JSX (badges, etc). Defaults to row[key]. */
  exportValue?: (row: any) => string | number | boolean | null | undefined;
}

interface ImportConfig {
  endpoint: string;
  fields: ImportField[];
  transformRow?: (row: Record<string, any>) => Record<string, any>;
}

interface DataTableProps {
  title: string;
  columns: Column[];
  data: any[];
  total?: number;
  page?: number;
  limit?: number;
  isLoading?: boolean;
  onSearch?: (q: string) => void;
  onPageChange?: (page: number) => void;
  onAdd?: () => void;
  /** Override the built-in export dropdown entirely with a custom handler. Usually leave unset — export works automatically off columns+data. */
  onExport?: () => void;
  /** Filename (without extension/date) for the built-in CSV/XLSX/PDF export. Defaults to a slug of the title. */
  exportFilename?: string;
  /** Enables the "Import" button (CSV/XLSX upload -> bulk POST) when provided. */
  importConfig?: ImportConfig;
  onImportDone?: () => void;
  addLabel?: string;
  actions?: (row: any) => React.ReactNode;
  extraActions?: React.ReactNode;
}

export default function DataTable({
  title, columns, data, total = 0, page = 1, limit = 20,
  isLoading, onSearch, onPageChange, onAdd, onExport, exportFilename, importConfig, onImportDone,
  addLabel = 'Add New', actions, extraActions,
}: DataTableProps) {
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const totalPages = Math.ceil(total / limit);
  const cleanTitle = title.replace(/\s*\(\d+\)\s*$/, '');

  const handleSearch = (q: string) => {
    setSearch(q);
    onSearch?.(q);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onSearch && (
            <div className="relative flex-1 sm:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-full sm:w-52 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          )}
          {onExport ? (
            <button onClick={onExport} title="Export" className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Download size={14} className="text-gray-600" />
            </button>
          ) : (
            <ExportMenu columns={columns} data={data} filename={exportFilename || cleanTitle} title={cleanTitle} disabled={isLoading} />
          )}
          {importConfig && (
            <button onClick={() => setImportOpen(true)} title="Import" className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Upload size={14} className="text-gray-600" />
            </button>
          )}
          {extraActions}
          {onAdd && (
            <button onClick={onAdd} className="btn-primary text-sm py-2 px-4">
              <Plus size={14} /> {addLabel}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={clsx('text-left text-xs font-medium text-gray-500 px-6 py-3', col.className)}>
                  {col.label}
                </th>
              ))}
              {actions && <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                  {actions && <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-100 rounded animate-pulse" /></td>}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center text-gray-400">
                  No records found
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={row.id || i} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className={clsx('px-6 py-4 text-gray-700', col.className)}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {actions && <td className="px-6 py-4">{actions(row)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <span>Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs">Page {page} of {totalPages}</span>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {importConfig && (
        <ImportCSVModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          title={cleanTitle}
          endpoint={importConfig.endpoint}
          fields={importConfig.fields}
          transformRow={importConfig.transformRow}
          onDone={onImportDone}
        />
      )}
    </div>
  );
}
