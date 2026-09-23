'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { Trash2, Download, AlertCircle } from 'lucide-react';

const DOC_TYPES = ['PASSPORT', 'VISA', 'OFFER_LETTER', 'CONTRACT', 'CV', 'CERTIFICATE', 'ID_PROOF', 'OTHER'];

const columns = [
  { key: 'title', label: 'Document Title' },
  { key: 'type', label: 'Type', render: (v: string) => <span className="badge bg-blue-100 text-blue-700">{v}</span> },
  { key: 'employee', label: 'Employee', render: (_: any, r: any) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—', exportValue: (r: any) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '' },
  { key: 'candidate', label: 'Candidate', render: (_: any, r: any) => r.candidate ? `${r.candidate.firstName} ${r.candidate.lastName}` : '—', exportValue: (r: any) => r.candidate ? `${r.candidate.firstName} ${r.candidate.lastName}` : '' },
  { key: 'expiryDate', label: 'Expiry', render: (v: string) => {
    if (!v) return '—';
    const d = new Date(v);
    const diff = (d.getTime() - Date.now()) / (1000 * 86400);
    return <span className={diff < 30 ? 'text-red-500 font-medium flex items-center gap-1' : ''}>{diff < 30 && <AlertCircle size={12} />}{d.toLocaleDateString()}</span>;
  }},
  { key: 'uploadedBy', label: 'Uploaded By' },
  { key: 'createdAt', label: 'Date', render: (v: string) => new Date(v).toLocaleDateString() },
];

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get('/documents').then(r => r.data),
  });
  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    // Optional employee picker: roles without employees:view get an empty list, not a "no permission" toast.
    queryFn: () => api.get('/employees?limit=200', { forbiddenToast: false }).then(r => r.data.data),
  });

  const upload = useMutation({
    mutationFn: (d: FormData) => api.post('/documents', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Document uploaded'); setModal(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Deleted'); },
  });

  // The download endpoint needs the Bearer token, so fetch it through the API
  // client (a plain link sends no Authorization header) and save the blob.
  const handleDownload = async (row: any) => {
    try {
      const res = await api.get(`/documents/${row.id}/download`, { responseType: 'blob' });
      const disposition: string = res.headers['content-disposition'] || '';
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
      const plain = /filename="([^"]+)"/i.exec(disposition);
      const filename = encoded ? decodeURIComponent(encoded[1]) : plain?.[1] || row.title || 'document';
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download document');
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    upload.mutate(new FormData(e.currentTarget));
  };

  return (
    <>
      <DataTable
        title={`Documents (${docs?.length || 0})`}
        columns={columns}
        data={docs || []}
        isLoading={isLoading}
        onAdd={() => setModal(true)}
        addLabel="Upload Document"
        actions={(row) => (
          <div className="flex gap-1.5">
            <button
              onClick={() => handleDownload(row)}
              title="Download"
              className="p-1.5 hover:bg-blue-50 rounded text-blue-600"
            >
              <Download size={14} />
            </button>
            <button onClick={() => { if (confirm('Delete?')) del.mutate(row.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      />

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Upload Document">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Document Title *</label>
            <input name="title" required className="input" placeholder="e.g. Passport Copy - John" />
          </div>
          <div>
            <label className="label">Document Type *</label>
            <select name="type" required className="input">
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Employee (if applicable)</label>
            <select name="employeeId" className="input">
              <option value="">None</option>
              {(employees || []).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Expiry Date</label>
            <input name="expiryDate" type="date" className="input" />
          </div>
          <div>
            <label className="label">File *</label>
            <input name="file" type="file" required className="input" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea name="notes" rows={2} className="input resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={upload.isPending} className="btn-primary text-sm py-2">
              {upload.isPending ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
