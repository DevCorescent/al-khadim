'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';
import { EmailEditorHandle } from '@/components/admin/email/EmailEditor';
import CampaignBuilderForm, { CampaignFormValue } from '@/components/admin/email/CampaignBuilderForm';

export default function NewCampaignPage() {
  const router = useRouter();
  const editorRef = useRef<EmailEditorHandle>(null);

  const [templateId, setTemplateId] = useState('');
  const [initialDesign, setInitialDesign] = useState<object | null>(null);
  const [initialHtml, setInitialHtml] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  const [value, setValue] = useState<CampaignFormValue>({
    name: '', subject: '', module: 'system',
    targetMode: 'FILTER', recipientType: 'CANDIDATES', filters: {},
    scheduleMode: 'now', sendAt: '',
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['campaign-start-templates'],
    queryFn: () => api.get('/emails/templates', { params: { category: 'CAMPAIGN' } }).then(r => r.data),
  });

  async function pickTemplate(id: string) {
    setTemplateId(id);
    if (!id) {
      setInitialDesign(null);
      setInitialHtml('');
      setEditorKey(k => k + 1);
      return;
    }
    try {
      const { data } = await api.get(`/emails/templates/${id}`);
      setValue(v => ({ ...v, subject: data.subject || v.subject }));
      setInitialDesign(data.design || null);
      setInitialHtml(data.html || '');
      setEditorKey(k => k + 1);
    } catch {
      toast.error('Failed to load template');
    }
  }

  const createDraft = useMutation({
    mutationFn: async () => {
      const { html, design } = await editorRef.current!.exportHtml();
      return api.post('/emails/campaigns', {
        name: value.name,
        templateId: templateId || undefined,
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
    onSuccess: (res) => {
      toast.success('Draft created');
      router.push(`/admin/emails/campaigns/${res.data.id}/edit`);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create draft'),
  });

  function submit() {
    if (!value.name.trim()) return toast.error('Campaign name is required');
    if (!value.subject.trim()) return toast.error('Subject is required');
    if (value.targetMode === 'GROUP' && !value.groupId) return toast.error('Pick a saved group');
    if (value.targetMode === 'CUSTOM' && !(value.customRecipients?.length)) return toast.error('Pick at least one recipient');
    createDraft.mutate();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push('/admin/emails/campaigns')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">New Campaign</h1>
          <p className="text-xs text-gray-400">Build the email, target a segment, then save as a draft</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <label className="label flex items-center gap-1.5"><LayoutTemplate size={13} /> Start from a template (optional)</label>
        <select className="input" value={templateId} onChange={e => pickTemplate(e.target.value)}>
          <option value="">Start blank</option>
          {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <CampaignBuilderForm value={value} onChange={patch => setValue(v => ({ ...v, ...patch }))}
        editorRef={editorRef} initialDesign={initialDesign} initialHtml={initialHtml} editorKey={editorKey} />

      <div className="flex justify-end mt-5">
        <button onClick={submit} disabled={createDraft.isPending}
          className="btn-primary text-sm py-2.5 px-5 disabled:opacity-60">
          {createDraft.isPending ? 'Saving…' : 'Save Draft'}
        </button>
      </div>
    </div>
  );
}
