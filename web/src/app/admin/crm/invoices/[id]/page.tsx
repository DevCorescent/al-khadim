'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ChevronRight, Edit2, Copy, Trash2, Printer,
  Mail, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { buildPrintHTML } from '../_components/printEngine';
import MarkPaidModal from '../_components/MarkPaidModal';
import PrintPreview from '../_components/PrintPreview';

/** API invoice → print-engine input. */
function printable(doc: any) {
  return {
    ...doc,
    items: doc.items || [],
    dateFormat: doc.designOptions?.dateFormat || doc.dateFormat || 'DD/MM/YYYY',
    issueDate: doc.issueDate ? doc.issueDate.split('T')[0] : '',
    dueDate:   doc.dueDate   ? doc.dueDate.split('T')[0]   : '',
    validUntil:doc.validUntil? doc.validUntil.split('T')[0]: '',
  };
}

const STATUS_COLORS: Record<string,string> = {
  DRAFT:'bg-gray-100 text-gray-500', SENT:'bg-blue-100 text-blue-700',
  PAID:'bg-emerald-100 text-emerald-700', OVERDUE:'bg-red-100 text-red-600',
  CANCELLED:'bg-gray-100 text-gray-400', ACCEPTED:'bg-teal-100 text-teal-700',
  REJECTED:'bg-red-100 text-red-700', PENDING:'bg-amber-100 text-amber-700',
};
const DOC_LABELS: Record<string,string> = { INVOICE:'INVOICE', PROFORMA_INVOICE:'PROFORMA INVOICE', QUOTATION:'QUOTATION' };
const fmtN = (n: number, cur = 'AED') =>
  `${cur} ${(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function InvoiceViewPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const qc       = useQueryClient();

  const { data: doc, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/invoices/${id}`).then(r => r.data),
  });

  function handlePrint() {
    if (!doc) return;
    const html = buildPrintHTML(printable(doc));
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    // Print once images (the logo) have loaded, or after 3s at most.
    const images = Array.from(win.document.images);
    const loaded = Promise.all(images.map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
    Promise.race([loaded, new Promise(r => setTimeout(r, 3000))])
      .then(() => setTimeout(() => { win.focus(); win.print(); }, 200));
  }

  const [payOpen, setPayOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => api.delete(`/invoices/${id}`),
    onSuccess: () => { toast.success('Deleted'); router.push('/admin/crm/invoices'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ status, accountId }: { status: string; accountId?: string }) =>
      api.put(`/invoices/${id}`, accountId ? { status, accountId } : { status }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      if (vars.accountId) qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success(vars.status === 'PAID' ? (vars.accountId ? 'Marked paid and recorded in Accounts' : 'Marked paid') : 'Status updated');
      setPayOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update status'),
  });

  const duplicate = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/duplicate`).then(r => r.data),
    onSuccess: (d: any) => { router.push(`/admin/crm/invoices/${d.id}/edit`); toast.success('Duplicated'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to duplicate'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin"/>
    </div>
  );
  if (!doc) return <p className="p-8 text-red-500">Document not found.</p>;

  const items     = doc.items || [];
  const docLabel  = DOC_LABELS[doc.docType] || doc.docType;
  const isOverdue = doc.dueDate && new Date(doc.dueDate) < new Date() && doc.status !== 'PAID';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Action bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/crm/invoices')}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50">
            <ArrowLeft size={15} className="text-gray-500"/>
          </button>
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <Link href="/admin/crm/invoices" className="hover:text-gray-600">Documents</Link>
            <ChevronRight size={12}/>
            <span className="text-gray-700 font-bold font-mono">{doc.invoiceNo}</span>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[doc.status]||'bg-gray-100 text-gray-500'}`}>
            {doc.status}
          </span>
          {isOverdue && <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1"><AlertCircle size={9}/> OVERDUE</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Quick status actions */}
          {doc.status === 'DRAFT' && (
            <button onClick={() => updateStatus.mutate({ status: 'SENT' })}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors">
              <Mail size={12}/> Mark Sent
            </button>
          )}
          {['SENT','OVERDUE'].includes(doc.status) && (
            <button onClick={() => setPayOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors">
              <CheckCircle2 size={12}/> Mark Paid
            </button>
          )}
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors">
            <Printer size={12}/> Print
          </button>
          <button onClick={() => duplicate.mutate()}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors">
            <Copy size={12}/> Duplicate
          </button>
          <button onClick={() => router.push(`/admin/crm/invoices/${id}/edit`)}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-primary-400 hover:bg-primary-500 px-3 py-1.5 rounded-xl transition-colors">
            <Edit2 size={12}/> Edit
          </button>
          <button onClick={() => { if(confirm('Delete this document?')) del.mutate(); }}
            className="p-1.5 hover:bg-red-50 rounded-xl text-red-400 border border-transparent hover:border-red-200 transition-colors">
            <Trash2 size={14}/>
          </button>
        </div>
      </div>

      {/* Document — the real print output, so what you see is exactly what prints */}
      <div className="w-full p-4 sm:p-6">
        <div className="max-w-[880px] mx-auto">
          <PrintPreview invoice={printable(doc)} />
        </div>

        {/* Client link */}
        {doc.client && (
          <div className="max-w-[880px] mx-auto mt-4 flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
            <span className="text-sm text-gray-500">Client: <span className="font-semibold text-gray-800">{doc.client.companyName}</span></span>
            <Link href={`/admin/crm/clients/${doc.clientId}`}
              className="text-xs font-bold text-primary-500 hover:underline">View Client Profile →</Link>
          </div>
        )}
      </div>
      <MarkPaidModal
        invoice={payOpen ? doc : null}
        onClose={() => setPayOpen(false)}
        saving={updateStatus.isPending}
        onConfirm={accountId => updateStatus.mutate({ status: 'PAID', accountId })}
      />
    </div>
  );
}
