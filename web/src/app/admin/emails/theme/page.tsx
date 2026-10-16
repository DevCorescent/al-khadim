'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import api from '@/lib/api';
import { FieldList } from '@/components/admin/site-builder/fields';
import type { Field } from '@/lib/homepage/schema';
import { DEFAULT_EMAIL_THEME, EMAIL_FONTS, normalizeEmailTheme, type EmailTheme } from '@/lib/email/theme';
import { newEmailBlock, type EmailDesign } from '@/lib/email/blocks';
import { renderEmail } from '@/lib/email/render';
import ScaledEmailFrame from '@/components/admin/email/builder/ScaledEmailFrame';

const h = (label: string, hint?: string): Field => ({ key: `__${label}`, type: 'heading', label, hint });
const FONT_OPTIONS = EMAIL_FONTS.map(f => ({ value: f.value, label: f.label }));

const FIELDS: Field[] = [
  h('Header'),
  { key: 'brandName', type: 'text', label: 'Brand name' },
  { key: 'tagline', type: 'text', label: 'Tagline (under the name)' },
  { key: 'logoUrl', type: 'image', label: 'Logo', hint: 'Square PNG works best. Shown at the width below.' },
  { key: 'logoWidth', type: 'number', label: 'Logo width (px)', min: 24, max: 160 },
  { key: 'headerStyle', type: 'select', label: 'Header style', options: [{ value: 'band', label: 'Brand band' }, { value: 'light', label: 'Light' }, { value: 'minimal', label: 'Logo only' }] },
  { key: 'showFlagStripe', type: 'toggle', label: 'UAE flag stripe under the header' },
  h('Colours'),
  { key: 'primary', type: 'color', label: 'Brand colour', hint: 'Header band, buttons, links' },
  { key: 'accent', type: 'color', label: 'Accent colour', hint: 'Tagline, highlights, gold buttons' },
  { key: 'background', type: 'color', label: 'Page background' },
  { key: 'surface', type: 'color', label: 'Card background' },
  { key: 'text', type: 'color', label: 'Text colour' },
  { key: 'muted', type: 'color', label: 'Secondary text' },
  { key: 'border', type: 'color', label: 'Lines and borders' },
  h('Typography & shape', 'Only email-safe fonts are offered, so every inbox shows the same thing'),
  { key: 'fontFamily', type: 'select', label: 'Body font', options: FONT_OPTIONS },
  { key: 'headingFontFamily', type: 'select', label: 'Heading font', options: FONT_OPTIONS },
  { key: 'radius', type: 'number', label: 'Card corner radius (px)', min: 0, max: 32 },
  { key: 'buttonRadius', type: 'number', label: 'Button corner radius (px)', min: 0, max: 40 },
  { key: 'contentWidth', type: 'number', label: 'Content width (px)', min: 480, max: 720 },
  h('Footer', 'A physical address and clear sender details help emails reach the inbox'),
  { key: 'footerCompany', type: 'text', label: 'Company name' },
  { key: 'footerAddress', type: 'textarea', label: 'Address' },
  { key: 'footerPhone', type: 'text', label: 'Phone' },
  { key: 'footerEmail', type: 'text', label: 'Email' },
  { key: 'footerWebsite', type: 'text', label: 'Website' },
  { key: 'footerNote', type: 'textarea', label: 'Small print', hint: 'Why the recipient is getting this email' },
  h('Social links', 'Leave empty to hide'),
  { key: 'socials.linkedin', type: 'link', label: 'LinkedIn' },
  { key: 'socials.instagram', type: 'link', label: 'Instagram' },
  { key: 'socials.facebook', type: 'link', label: 'Facebook' },
  { key: 'socials.twitter', type: 'link', label: 'X (Twitter)' },
  { key: 'socials.youtube', type: 'link', label: 'YouTube' },
  { key: 'socials.whatsapp', type: 'link', label: 'WhatsApp' },
];

const SAMPLE: EmailDesign = {
  kind: 'ak-email', version: 1,
  settings: { preheader: 'A preview of your email theme', showHeader: true, showFooter: true },
  blocks: [
    newEmailBlock('heading', { text: 'Hello Ahmed,', level: 'h2' }),
    newEmailBlock('text', { text: 'This is how every email from Al Khadim looks with your theme — interview invitations, approvals, document requests and campaigns.' }),
    newEmailBlock('details', { title: 'Interview details', rows: [{ label: 'Date', value: 'Monday, 12 October 2026' }, { label: 'Time', value: '10:30 AM GST' }, { label: 'Location', value: 'Sharjah Media City' }] }),
    newEmailBlock('button', { label: 'View in your dashboard', url: 'https://alkhadim.ae', style: 'primary' }),
    newEmailBlock('callout', { text: 'Please bring a copy of your passport and Emirates ID.', tone: 'brand' }),
    newEmailBlock('signature', {}),
  ],
};

export default function EmailThemePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['email-theme'],
    queryFn: () => api.get('/emails/theme').then(r => r.data as { theme: EmailTheme; assetBase: string }),
  });
  const [theme, setTheme] = useState<EmailTheme | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data && !theme) setTheme(normalizeEmailTheme(data.theme)); }, [data, theme]);

  const html = useMemo(() => theme ? renderEmail(SAMPLE, theme, { assetBase: data?.assetBase || window.location.origin, subject: 'Theme preview' }) : '', [theme, data?.assetBase]);
  const dirty = !!theme && !!data && JSON.stringify(theme) !== JSON.stringify(normalizeEmailTheme(data.theme));

  async function save() {
    if (!theme) return;
    setSaving(true);
    try {
      const { data: res } = await api.put('/emails/theme', theme);
      qc.setQueryData(['email-theme'], res);
      setTheme(normalizeEmailTheme(res.theme));
      toast.success('Email theme saved — every template now uses it');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not save the theme');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !theme) return <div className="p-10 text-center text-sm text-gray-400"><Loader2 size={16} className="animate-spin inline mr-2" />Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-bold text-gray-900">Brand & theme</h1>
          <p className="text-xs text-gray-400">One look for every email: approvals, interviews, OTPs, documents and campaigns. Changes apply to all builder templates instantly.</p>
        </div>
        <button onClick={() => setTheme(normalizeEmailTheme(DEFAULT_EMAIL_THEME))}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50">
          <RotateCcw size={14} /> Defaults
        </button>
        <button onClick={save} disabled={!dirty || saving}
          className="flex items-center gap-1.5 text-sm font-bold text-white bg-primary-400 hover:bg-primary-500 px-4 py-2 rounded-xl disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save theme
        </button>
      </div>
      <div className="grid lg:grid-cols-[400px_minmax(0,1fr)] gap-5 items-start">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <FieldList fields={FIELDS} value={theme} onChange={v => setTheme(normalizeEmailTheme(v))} />
        </div>
        <div className="lg:sticky lg:top-4 rounded-2xl border border-gray-200 bg-[#E9ECEE] p-3 overflow-y-auto lg:max-h-[calc(100vh-120px)] min-w-0">
          <ScaledEmailFrame srcDoc={html} width={theme.contentWidth + 80} title="Theme preview" />
        </div>
      </div>
    </div>
  );
}
