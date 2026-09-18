'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { useSettings } from '@/lib/useSettings';
import { CheckCircle, Play, Wallet, Download } from 'lucide-react';
import { buildPayslipHTML } from './_components/payslipEngine';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PROCESSED: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  PAID: 'bg-blue-100 text-blue-700',
};

export default function PayrollPage() {
  const qc = useQueryClient();
  const { fmtCurrency, settings } = useSettings();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payModal, setPayModal] = useState<{ open: boolean; row: any | null }>({ open: false, row: null });

  const { data: payrolls, isLoading } = useQuery({
    queryKey: ['payroll', month, year],
    queryFn: () => api.get(`/payroll?month=${month}&year=${year}`).then(r => r.data),
  });

  const { data: accounts } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api.get('/bank-accounts').then(r => r.data),
    enabled: payModal.open,
  });

  const process = useMutation({
    mutationFn: () => api.post('/payroll/process', { month, year }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['payroll'] }); toast.success(`Processed ${r.data.processed} payrolls`); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll'] }); toast.success('Payroll approved'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to approve payroll'),
  });

  const markPaid = useMutation({
    mutationFn: (body: any) => api.patch(`/payroll/${payModal.row.id}/pay`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Payroll marked paid');
      setPayModal({ open: false, row: null });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to mark paid'),
  });

  function handleMarkPaidSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: any = Object.fromEntries(form.entries());
    if (!body.accountId) delete body.accountId;
    if (!body.paymentMethod) delete body.paymentMethod;
    markPaid.mutate(body);
  }

  function handleDownloadPayslip(row: any) {
    const html = buildPayslipHTML({
      ...row,
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
    });
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 600);
  }

  const columns = [
    { key: 'employee', label: 'Employee', render: (_: any, row: any) => `${row.employee?.firstName} ${row.employee?.lastName}`, exportValue: (r: any) => `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim() },
    { key: 'designation', label: 'Designation', render: (_: any, row: any) => row.employee?.designation, exportValue: (r: any) => r.employee?.designation || '' },
    { key: 'month', label: 'Period', render: (_: any, row: any) => `${row.month}/${row.year}`, exportValue: (r: any) => `${r.month}/${r.year}` },
    { key: 'basicSalary', label: 'Basic', render: (v: number) => fmtCurrency(v) },
    { key: 'grossSalary', label: 'Gross', render: (v: number) => fmtCurrency(v) },
    { key: 'deductions', label: 'Deductions', render: (v: number) => fmtCurrency(v) },
    { key: 'netSalary', label: 'Net Pay', render: (v: number) => <span className="font-semibold">{fmtCurrency(v)}</span> },
    { key: 'status', label: 'Status', render: (v: string) => <span className={`badge ${STATUS_COLORS[v]}`}>{v}</span> },
  ];

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i).toLocaleString('default', { month: 'long' }),
  }));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input w-36">
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-28">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          onClick={() => process.mutate()}
          disabled={process.isPending}
          className="btn-primary text-sm py-2 ml-auto"
        >
          <Play size={14} />
          {process.isPending ? 'Processing...' : `Process Payroll — ${monthOptions[month - 1]?.label} ${year}`}
        </button>
      </div>

      <DataTable
        title={`Payroll — ${monthOptions[month - 1]?.label} ${year} (${payrolls?.length || 0} records)`}
        columns={columns}
        data={payrolls || []}
        isLoading={isLoading}
        actions={(row) => (
          <div className="flex items-center gap-1.5">
            {row.status === 'PROCESSED' && (
              <button
                onClick={() => approve.mutate(row.id)}
                className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100"
              >
                <CheckCircle size={12} /> Approve
              </button>
            )}
            {row.status === 'APPROVED' && (
              <button
                onClick={() => setPayModal({ open: true, row })}
                className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100"
              >
                <Wallet size={12} /> Mark Paid
              </button>
            )}
            <button
              onClick={() => handleDownloadPayslip(row)}
              className="flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <Download size={12} /> Payslip
            </button>
          </div>
        )}
      />

      <Modal isOpen={payModal.open} onClose={() => setPayModal({ open: false, row: null })} title="Mark Payroll Paid">
        <form onSubmit={handleMarkPaidSubmit} className="space-y-4">
          {payModal.row && (
            <p className="text-sm text-gray-500">
              {payModal.row.employee?.firstName} {payModal.row.employee?.lastName} — {payModal.row.month}/{payModal.row.year} ·{' '}
              <span className="font-semibold text-gray-800">{fmtCurrency(payModal.row.netSalary)}</span>
            </p>
          )}
          <div>
            <label className="label">Pay From Account</label>
            <select name="accountId" className="input" defaultValue="">
              <option value="">— None (record without a transaction) —</option>
              {accounts?.filter((a: any) => a.isActive !== false).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} ({fmtCurrency(a.currentBalance)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <input name="paymentMethod" className="input" placeholder="e.g. Bank Transfer" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setPayModal({ open: false, row: null })} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={markPaid.isPending} className="btn-primary text-sm py-2">
              {markPaid.isPending ? 'Saving...' : 'Mark Paid'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
