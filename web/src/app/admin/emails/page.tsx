'use client';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Mail, Send, Clock, Trash2, AtSign, CheckCircle, AlertCircle, ArrowLeft, FileText, FilePlus2, User, Users, ExternalLink } from 'lucide-react';
import ExportMenu from '@/components/admin/ExportMenu';
import EmailEditor, { EmailEditorHandle } from '@/components/admin/email/EmailEditor';
import ScheduleControl from '@/components/admin/email/ScheduleControl';
import TemplateGallery, { TemplateSummary } from '@/components/admin/email/TemplateGallery';

const EXPORT_COLUMNS = [
  { key: 'status',  label: 'Status' },
  { key: 'module',  label: 'Module' },
  { key: 'to',      label: 'To' },
  { key: 'subject', label: 'Subject' },
  { key: 'sendAt',  label: 'Send At', exportValue: (r: any) => r.sendAt ? new Date(r.sendAt).toLocaleString('en-AE') : '' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  SENT:      'bg-emerald-100 text-emerald-700',
  FAILED:    'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function EmailsPage() {
  const qc = useQueryClient();
  const editorRef = useRef<EmailEditorHandle>(null);

  const [step, setStep] = useState<'template' | 'compose'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  const [initialDesign, setInitialDesign] = useState<object | null>(null);
  const [initialHtml, setInitialHtml] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now');
  const [sendAt, setSendAt] = useState('');
  const [form, setForm] = useState({ module: 'system', to: '', cc: '', subject: '' });

  const [recipientMode, setRecipientMode] = useState<'single' | 'group'>('single');
  const [groupId, setGroupId] = useState('');

  const { data: identities = [] } = useQuery<any[]>({
    queryKey: ['email-identities'],
    queryFn: () => api.get('/emails/identities').then(r => r.data),
  });

  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ['email-groups', 'compose'],
    queryFn: () => api.get('/emails/groups').then(r => r.data),
  });
  const activeGroup = groups.find(g => g.id === groupId);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<TemplateSummary[]>({
    queryKey: ['email-templates', 'gallery'],
    queryFn: () => api.get('/emails/templates').then(r => r.data),
  });

  const { data: scheduled = [], isLoading } = useQuery<any[]>({
    queryKey: ['scheduled-emails'],
    queryFn: () => api.get('/emails/scheduled', { params: { limit: 200 } }).then(r => r.data.data),
    refetchInterval: 15000,
  });

  const activeIdentity = identities.find(i => i.module === form.module);

  function goToCompose() {
    setEditorKey(k => k + 1);
    setStep('compose');
  }

  function startBlank() {
    setSelectedTemplate(null);
    setInitialDesign(null);
    setInitialHtml('');
    setForm(f => ({ ...f, subject: '' }));
    goToCompose();
  }

  async function pickTemplate(t: TemplateSummary) {
    setLoadingTemplateId(t.id);
    try {
      const { data } = await api.get(`/emails/templates/${t.id}`);
      setSelectedTemplate(t);
      setInitialDesign(data.design || null);
      setInitialHtml(data.html || '');
      setForm(f => ({ ...f, subject: data.subject || '', module: data.module || f.module }));
      goToCompose();
    } catch {
      toast.error('Failed to load template');
    } finally {
      setLoadingTemplateId(null);
    }
  }

  function backToTemplates() {
    setStep('template');
  }

  const resetComposer = () => {
    setForm(f => ({ ...f, to: '', cc: '', subject: '' }));
    setSelectedTemplate(null);
    setInitialDesign(null);
    setInitialHtml('');
    setScheduleMode('now');
    setSendAt('');
    setRecipientMode('single');
    setGroupId('');
    setStep('template');
  };

  const send = useMutation({
    mutationFn: (payload: any) => api.post('/emails/send', payload),
    onSuccess: () => { toast.success('Email sent'); resetComposer(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to send'),
  });

  const schedule = useMutation({
    mutationFn: (payload: any) => api.post('/emails/schedule', payload),
    onSuccess: () => {
      toast.success('Email scheduled');
      resetComposer();
      qc.invalidateQueries({ queryKey: ['scheduled-emails'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to schedule'),
  });

  // Sending to a group reuses the campaign engine under the hood (create a
  // draft campaign targeting the group, then send/schedule it) so it gets
  // the same fan-out, merge-tag rendering, and history tracking as a real
  // campaign — without making the admin go build one by hand for a quick blast.
  const sendToGroup = useMutation({
    mutationFn: async (html: string) => {
      const { data: campaign } = await api.post('/emails/campaigns', {
        name: `Compose: ${form.subject}`.slice(0, 120),
        subject: form.subject,
        html,
        module: form.module,
        targetMode: 'GROUP',
        groupId,
      });
      if (scheduleMode === 'schedule') {
        return api.post(`/emails/campaigns/${campaign.id}/schedule`, { sendAt: new Date(sendAt).toISOString() });
      }
      return api.post(`/emails/campaigns/${campaign.id}/send`, {});
    },
    onSuccess: (res) => {
      const count = res.data?.totalRecipients;
      toast.success(
        scheduleMode === 'schedule'
          ? `Scheduled for ${count ?? activeGroup?.memberCount ?? 0} recipients`
          : `Sending to ${count ?? activeGroup?.memberCount ?? 0} recipients`
      );
      resetComposer();
      qc.invalidateQueries({ queryKey: ['scheduled-emails'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to send to group'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.delete(`/emails/scheduled/${id}`),
    onSuccess: () => { toast.success('Cancelled'); qc.invalidateQueries({ queryKey: ['scheduled-emails'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Cannot cancel'),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject) return toast.error('Subject is required');
    if (recipientMode === 'single' && !form.to) return toast.error('Recipient is required');
    if (recipientMode === 'group' && !groupId) return toast.error('Pick a group to send to');
    if (scheduleMode === 'schedule' && !sendAt) return toast.error('Pick a send date/time');

    let html = '';
    try {
      const exported = await editorRef.current!.exportHtml();
      html = exported.html;
    } catch {
      return toast.error('Editor is not ready yet — try again in a moment');
    }

    if (recipientMode === 'group') {
      sendToGroup.mutate(html);
      return;
    }

    const payload = { module: form.module, to: form.to, cc: form.cc || undefined, subject: form.subject, html };
    if (scheduleMode === 'schedule') {
      schedule.mutate({ ...payload, sendAt: new Date(sendAt).toISOString() });
    } else {
      send.mutate(payload);
    }
  }

  const isSending = send.isPending || schedule.isPending || sendToGroup.isPending;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
          <Mail size={18} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Email Center</h1>
          <p className="text-xs text-gray-400">
            {step === 'template' ? 'Pick a template to start from, or write a one-off email from scratch' : 'Send now or schedule — each module sends from its own identity'}
          </p>
        </div>
      </div>

      {step === 'template' ? (
        <TemplateGallery
          templates={templates}
          isLoading={templatesLoading}
          loadingTemplateId={loadingTemplateId}
          onSelectTemplate={pickTemplate}
          onStartBlank={startBlank}
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Composer */}
          <form onSubmit={submit} className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <button type="button" onClick={backToTemplates}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft size={13} /> Templates
              </button>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1">
                {selectedTemplate ? <FileText size={11} /> : <FilePlus2 size={11} />}
                {selectedTemplate ? selectedTemplate.name : 'Blank email'}
              </span>
            </div>

            <ScheduleControl mode={scheduleMode} onModeChange={setScheduleMode} sendAt={sendAt} onSendAtChange={setSendAt} />

            <div>
              <label className="label">From (module identity)</label>
              <select className="input" value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))}>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Recipient</label>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button type="button" onClick={() => setRecipientMode('single')}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                      recipientMode === 'single' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                    }`}>
                    <User size={12} /> One person
                  </button>
                  <button type="button" onClick={() => setRecipientMode('group')}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                      recipientMode === 'group' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                    }`}>
                    <Users size={12} /> A group
                  </button>
                </div>
              </div>

              {recipientMode === 'single' ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><input className="input" type="email" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} placeholder="recipient@example.com" /></div>
                  <div><input className="input" value={form.cc} onChange={e => setForm(f => ({ ...f, cc: e.target.value }))} placeholder="Cc (optional)" /></div>
                </div>
              ) : (
                <div>
                  <select className="input" value={groupId} onChange={e => setGroupId(e.target.value)}>
                    <option value="">Select a group…</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.memberCount} members)</option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between mt-1.5">
                    {activeGroup ? (
                      <p className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Users size={10} /> Sending to <span className="font-semibold text-gray-600">{activeGroup.memberCount} recipients</span>
                      </p>
                    ) : groups.length === 0 ? (
                      <p className="text-[11px] text-gray-400">No saved groups yet — create one on the Groups tab.</p>
                    ) : <span />}
                    <Link href="/admin/emails/groups" className="flex items-center gap-1 text-[11px] font-semibold text-primary-500 hover:text-primary-600">
                      Manage groups <ExternalLink size={10} />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div><label className="label">Subject *</label><input className="input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>

            <div>
              <label className="label mb-2 block">Body</label>
              <EmailEditor key={editorKey} ref={editorRef} initialDesign={initialDesign} initialHtml={initialHtml} />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={isSending}
                className="btn-primary text-sm py-2 flex items-center gap-2 disabled:opacity-60">
                {scheduleMode === 'now' ? <Send size={14} /> : <Clock size={14} />}
                {isSending
                  ? (scheduleMode === 'now' ? 'Sending…' : 'Scheduling…')
                  : (scheduleMode === 'now'
                      ? (recipientMode === 'group' ? 'Send to Group' : 'Send Email')
                      : (recipientMode === 'group' ? 'Schedule for Group' : 'Schedule Email'))}
              </button>
            </div>
          </form>

          {/* Identity reference */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Module Identities</h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-none">
              {identities.map(i => (
                <div key={i.module} className="flex items-center justify-between gap-2 text-xs border-b border-gray-50 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-700 truncate">{i.name}</p>
                    <p className="font-mono text-[11px] text-gray-400 truncate">{i.address}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{i.module}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scheduled / history */}
      <div className="bg-white rounded-2xl border border-gray-200 mt-5 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Scheduled &amp; Sent</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{scheduled.length}</span>
            <ExportMenu columns={EXPORT_COLUMNS} data={scheduled} filename="emails" title="Scheduled &amp; Sent Emails" disabled={isLoading} />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : scheduled.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No scheduled emails yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Module</th>
                  <th className="px-4 py-2">To</th>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2">Send At</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scheduled.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status] || 'bg-gray-100 text-gray-600'}`}>
                        {e.status === 'SENT' ? <CheckCircle size={10} /> : e.status === 'FAILED' ? <AlertCircle size={10} /> : <Clock size={10} />}
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{e.module}</td>
                    <td className="px-4 py-2.5 text-gray-700">{e.to}</td>
                    <td className="px-4 py-2.5 text-gray-700 max-w-[220px] truncate">{e.subject}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {new Date(e.sendAt).toLocaleString('en-AE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {e.status === 'PENDING' && (
                        <button onClick={() => cancel.mutate(e.id)} title="Cancel"
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
