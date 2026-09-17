'use client';
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
    const html = buildPrintHTML({
      ...doc,
      items: doc.items || [],
      dateFormat: doc.dateFormat || 'DD/MM/YYYY',
      issueDate: doc.issueDate ? doc.issueDate.split('T')[0] : '',
      dueDate:   doc.dueDate   ? doc.dueDate.split('T')[0]   : '',
      validUntil:doc.validUntil? doc.validUntil.split('T')[0]: '',
    });
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 600);
  }

  const del = useMutation({
    mutationFn: () => api.delete(`/invoices/${id}`),
    onSuccess: () => { toast.success('Deleted'); router.push('/admin/crm/invoices'); },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.put(`/invoices/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success('Status updated'); },
  });

  const duplicate = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/duplicate`).then(r => r.data),
    onSuccess: (d: any) => { router.push(`/admin/crm/invoices/${d.id}/edit`); toast.success('Duplicated'); },
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
            <button onClick={() => updateStatus.mutate('SENT')}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors">
              <Mail size={12}/> Mark Sent
            </button>
          )}
          {['SENT','OVERDUE'].includes(doc.status) && (
            <button onClick={() => updateStatus.mutate('PAID')}
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

      {/* Document */}
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white px-8 py-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-primary-400 rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-lg">{(doc.fromName||'A')[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-black text-lg tracking-wide">{doc.fromName || 'Al Khadim LLC'}</p>
                    {doc.fromAddress && <p className="text-gray-400 text-xs leading-relaxed mt-0.5 max-w-xs">{doc.fromAddress}</p>}
                    {doc.fromEmail   && <p className="text-gray-400 text-xs">{doc.fromEmail}</p>}
                    {doc.fromPhone   && <p className="text-gray-400 text-xs">{doc.fromPhone}</p>}
                  </div>
                </div>
                {(doc.fromTaxNo || doc.fromRegNo) && (
                  <div className="flex gap-4 mt-1">
                    {doc.fromTaxNo && <p className="text-gray-300 text-xs font-mono">Tax No: {doc.fromTaxNo}</p>}
                    {doc.fromRegNo && <p className="text-gray-300 text-xs font-mono">Reg No: {doc.fromRegNo}</p>}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black tracking-[0.12em] text-white/90">{docLabel}</p>
                <p className="font-mono text-primary-300 mt-1">{doc.invoiceNo}</p>
                <span className={`mt-2 inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[doc.status]||'bg-gray-100 text-gray-500'}`}>
                  {doc.status}
                </span>
              </div>
            </div>
          </div>

          {/* Meta bar */}
          <div className="grid grid-cols-3 border-b border-gray-100 bg-gray-50">
            <div className="px-6 py-4 border-r border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Billed To</p>
              <p className="font-bold text-gray-800 text-sm">{doc.billingName || doc.client?.companyName}</p>
              {doc.billingEmail && <p className="text-xs text-gray-400 mt-0.5">{doc.billingEmail}</p>}
              {doc.billingPhone && <p className="text-xs text-gray-400">{doc.billingPhone}</p>}
              {doc.billingAddress && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{doc.billingAddress}</p>}
            </div>
            <div className="px-6 py-4 border-r border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Issue Date</p>
              <p className="font-semibold text-gray-700">{new Date(doc.issueDate).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</p>
              {(doc.dueDate || doc.validUntil) && (
                <>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 mt-3">
                    {doc.docType==='QUOTATION'?'Valid Until':'Due Date'}
                  </p>
                  <p className={`font-semibold ${isOverdue?'text-red-500':'text-gray-700'}`}>
                    {new Date(doc.dueDate||doc.validUntil).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
                  </p>
                </>
              )}
            </div>
            <div className="px-6 py-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Amount</p>
              <p className="text-xl font-black text-primary-600">{fmtN(doc.totalAmount, doc.currency)}</p>
              {doc.paidDate && (
                <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
                  <CheckCircle2 size={11}/> Paid {new Date(doc.paidDate).toLocaleDateString('en-GB')}
                </p>
              )}
            </div>
          </div>

          {/* Subject */}
          {doc.subject && (
            <div className="px-8 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-800">{doc.subject}</p>
              {doc.description && <p className="text-sm text-gray-400 mt-0.5">{doc.description}</p>}
            </div>
          )}

          {/* Items */}
          <div className="px-8 py-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left pb-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Description</th>
                  <th className="text-center pb-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide w-20">Qty</th>
                  <th className="text-center pb-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide w-16">Unit</th>
                  <th className="text-right pb-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide w-28">Unit Price</th>
                  <th className="text-right pb-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={item.id||i} className="border-b border-gray-50">
                    <td className="py-3 text-gray-700 font-medium">{item.description}</td>
                    <td className="py-3 text-center text-gray-500">{item.qty}</td>
                    <td className="py-3 text-center text-gray-400 text-xs">{item.unit||'—'}</td>
                    <td className="py-3 text-right text-gray-600">{fmtN(item.unitPrice, doc.currency)}</td>
                    <td className="py-3 text-right font-semibold text-gray-800">{fmtN(item.total, doc.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>{fmtN(doc.subtotal, doc.currency)}</span>
                </div>
                {doc.discount > 0 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Discount {doc.discountType==='PERCENT'?`(${doc.discount}%)`:'(Fixed)'}</span>
                    <span className="text-red-500">- {fmtN(doc.discount > 0 && doc.discountType==='PERCENT' ? doc.subtotal*(doc.discount/100) : doc.discount, doc.currency)}</span>
                  </div>
                )}
                {doc.tax > 0 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>VAT ({doc.taxRate}%)</span>
                    <span>{fmtN(doc.tax, doc.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-gray-900 border-t-2 border-gray-900 pt-2 text-base">
                  <span>TOTAL</span>
                  <span className="text-primary-600">{fmtN(doc.totalAmount, doc.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bank details */}
          {(doc.bankName || doc.bankIBAN) && (
            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Payment Details</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                {doc.bankName      && <><span className="text-gray-400">Bank Name</span><span className="font-semibold text-gray-700">{doc.bankName}</span></>}
                {doc.bankAccount   && <><span className="text-gray-400">Account No.</span><span className="font-semibold text-gray-700 font-mono">{doc.bankAccount}</span></>}
                {doc.bankIBAN      && <><span className="text-gray-400">IBAN</span><span className="font-semibold text-gray-700 font-mono">{doc.bankIBAN}</span></>}
                {doc.bankSwift     && <><span className="text-gray-400">SWIFT/BIC</span><span className="font-semibold text-gray-700 font-mono">{doc.bankSwift}</span></>}
                {doc.bankRoutingNo && <><span className="text-gray-400">Routing No.</span><span className="font-semibold text-gray-700 font-mono">{doc.bankRoutingNo}</span></>}
                {doc.bankSortCode  && <><span className="text-gray-400">Sort Code</span><span className="font-semibold text-gray-700 font-mono">{doc.bankSortCode}</span></>}
              </div>
              {doc.paymentRef && <p className="text-xs text-gray-400 italic mt-2">{doc.paymentRef}</p>}
            </div>
          )}

          {/* Terms */}
          {doc.terms && (
            <div className="px-8 py-5 border-t border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Terms & Conditions</p>
              <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{doc.terms}</p>
            </div>
          )}

          {/* Notes */}
          {doc.notes && (
            <div className="px-8 py-4 border-t border-gray-100 bg-amber-50">
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-amber-700">{doc.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-900 text-center">
            <p className="text-gray-400 text-xs">
              {doc.footerText || `Thank you for your business · ${doc.fromName || 'Company'}`}
            </p>
          </div>
        </div>

        {/* Client link */}
        {doc.client && (
          <div className="mt-4 flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
            <span className="text-sm text-gray-500">Client: <span className="font-semibold text-gray-800">{doc.client.companyName}</span></span>
            <Link href={`/admin/crm/clients/${doc.clientId}`}
              className="text-xs font-bold text-primary-500 hover:underline">View Client Profile →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
