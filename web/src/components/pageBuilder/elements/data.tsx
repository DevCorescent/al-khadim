'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Briefcase, CheckCircle2, Clock, Loader2, MapPin, Wallet } from 'lucide-react';
import api from '@/lib/api';
import { PBButton, RawHtml, colsVars, n, usePB } from '../ui';
import type { ElProps } from './basic';

/* ─── Form ──────────────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function FormEl({ node, p }: ElProps) {
  const { editing, slug } = usePB();
  const fields: any[] = Array.isArray(p.fields) ? p.fields : [];
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [serverError, setServerError] = useState('');
  const dark = p.look === 'dark';

  const validate = () => {
    const e: Record<string, string> = {};
    fields.forEach((f, i) => {
      const v = values[i];
      const empty = f.type === 'checkbox' ? !v : !String(v ?? '').trim();
      if (f.required && empty) e[i] = 'This field is required';
      else if (!empty && f.type === 'email' && !EMAIL_RE.test(String(v).trim())) e[i] = 'Enter a valid email address';
      else if (!empty && f.type === 'tel' && String(v).replace(/\D/g, '').length < 7) e[i] = 'Enter a valid phone number';
    });
    if (p.consent && !consent) e.consent = 'Please confirm to continue';
    setErrors(e);
    return !Object.keys(e).length;
  };

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (editing) return;
    if (!validate()) return;
    setState('sending');
    setServerError('');
    try {
      await api.post('/pages/submit', {
        slug, elementId: node.id, website: hp,
        values: fields.map((_, i) => (typeof values[i] === 'boolean' ? (values[i] ? 'Yes' : 'No') : String(values[i] ?? ''))),
      });
      setState('done');
      const to = String(p.redirect || '');
      if (to && (to.startsWith('/') || /^https?:\/\//i.test(to))) window.location.href = to;
    } catch (e: any) {
      setServerError(e?.response?.data?.error || 'Something went wrong — please try again.');
      setState('idle');
    }
  }

  const card = p.card === 'card' ? { background: '#fff', color: 'rgb(var(--hp-text))', padding: 'clamp(22px, 4cqi, 36px)', borderRadius: 'var(--hp-radius-card)', boxShadow: '0 1px 2px rgba(6,30,38,.05), 0 30px 60px -30px rgba(6,30,38,.3)' }
    : p.card === 'glass' ? { background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', backdropFilter: 'blur(14px)', padding: 'clamp(22px, 4cqi, 36px)', borderRadius: 'var(--hp-radius-card)' }
      : {};

  if (state === 'done') {
    return (
      <div style={{ ...card, textAlign: 'center', padding: card.padding || 32 }}>
        <span className="pb-ibox-icon pb-shape-circle" style={{ width: 64, height: 64, background: 'rgb(16 185 129 / .12)', color: '#059669', marginBottom: 16 }}><CheckCircle2 size={30} /></span>
        <h3 className="pb-h pb-h-md">{p.successTitle || 'Thank you!'}</h3>
        <p className="pb-muted" style={{ margin: '8px auto 0', maxWidth: 420, lineHeight: 1.6 }}>{p.successText}</p>
      </div>
    );
  }

  const floating = p.labels === 'floating';
  return (
    <div style={card}>
      {p.title && <h3 className="pb-h pb-h-md" style={{ marginBottom: p.intro ? 6 : 20 }}>{p.title}</h3>}
      {p.intro && <p className="pb-muted" style={{ margin: '0 0 22px', lineHeight: 1.6 }}>{p.intro}</p>}
      <form className={`pb-form pb-in-${p.look || 'outlined'}`} onSubmit={submit} noValidate>
        <label className="pb-hp" aria-hidden>Website<input tabIndex={-1} autoComplete="off" value={hp} onChange={e => setHp(e.target.value)} /></label>
        {fields.map((f, i) => {
          const id = `pb-f-${node.id}-${i}`;
          const err = errors[i];
          const set = (v: any) => { setValues(s => ({ ...s, [i]: v })); if (err) setErrors(e => { const x = { ...e }; delete x[i]; return x; }); };
          const ph = floating ? `${f.label}${f.required ? ' *' : ''}` : f.placeholder;
          const options = String(f.options || '').split('\n').map((s: string) => s.trim()).filter(Boolean);
          const common = { id, className: `pb-input ${err ? 'is-error' : ''}`, 'aria-invalid': !!err, 'aria-describedby': err ? `${id}-e` : undefined };
          let input: React.ReactNode;
          if (f.type === 'textarea') input = <textarea {...common} rows={4} placeholder={ph} value={values[i] ?? ''} onChange={e => set(e.target.value)} maxLength={4000} />;
          else if (f.type === 'select') input = (
            <select {...common} value={values[i] ?? ''} onChange={e => set(e.target.value)}>
              <option value="">{floating ? f.label : f.placeholder || 'Select…'}</option>
              {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
            </select>
          );
          else if (f.type === 'radio') input = (
            <div role="radiogroup" aria-labelledby={`${id}-l`}>
              {options.map((o: string) => (
                <label key={o} className="pb-choice"><input type="radio" name={id} checked={values[i] === o} onChange={() => set(o)} />{o}</label>
              ))}
            </div>
          );
          else if (f.type === 'checkbox') input = (
            <label className="pb-choice" style={{ borderRadius: 12 }}><input type="checkbox" checked={!!values[i]} onChange={e => set(e.target.checked)} />{f.placeholder || f.label}</label>
          );
          else input = <input {...common} type={['email', 'tel', 'date', 'number'].includes(f.type) ? f.type : 'text'} placeholder={ph} value={values[i] ?? ''} onChange={e => set(e.target.value)} maxLength={300}
            autoComplete={f.map === 'email' ? 'email' : f.map === 'phone' ? 'tel' : f.map === 'contactName' ? 'name' : f.map === 'companyName' ? 'organization' : undefined} />;
          return (
            <div key={i} className={f.width === 'half' ? '' : 'is-full'}>
              {!floating && f.type !== 'checkbox' && <label htmlFor={id} id={`${id}-l`} className="pb-label">{f.label}{f.required && <span className="req">*</span>}</label>}
              {input}
              {err && <p id={`${id}-e`} className="pb-err">{err}</p>}
            </div>
          );
        })}
        {p.consent && (
          <div className="is-full">
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, accentColor: 'rgb(var(--hp-primary))' }} />
              <span className="pb-muted">{p.consent}</span>
            </label>
            {errors.consent && <p className="pb-err">{errors.consent}</p>}
          </div>
        )}
        {serverError && <p className="is-full pb-err" role="alert" style={{ fontSize: '.85rem' }}>{serverError}</p>}
        <div className="is-full" style={{ marginTop: 4 }}>
          <button type="submit" disabled={state === 'sending'} className={`pb-btn pb-btn-${p.submitVariant || 'primary'} pb-btn-lg`} style={{ width: p.submitFull ? '100%' : undefined, opacity: state === 'sending' ? 0.75 : 1, color: dark && p.submitVariant === 'outline' ? '#fff' : undefined }}>
            {state === 'sending' && <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />}
            {p.submitLabel || 'Submit'}
          </button>
          {editing && <p className="pb-muted" style={{ fontSize: 12, marginTop: 8 }}>Submissions are disabled in the editor. They arrive in CRM → Enquiries once the page is live.</p>}
        </div>
      </form>
    </div>
  );
}

/* ─── Live jobs ─────────────────────────────────────────────────────────── */

