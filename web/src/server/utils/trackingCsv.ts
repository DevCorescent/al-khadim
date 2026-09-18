// Ported from api/src/utils/trackingCsv.js
/**
 * Long-format CSV serialization for a candidate's industry tracking data.
 * One row per leaf value (Section, Field, Item, Value). "Item" disambiguates
 * checklist rows (e.g. "Passport - Status") and table rows (e.g. "Row 1 -
 * Certification"). This shape is the same for export and for the blank
 * sample template — a sample is just an export of an empty `data` object —
 * so the file a user downloads to fill in is guaranteed to match what import
 * expects.
 */

/** Minimal view of an industry tracking template (sections -> fields). */
export interface TrackingTemplate {
  sections: Array<{
    key: string;
    label: string;
    fields: Array<{
      key: string;
      label: string;
      type: string;
      items?: string[];
      columns?: Array<{ key: string; label: string; type?: string }>;
      [k: string]: any;
    }>;
    [k: string]: any;
  }>;
  [k: string]: any;
}

/** Cells a spreadsheet would evaluate as a formula (CSV/formula injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

function csvEscape(val: unknown): string {
  let s = val === null || val === undefined ? '' : String(val);
  // Neutralise formula injection: a leading quote makes Excel/Sheets treat it as text.
  if (FORMULA_START.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function buildTrackingCsv(template: TrackingTemplate, data: Record<string, any> = {}): string {
  const rows: unknown[][] = [['Section', 'Field', 'Item', 'Value']];
  for (const section of template.sections) {
    for (const field of section.fields) {
      const fieldData = data?.[section.key]?.[field.key];
      if (field.type === 'checklist') {
        for (const item of field.items) {
          const row = fieldData?.[item] || {};
          rows.push([section.label, field.label, `${item} - Status`, row.status || '']);
          rows.push([section.label, field.label, `${item} - Date`, row.date || '']);
          rows.push([section.label, field.label, `${item} - Notes`, row.notes || '']);
        }
      } else if (field.type === 'table') {
        const tableRows = Array.isArray(fieldData) ? fieldData : [];
        const rowCount = Math.max(tableRows.length, 1);
        for (let i = 0; i < rowCount; i++) {
          for (const col of field.columns) {
            rows.push([section.label, field.label, `Row ${i + 1} - ${col.label}`, tableRows[i]?.[col.key] ?? '']);
          }
        }
      } else {
        rows.push([section.label, field.label, '', fieldData ?? '']);
      }
    }
  }
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

/** Minimal RFC4180-ish CSV line parser (handles quoted commas/newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const clean = text.replace(/^﻿/, ''); // strip BOM if present (Excel exports)

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function coerce(value: string, type?: string): any {
  if (value === '' || value === undefined) return undefined;
  if (type === 'number') { const n = Number(value); return isNaN(n) ? undefined : n; }
  if (type === 'boolean') return /^(yes|true|1)$/i.test(value);
  return value;
}

/** Parse CSV rows produced by buildTrackingCsv back into the nested `data` shape. */
export function applyTrackingCsv(template: TrackingTemplate, rows: string[][]): Record<string, any> {
  const data: Record<string, any> = {};
  if (rows.length === 0) return data;
  const [header, ...body] = rows;
  const idx = {
    section: header.findIndex((h) => h.trim().toLowerCase() === 'section'),
    field: header.findIndex((h) => h.trim().toLowerCase() === 'field'),
    item: header.findIndex((h) => h.trim().toLowerCase() === 'item'),
    value: header.findIndex((h) => h.trim().toLowerCase() === 'value'),
  };
  if (idx.section < 0 || idx.field < 0 || idx.value < 0) {
    throw new Error('CSV must have Section, Field, Item, Value columns');
  }

  for (const r of body) {
    const sectionLabel = (r[idx.section] || '').trim();
    const fieldLabel = (r[idx.field] || '').trim();
    const item = (idx.item >= 0 ? r[idx.item] || '' : '').trim();
    // Undo the export's formula-injection guard so values round-trip unchanged.
    const value = (r[idx.value] ?? '').replace(/^'(?=[=+\-@\t\r])/, '');
    if (!sectionLabel || !fieldLabel) continue;

    const section = template.sections.find((s) => s.label === sectionLabel);
    if (!section) continue;
    const field = section.fields.find((f) => f.label === fieldLabel);
    if (!field) continue;

    data[section.key] = data[section.key] || {};

    if (field.type === 'checklist') {
      const m = item.match(/^(.*) - (Status|Date|Notes)$/i);
      if (!m) continue;
      const [, itemNameRaw, sub] = m;
      const itemName = field.items.find((it) => it.toLowerCase() === itemNameRaw.trim().toLowerCase());
      if (!itemName || value === '') continue;
      data[section.key][field.key] = data[section.key][field.key] || {};
      data[section.key][field.key][itemName] = data[section.key][field.key][itemName] || {};
      data[section.key][field.key][itemName][sub.toLowerCase()] = value;
    } else if (field.type === 'table') {
      const m = item.match(/^Row (\d+) - (.*)$/i);
      if (!m) continue;
      const rowIdx = parseInt(m[1], 10) - 1;
      const colLabel = m[2].trim();
      const col = field.columns.find((c) => c.label === colLabel);
      if (!col || value === '') continue;
      data[section.key][field.key] = data[section.key][field.key] || [];
      while (data[section.key][field.key].length <= rowIdx) data[section.key][field.key].push({});
      data[section.key][field.key][rowIdx][col.key] = coerce(value, col.type) ?? value;
    } else {
      const coerced = coerce(value, field.type);
      if (coerced !== undefined) data[section.key][field.key] = coerced;
    }
  }
  return data;
}
