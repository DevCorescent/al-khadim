/**
 * Shared CSV / XLSX / PDF export for any admin table. Works off the same
 * `{key,label}` column shape DataTable already uses, plus an optional
 * `exportValue(row)` accessor per column for columns whose `render()` returns
 * JSX (badges, buttons, etc.) — falls back to the raw `row[key]` otherwise.
 */
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  key: string;
  label: string;
  exportValue?: (row: any) => string | number | boolean | null | undefined;
}

function cellText(col: ExportColumn, row: any): string {
  const raw = col.exportValue ? col.exportValue(row) : row[col.key];
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'object') {
    // Best-effort: an un-mapped relation object (e.g. {name:'...'}) — show its name/label if present.
    return raw.name || raw.label || raw.title || '';
  }
  return String(raw);
}

function toRows(columns: ExportColumn[], data: any[]): string[][] {
  return data.map((row) => columns.map((col) => cellText(col, row)));
}

function timestampedName(base: string, ext: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = base
    .replace(/\(.*?\)/g, '')          // strip trailing counts like "(10)"
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'export';
  return `${slug}-${stamp}.${ext}`;
}

export function exportToCSV(columns: ExportColumn[], data: any[], filename: string) {
  const rows = [columns.map((c) => c.label), ...toRows(columns, data)];
  const csv = rows
    .map((r) => r.map((cell) => {
      const s = String(cell ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, timestampedName(filename, 'csv'));
}

export function exportToXLSX(columns: ExportColumn[], data: any[], filename: string) {
  const rows = [columns.map((c) => c.label), ...toRows(columns, data)];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = columns.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, timestampedName(filename, 'xlsx'));
}

export function exportToPDF(columns: ExportColumn[], data: any[], filename: string, title?: string) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
  if (title) {
    doc.setFontSize(13);
    doc.text(title, 14, 15);
  }
  autoTable(doc, {
    startY: title ? 20 : 12,
    head: [columns.map((c) => c.label)],
    body: toRows(columns, data),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 10, right: 10 },
  });
  doc.save(timestampedName(filename, 'pdf'));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export function runExport(format: ExportFormat, columns: ExportColumn[], data: any[], filename: string, title?: string) {
  if (!data.length) return false;
  if (format === 'csv') exportToCSV(columns, data, filename);
  else if (format === 'xlsx') exportToXLSX(columns, data, filename);
  else exportToPDF(columns, data, filename, title);
  return true;
}
