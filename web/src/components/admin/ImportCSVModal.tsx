'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, Download, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import Modal from './Modal';

export interface ImportField {
  key: string;         // backend field name expected in the POST body
  label: string;        // shown in the template + preview header
  required?: boolean;
}

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  endpoint: string;                       // POST endpoint, e.g. '/candidates'
  fields: ImportField[];
  /** Adapt a raw parsed CSV row (keyed by column label) into the POST body. Defaults to a direct label->key mapping. */
  transformRow?: (row: Record<string, any>) => Record<string, any>;
  onDone?: () => void;
}

type RowResult = { row: number; ok: boolean; error?: string };

function parseFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      try {
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        const wb = isCsv
          ? XLSX.read(reader.result as string, { type: 'string' })
          : XLSX.read(reader.result as ArrayBuffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];
        resolve(json);
      } catch (err: any) {
        reject(new Error('Could not parse file — is it a valid CSV/XLSX export?'));
      }
    };
    if (file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

export default function ImportCSVModal({ isOpen, onClose, title, endpoint, fields, transformRow, onDone }: ImportCSVModalProps) {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);

  function reset() {
    setRows([]); setFileName(''); setResults(null); setImporting(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setResults(null);
    try {
      const parsed = await parseFile(file);
      if (!parsed.length) return toast.error('The file has no data rows');
      setRows(parsed);
      setFileName(file.name);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse file');
    }
  }

  function downloadTemplate() {
    const header = fields.map((f) => f.label).join(',') + '\r\n';
    const blob = new Blob(['﻿' + header], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-template.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function buildPayload(row: Record<string, any>) {
    if (transformRow) return transformRow(row);
    const payload: Record<string, any> = {};
    for (const f of fields) {
      // Match by exact label first, then case-insensitively, then by key.
      const val = row[f.label] ?? row[Object.keys(row).find((k) => k.toLowerCase() === f.label.toLowerCase()) || ''] ?? row[f.key];
      if (val !== undefined && val !== '') payload[f.key] = val;
    }
    return payload;
  }

  async function runImport() {
    const missing = fields.filter((f) => f.required).filter((f) =>
      !rows.some((r) => (r[f.label] ?? r[f.key] ?? '') !== '')
    );
    if (missing.length) {
      return toast.error(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.map((f) => f.label).join(', ')}`);
    }
    setImporting(true);
    const out: RowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        await api.post(endpoint, buildPayload(rows[i]));
        out.push({ row: i + 1, ok: true });
      } catch (err: any) {
        out.push({ row: i + 1, ok: false, error: err.response?.data?.error || err.message || 'Failed' });
      }
      setResults([...out]);
    }
    setImporting(false);
    const okCount = out.filter((r) => r.ok).length;
    if (okCount > 0) {
      toast.success(`Imported ${okCount} of ${rows.length} row${rows.length !== 1 ? 's' : ''}`);
      onDone?.();
    }
    if (okCount < rows.length) toast.error(`${rows.length - okCount} row(s) failed — see details below`);
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }} title={`Import ${title}`} size="lg">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
          <p className="text-xs text-blue-700">
            Upload a CSV or Excel file. Columns are matched by header name — download the template below to get the exact expected columns.
          </p>
          <button onClick={downloadTemplate} type="button" className="flex items-center gap-1.5 text-xs font-bold text-blue-700 shrink-0 hover:underline">
            <Download size={12} /> Template
          </button>
        </div>

        {!rows.length ? (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-10 cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors">
            <Upload size={22} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-600">Click to choose a CSV or XLSX file</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">{fileName} — {rows.length} row{rows.length !== 1 ? 's' : ''} detected</span>
              <button onClick={reset} type="button" className="flex items-center gap-1 text-gray-400 hover:text-red-500">
                <X size={12} /> Clear
              </button>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-auto max-h-56">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-gray-400 font-bold">#</th>
                    {Object.keys(rows[0]).map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left text-gray-500 font-bold whitespace-nowrap">{h}</th>
                    ))}
                    {results && <th className="px-2 py-1.5 text-left text-gray-400 font-bold">Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => {
                    const res = results?.[i];
                    return (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                        {Object.keys(rows[0]).map((h) => (
                          <td key={h} className="px-2 py-1.5 text-gray-600 whitespace-nowrap max-w-[160px] truncate">{String(r[h])}</td>
                        ))}
                        {results && (
                          <td className="px-2 py-1.5">
                            {!res ? <Loader2 size={12} className="animate-spin text-gray-300" />
                              : res.ok ? <CheckCircle2 size={12} className="text-emerald-500" />
                              : <span className="flex items-center gap-1 text-red-500" title={res.error}><AlertCircle size={12} />{res.error?.slice(0, 40)}</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 50 && <p className="text-[11px] text-gray-400 px-2 py-1.5">…and {rows.length - 50} more</p>}
            </div>

            {results && (
              <p className="text-xs font-semibold text-gray-600">
                {results.filter((r) => r.ok).length} succeeded, {results.filter((r) => !r.ok).length} failed
                {importing && ` — importing (${results.length}/${rows.length})…`}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { onClose(); reset(); }} type="button" className="btn-outline text-sm py-2 px-4">
                {results && !importing ? 'Done' : 'Cancel'}
              </button>
              {!results && (
                <button onClick={runImport} disabled={importing} type="button" className="btn-primary text-sm py-2 px-4 disabled:opacity-60">
                  {importing ? 'Importing…' : `Import ${rows.length} row${rows.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
