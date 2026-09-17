'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { EmailEditorHandle } from '@/components/admin/email/EmailEditor';
import TemplateBuilderForm, { TemplateFormValue } from '@/components/admin/email/TemplateBuilderForm';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function NewTemplatePage() {
  const router = useRouter();
  const editorRef = useRef<EmailEditorHandle>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const [value, setValue] = useState<TemplateFormValue>({
    name: '', slug: '', category: 'TRANSACTIONAL', recipientType: '', module: 'system', subject: '',
  });

  function onChange(patch: Partial<TemplateFormValue>) {
    setValue(v => {
      const next = { ...v, ...patch };
      if (patch.name !== undefined && !slugTouched) next.slug = slugify(patch.name);
      if (patch.slug !== undefined) setSlugTouched(true);
      return next;
    });
  }

  const create = useMutation({
    mutationFn: async () => {
      const { html, design } = await editorRef.current!.exportHtml();
      return api.post('/emails/templates', {
        slug: value.slug,
        name: value.name,
        category: value.category,
        recipientType: value.category === 'CAMPAIGN' && value.recipientType ? value.recipientType : undefined,
        module: value.module,
        subject: value.subject,
        html,
        design,
      });
    },
    onSuccess: (res) => {
      toast.success('Template created');
      router.push(`/admin/emails/templates/${res.data.id}/edit`);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create template'),
  });

  function submit() {
    if (!value.name.trim()) return toast.error('Name is required');
    if (!value.slug.trim()) return toast.error('Slug is required');
    if (!value.subject.trim()) return toast.error('Subject is required');
    create.mutate();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push('/admin/emails/templates')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">New Template</h1>
          <p className="text-xs text-gray-400">Build reusable email content for transactional or campaign use</p>
        </div>
      </div>

      <TemplateBuilderForm value={value} onChange={onChange} editorRef={editorRef} />

      <div className="flex justify-end mt-5">
        <button onClick={submit} disabled={create.isPending} className="btn-primary text-sm py-2.5 px-5 disabled:opacity-60">
          {create.isPending ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}
