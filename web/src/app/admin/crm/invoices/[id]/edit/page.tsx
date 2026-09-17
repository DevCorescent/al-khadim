'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import InvoiceBuilder from '../../_components/InvoiceBuilder';

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/invoices/${id}`).then(r => r.data),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin"/>
    </div>
  );
  if (!data) return <p className="p-8 text-red-500">Document not found.</p>;
  return <InvoiceBuilder existing={data} />;
}
