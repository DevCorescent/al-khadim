'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AtSign } from 'lucide-react';
import EmailEditor, { EmailEditorHandle, MergeTagDef } from './EmailEditor';
import AudiencePicker, { AudienceValue } from './AudiencePicker';
import ScheduleControl from './ScheduleControl';

export interface CampaignFormValue extends AudienceValue {
  name: string;
  subject: string;
  module: string;
  scheduleMode: 'now' | 'schedule';
  sendAt: string;
}

const GENERIC_MERGE_TAGS: Record<string, MergeTagDef> = {
  name: { name: 'Recipient Name', value: '{{name}}', sample: 'John Doe' },
  email: { name: 'Recipient Email', value: '{{email}}', sample: 'john@example.com' },
};

interface CampaignBuilderFormProps {
  value: CampaignFormValue;
  onChange: (patch: Partial<CampaignFormValue>) => void;
  editorRef: React.RefObject<EmailEditorHandle>;
  initialDesign?: object | null;
  initialHtml?: string;
  /** Change this to force the editor to remount and reload initialDesign (e.g. when a starting template is picked). */
  editorKey?: string | number;
}

export default function CampaignBuilderForm({ value, onChange, editorRef, initialDesign, initialHtml, editorKey }: CampaignBuilderFormProps) {
  const { data: identities = [] } = useQuery<any[]>({
    queryKey: ['email-identities'],
    queryFn: () => api.get('/emails/identities').then(r => r.data),
  });

  const activeIdentity = identities.find(i => i.module === value.module);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Campaign Name *</label>
            <input className="input" value={value.name} onChange={e => onChange({ name: e.target.value })}
              placeholder="e.g. September Promo" />
          </div>
          <div>
            <label className="label">From (module identity)</label>
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
        </div>
        <div>
          <label className="label">Subject *</label>
          <input className="input" value={value.subject} onChange={e => onChange({ subject: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="label mb-2 block">Body</label>
        <EmailEditor key={editorKey} ref={editorRef} initialDesign={initialDesign} initialHtml={initialHtml} mergeTags={GENERIC_MERGE_TAGS} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Audience</h3>
        <AudiencePicker value={value} onChange={onChange} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Send Timing</h3>
        <ScheduleControl
          mode={value.scheduleMode}
          onModeChange={(m) => onChange({ scheduleMode: m })}
          sendAt={value.sendAt}
          onSendAtChange={(v) => onChange({ sendAt: v })}
        />
      </div>
    </div>
  );
}