const pretty = (v?: string | null) => String(v || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export function Jobs({ p }: ElProps) {
  const limit = Math.max(1, Math.min(24, n(p.limit, 6)));
  const { data, isLoading } = useQuery({
    queryKey: ['pb-public-jobs', limit],
    queryFn: () => api.get(`/jobs/public?limit=${limit}`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const jobs: any[] = (Array.isArray(data) ? data : data?.jobs || []).slice(0, limit);
  return (
    <div>
      {isLoading ? (
        <div className="pb-grid" style={colsVars(p, 'cols', 16)}>
          {Array.from({ length: Math.min(limit, 6) }).map((_, i) => <div key={i} className="pb-card pb-card-bordered" style={{ height: 150, animation: 'pb-pulse 1.4s ease-in-out infinite' }} />)}
        </div>
      ) : !jobs.length ? (
        <div className="pb-card pb-card-filled" style={{ textAlign: 'center', padding: 40 }}>
          <Briefcase size={26} style={{ color: 'rgb(var(--hp-gold))', margin: '0 auto 10px' }} />
          <p className="pb-muted" style={{ margin: 0 }}>{p.emptyText}</p>
        </div>
      ) : (
        <div className="pb-grid" style={colsVars(p, 'cols', 16)}>
          {jobs.map(j => (
            <a key={j.id} href={`/careers?job=${encodeURIComponent(j.id)}`} className="pb-card pb-card-shadow pb-hover-lift" style={{ display: 'flex', flexDirection: 'column', color: 'rgb(var(--hp-text))', textDecoration: 'none', padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999, background: 'rgb(var(--hp-primary) / .1)', color: 'rgb(var(--hp-primary))' }}>{pretty(j.jobType) || 'Full Time'}</span>
                <ArrowUpRight size={18} style={{ color: 'rgb(var(--hp-muted))' }} />
              </div>
              <h3 className="pb-h pb-h-sm" style={{ marginBottom: 14 }}>{j.title}</h3>
              <div className="pb-muted" style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12.5 }}>
                {(j.location || j.country) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MapPin size={13} />{[j.location, j.country].filter(Boolean).join(', ')}</span>}
                {j.experience && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Briefcase size={13} />{j.experience}</span>}
                {j.salaryMin && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Wallet size={13} />{j.currency || 'AED'} {Math.round(j.salaryMin / 1000)}k{j.salaryMax ? `–${Math.round(j.salaryMax / 1000)}k` : '+'}</span>}
                {j.createdAt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} />{new Date(j.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
              </div>
            </a>
          ))}
        </div>
      )}
      {p.ctaLabel && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}><PBButton b={{ label: p.ctaLabel, href: p.ctaHref, variant: 'outline', icon: 'ArrowRight' }} /></div>}
    </div>
  );
}

/* ─── Custom HTML ───────────────────────────────────────────────────────── */

/** The code is sanitised by the API when the page is saved (no scripts or handlers). */
export function HtmlEl({ p }: ElProps) {
  const { editing } = usePB();
  return <RawHtml style={{ pointerEvents: editing ? 'none' : undefined }} html={String(p.code || '')} />;
}
