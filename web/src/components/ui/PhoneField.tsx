'use client';
/**
 * Phone entry split into a country-code dropdown and a local number box.
 *
 * The parent still stores one string (what the API expects); this component
 * owns the split. `value` is parsed on mount and whenever it changes from the
 * outside (e.g. filled in from a parsed CV), so the picker stays in sync.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, DEFAULT_COUNTRY, countryByCode, joinPhone, splitPhone } from '@/lib/formOptions';

interface Props {
  /** Combined phone, e.g. "+971501234567". */
  value: string;
  onChange: (combined: string) => void;
  placeholder?: string;
  id?: string;
}

export default function PhoneField({ value, onChange, placeholder = '50 123 4567', id }: Props) {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [number, setNumber] = useState('');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // What we last pushed up, so an external change is distinguishable from our own.
  const emitted = useRef<string>('');

  useEffect(() => {
    if (value === emitted.current) return;
    const parsed = splitPhone(value);
    setCountry(parsed.country);
    setNumber(parsed.number);
  }, [value]);

  function push(nextCountry: string, nextNumber: string) {
    const combined = joinPhone(nextCountry, nextNumber);
    emitted.current = combined;
    onChange(combined);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.dial.includes(needle.replace(/^\+?/, '+')) ||
        c.dial.replace('+', '').startsWith(needle.replace('+', '')) ||
        c.code.toLowerCase() === needle,
    );
  }, [q]);

  const current = countryByCode(country) ?? COUNTRIES[0];
  const firstRest = filtered.findIndex((c) => !c.priority);

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex items-stretch rounded-xl border bg-gray-50 transition-all ${
          open ? 'border-primary-400 ring-2 ring-primary-400/40' : 'border-gray-200'
        } focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-400/40`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Country code"
          className="flex items-center gap-1.5 pl-3 pr-2.5 py-3 shrink-0 rounded-l-xl hover:bg-gray-100 transition-colors border-r border-gray-200"
        >
          <span className="text-base leading-none">{current.flag}</span>
          <span className="text-sm font-semibold text-gray-700 tabular-nums">{current.dial}</span>
          <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={number}
          onChange={(e) => {
            // Digits and separators only; the dial code lives in the picker.
            const next = e.target.value.replace(/[^\d\s-]/g, '');
            setNumber(next);
            push(country, next);
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-gray-400"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[17rem] bg-white border border-gray-200 rounded-xl shadow-xl shadow-gray-900/10 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && filtered[0]) {
                  e.preventDefault();
                  setCountry(filtered[0].code);
                  push(filtered[0].code, number);
                  setOpen(false);
                }
              }}
              placeholder="Search country or code…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-gray-400">No matches</p>
            )}
            {filtered.map((c, i) => (
              <div key={c.code}>
                {firstRest > 0 && i === firstRest && <div className="my-1 border-t border-gray-100" />}
                <button
                  type="button"
                  onClick={() => {
                    setCountry(c.code);
                    push(c.code, number);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-primary-50 transition-colors ${
                    c.code === country ? 'bg-primary-50/60 font-semibold text-primary-700' : 'text-gray-700'
                  }`}
                >
                  <span className="text-base leading-none shrink-0">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 tabular-nums shrink-0">{c.dial}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
