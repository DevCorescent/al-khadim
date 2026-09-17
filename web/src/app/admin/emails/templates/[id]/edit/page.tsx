'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { EmailEditorHandle } from '@/components/admin/email/EmailEditor';
import TemplateBuilderForm, { TemplateFormValue } from '@/components/admin/email/TemplateBuilderForm';

const EMPTY: TemplateFormValue = { name: '', slug: '', category: 'TRANSACTIONAL', recipientType: '', module: 'system', subject: '' };

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const qc = useQueryClient();
  const id = params.id as string;
  const editorRef = useRef<EmailEditorHandle>(null);

  const [value, setValue] = useState<TemplateFormValue>(EMPTY);
  const [initialDesign, setInitialDesign] = useState<object | null>(null);
  const [initialHtml, setInitialHtml] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const { data: template, isLoading } = useQuery({
    queryKey: ['email-template', id],
    queryFn: () => api.get(`/emails/templates/${id}`).then(r => r.data),
  });

  useEffect(() => {
    if (!template || hydrated) return;
    setValue({
      name: template.name || '',
      slug: template.slug || '',
      category: template.category || 'TRANSACTIONAL',
      recipientType: template.recipientType || '',
      module: template.module || 'system',
      subject: template.subject || '',
    });
    setInitialDesign(template.design || null);
    setInitialHtml(template.html || '');
    setHydrated(true);
  }, [template, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      const { html, design } = await editorRef.current!.exportHtml();
      return api.put(`/emails/templates/${id}`, {
        slug: value.slug,
        name: value.name,
        category: value.category,
        recipientType: value.category === 'CAMPAIGN' && value.recipientType ? value.recipientType : null,
        module: value.module,
        subject: value.subject,
        html,
        design,
      });
    },
    onSuccess: () => {
      toast.success('Template saved');
      qc.invalidateQueries({ queryKey: ['email-template', id] });
      qc.invalidateQueries({ queryKey: ['email-templates'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save template'),
  });

  function submit() {
    if (!value.name.trim()) return toast.error('Name is required');
    if (!value.slug.trim()) return toast.error('Slug is required');
    if (!value.subject.trim()) return toast.error('Subject is required');
    save.mutate();
  }

  if (isLoading || !hydrated) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push('/admin/emails/templates')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Edit Template</h1>
          <p className="text-xs text-gray-400 font-mono">{template?.slug}</p>
        </div>
      </div>

      <TemplateBuilderForm value={value} onChange={patch => setValue(v => ({ ...v, ...patch }))}
        editorRef={editorRef} initialDesign={initialDesign} initialHtml={initialHtml}
        existingMergeTags={template?.mergeTags} version={template?.version} />

      <div className="flex justify-end mt-5">
        <button onClick={submit} disabled={save.isPending} className="btn-primary text-sm py-2.5 px-5 disabled:opacity-60">
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
