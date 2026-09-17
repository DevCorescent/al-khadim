'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { AtSign, Copy } from 'lucide-react';
import EmailEditor, { EmailEditorHandle, MergeTagDef } from './EmailEditor';
import { RECIPIENT_TYPES } from './AudiencePicker';

export interface TemplateFormValue {
  name: string;
  slug: string;
  category: 'TRANSACTIONAL' | 'CAMPAIGN';
  recipientType: string;
  module: string;
  subject: string;
}

/** Small reference palette of tokens offered per recipient type for CAMPAIGN templates. */
const CAMPAIGN_TOKENS: Record<string, MergeTagDef[]> = {
  CANDIDATES:   [{ name: 'Name', value: '{{name}}' }, { name: 'Email', value: '{{email}}' }],
  EMPLOYEES:    [{ name: 'Name', value: '{{name}}' }, { name: 'Email', value: '{{email}}' }, { name: 'Department', value: '{{department}}' }],
  CLIENTS:      [{ name: 'Company Name', value: '{{companyName}}' }, { name: 'Email', value: '{{email}}' }],
  CLIENT_USERS: [{ name: 'Name', value: '{{name}}' }, { name: 'Email', value: '{{email}}' }, { name: 'Company Name', value: '{{companyName}}' }],
  USERS:        [{ name: 'Name', value: '{{name}}' }, { name: 'Email', value: '{{email}}' }],
};

interface ExistingMergeTag { key: string; label: string; sample?: string }

interface TemplateBuilderFormProps {
  value: TemplateFormValue;
  onChange: (patch: Partial<TemplateFormValue>) => void;
  editorRef: React.RefObject<EmailEditorHandle>;
  initialDesign?: object | null;
  initialHtml?: string;
  /** Existing mergeTags saved on the template (edit mode) — shown as a read-only reference list. */
  existingMergeTags?: ExistingMergeTag[] | null;
  version?: number;
}

export default function TemplateBuilderForm({ value, onChange, editorRef, initialDesign, initialHtml, existingMergeTags, version }: TemplateBuilderFormProps) {
  const { data: identities = [] } = useQuery<any[]>({
    queryKey: ['email-identities'],
    queryFn: () => api.get('/emails/identities').then(r => r.data),
  });

  const activeIdentity = identities.find(i => i.module === value.module);

  const editorMergeTags: Record<string, MergeTagDef> | undefined = value.category === 'CAMPAIGN' && value.recipientType
    ? Object.fromEntries((CAMPAIGN_TOKENS[value.recipientType] || []).map(t => [t.value.replace(/[{}]/g, ''), t]))
    : undefined;

  function copyToken(token: string) {
    navigator.clipboard?.writeText(token).then(() => toast.success(`Copied ${token}`)).catch(() => {});
  }

  return (
    <div className="grid xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 space-y-5 min-w-0">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={value.name} onChange={e => onChange({ name: e.target.value })} />
            </div>
            <div>
              <label className="label">Slug *</label>
              <input className="input font-mono text-sm" value={value.slug} onChange={e => onChange({ slug: e.target.value })} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <select className="input" value={value.category} onChange={e => onChange({ category: e.target.value as any, recipientType: e.target.value === 'CAMPAIGN' ? value.recipientType : '' })}>
                <option value="TRANSACTIONAL">Transactional</option>
                <option value="CAMPAIGN">Campaign</option>
              </select>
            </div>
            {value.category === 'CAMPAIGN' && (
              <div>
                <label className="label">Recipient Type</label>
                <select className="input" value={value.recipientType} onChange={e => onChange({ recipientType: e.target.value })}>
                  <option value="">Any</option>
                  {RECIPIENT_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="label">From (module identity) *</label>
            <select className="input" value={value.module} onChange={e => onChange({ module: e.target.value })}>
              {identities.map(i => (
                <option key={i.module} value={i.module}>{i.name} — {i.module}</option>
              ))}
            </select>
            {activeIdentity && (
              <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                <AtSign size={10} /> Sends as <span className="font-mono font-semibold text-gray-600">{activeIdentity.address}</span>
              </p>
            )}
          </div>

          <div>
            <label className="label">Subject *</label>
            <input className="input" value={value.subject} onChange={e => onChange({ subject: e.target.value })} placeholder="Supports {{tokens}}" />
          </div>
        </div>

        <div>
          <label className="label mb-2 block">Body</label>
          <EmailEditor ref={editorRef} initialDesign={initialDesign} initialHtml={initialHtml} mergeTags={editorMergeTags} />
        </div>
      </div>

      <div className="space-y-4">
        {typeof version === 'number' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Version</p>
            <p className="text-lg font-bold text-gray-900">v{version}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Merge Tags</h3>
          {value.category === 'TRANSACTIONAL' ? (
            <p className="text-xs text-gray-400">
              Type any <code className="font-mono bg-gray-100 px-1 rounded">{'{{token}}'}</code> directly in the subject or body — it's substituted with data at send time.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2">Reference tokens for this recipient type — click to copy:</p>
              <div className="flex flex-wrap gap-1.5">
                {(CAMPAIGN_TOKENS[value.recipientType] || [{ name: 'Name', value: '{{name}}' }, { name: 'Email', value: '{{email}}' }]).map(t => (
                  <button key={t.value} type="button" onClick={() => copyToken(t.value)}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 hover:border-primary-300 flex items-center gap-1">
                    <Copy size={9} /> {t.value}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {existingMergeTags && existingMergeTags.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Saved Merge Tags</h3>
            <div className="space-y-1.5">
              {existingMergeTags.map(t => (
                <button key={t.key} type="button" onClick={() => copyToken(`{{${t.key}}}`)}
                  className="w-full text-left flex items-center justify-between gap-2 text-xs border-b border-gray-50 pb-1.5 last:border-0 hover:text-primary-600">
                  <span className="font-mono text-gray-700">{`{{${t.key}}}`}</span>
                  <span className="text-gray-400 truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
