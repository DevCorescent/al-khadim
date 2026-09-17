'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Send, Clock, FlaskConical } from 'lucide-react';
import { EmailEditorHandle } from '@/components/admin/email/EmailEditor';
import CampaignBuilderForm, { CampaignFormValue } from '@/components/admin/email/CampaignBuilderForm';

const EMPTY: CampaignFormValue = {
  name: '', subject: '', module: 'system',
  targetMode: 'FILTER', recipientType: 'CANDIDATES', filters: {},
  scheduleMode: 'now', sendAt: '',
};

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const qc = useQueryClient();
  const id = params.id as string;
  const editorRef = useRef<EmailEditorHandle>(null);

  const [value, setValue] = useState<CampaignFormValue>(EMPTY);
  const [initialDesign, setInitialDesign] = useState<object | null>(null);
  const [initialHtml, setInitialHtml] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['email-campaign', id],
    queryFn: () => api.get(`/emails/campaigns/${id}`).then(r => r.data),
  });

  useEffect(() => {
    if (!campaign || hydrated) return;
    if (campaign.status !== 'DRAFT') {
      toast('Only draft campaigns can be edited', { icon: 'ℹ️' });
      router.replace(`/admin/emails/campaigns/${id}`);
      return;
    }
    setValue({
      name: campaign.name || '',
      subject: campaign.subject || '',
      module: campaign.module || 'system',
      targetMode: campaign.targetMode || 'FILTER',
      recipientType: campaign.recipientType || 'CANDIDATES',
      filters: campaign.filters || {},
      groupId: campaign.groupId || undefined,
      customRecipients: campaign.customRecipients || undefined,
      scheduleMode: 'now',
      sendAt: '',
    });
    setInitialDesign(campaign.design || null);
    setInitialHtml(campaign.html || '');
    setHydrated(true);
  }, [campaign, hydrated, id, router]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['email-campaign', id] });
    qc.invalidateQueries({ queryKey: ['email-campaigns'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { html, design } = await editorRef.current!.exportHtml();
      return api.put(`/emails/campaigns/${id}`, {
        name: value.name,
        subject: value.subject,
        html,
        design,
        module: value.module,
        targetMode: value.targetMode,
        recipientType: value.recipientType,
        filters: value.filters,
        groupId: value.groupId,
        customRecipients: value.customRecipients,
      });
    },
    onSuccess: () => { toast.success('Draft saved'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save'),
  });

  const sendTest = useMutation({
    mutationFn: () => api.post(`/emails/campaigns/${id}/send-test`, { to: testEmail }),
    onSuccess: () => toast.success(`Test sent to ${testEmail}`),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to send test'),
  });

  const sendNow = useMutation({
    mutationFn: () => api.post(`/emails/campaigns/${id}/send`, {}),
    onSuccess: () => { toast.success('Campaign is sending'); router.push(`/admin/emails/campaigns/${id}`); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to send'),
  });

  const schedule = useMutation({
    mutationFn: () => api.post(`/emails/campaigns/${id}/schedule`, { sendAt: new Date(value.sendAt).toISOString() }),
    onSuccess: () => { toast.success('Campaign scheduled'); router.push(`/admin/emails/campaigns/${id}`); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to schedule'),
  });

  function submitSave() {
    if (!value.name.trim()) return toast.error('Campaign name is required');
    if (!value.subject.trim()) return toast.error('Subject is required');
    if (value.targetMode === 'GROUP' && !value.groupId) return toast.error('Pick a saved group');
    if (value.targetMode === 'CUSTOM' && !(value.customRecipients?.length)) return toast.error('Pick at least one recipient');
    save.mutate();
  }

  function submitSend() {
    if (value.scheduleMode === 'schedule') {
      if (!value.sendAt) return toast.error('Pick a send date/time');
      if (!confirm('Schedule this campaign to send at the chosen time?')) return;
      schedule.mutate();
    } else {
      if (!confirm('Send this campaign now to the entire matching audience?')) return;
      sendNow.mutate();
    }
  }

  if (isLoading || !hydrated) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push('/admin/emails/campaigns')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Edit Draft Campaign</h1>
          <p className="text-xs text-gray-400">{campaign?.name}</p>
        </div>
      </div>

      <CampaignBuilderForm value={value} onChange={patch => setValue(v => ({ ...v, ...patch }))}
        editorRef={editorRef} initialDesign={initialDesign} initialHtml={initialHtml} />

      <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</h3>

        <div className="flex flex-wrap items-center gap-2">
          <input type="email" className="input text-sm w-64" placeholder="test@example.com" value={testEmail}
            onChange={e => setTestEmail(e.target.value)} />
          <button onClick={() => testEmail && sendTest.mutate()} disabled={!testEmail || sendTest.isPending}
            className="text-sm font-semibold px-3.5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
            <FlaskConical size={13} /> {sendTest.isPending ? 'Sending…' : 'Send Test'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <button onClick={submitSave} disabled={save.isPending}
            className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {save.isPending ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={submitSend} disabled={sendNow.isPending || schedule.isPending}
            className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2 disabled:opacity-60">
            {value.scheduleMode === 'schedule' ? <Clock size={14} /> : <Send size={14} />}
            {value.scheduleMode === 'schedule'
              ? (schedule.isPending ? 'Scheduling…' : 'Schedule Campaign')
              : (sendNow.isPending ? 'Sending…' : 'Send Now')}
          </button>
        </div>
      </div>
    </div>
  );
}
