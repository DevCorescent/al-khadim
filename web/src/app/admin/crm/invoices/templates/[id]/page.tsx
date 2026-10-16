'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import InvoiceBuilder from '../../_components/InvoiceBuilder';

/** Template studio: edit a saved template with the full builder. */
export default function EditInvoiceTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const { data: templates, isLoading } = useQuery({
    queryKey: ['invoice-templates'],
    queryFn: () => api.get('/invoice-templates').then(r => r.data as any[]),
  });
  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );
  const template = templates?.find(t => t.id === id);
  if (!template) return <p className="p-8 text-red-500">Template not found.</p>;
  return <InvoiceBuilder key={template.id} templateMode={{ template }} />;
}
