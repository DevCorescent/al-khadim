'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { Pencil, Trash2, ClipboardList } from 'lucide-react';

const columns = [
  {
    key: 'name', label: 'Industry',
    render: (v: string, row: any) => (
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: row.color }} />
        <span className="font-semibold text-gray-800">{v}</span>
        <span className="text-[10px] font-mono text-gray-400">{row.key}</span>
      </div>
    ),
  },
  { key: 'description', label: 'Description', render: (v: string) => v || <span className="text-gray-300">—</span> },
  {
    key: 'hasTracking', label: 'Tracking',
    render: (v: boolean, row: any) => v
      ? <Link href={`/admin/settings/industries/${row.id}/template`} className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1 w-fit hover:bg-indigo-200 transition-colors"><ClipboardList size={10} /> Configure Template</Link>
      : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 w-fit">Off</span>,
  },
];

export default function IndustriesSettingsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['industries-admin'],
    queryFn: () => api.get('/industries').then((r) => r.data),
    staleTime: 0,
  });

  const save = useMutation({
    mutationFn: (d: any) => (editing ? api.put(`/industries/${editing.id}`, d) : api.post('/industries', d)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['industries-admin'] });
      qc.invalidateQueries({ queryKey: ['industries'] });
      toast.success(editing ? 'Industry updated' : 'Industry added');
      setModal(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/industries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['industries-admin'] });
      qc.invalidateQueries({ queryKey: ['industries'] });
      toast.success('Industry deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: any = Object.fromEntries(form.entries());
    body.hasTracking = body.hasTracking === 'on';
    save.mutate(body);
  }

  return (
    <>
      <DataTable
        title={`Industries (${data?.length || 0})`}
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        onAdd={() => { setEditing(null); setModal(true); }}
        addLabel="Add Industry"
        exportFilename="industries"
        importConfig={{
          endpoint: '/industries',
          fields: [
            { key: 'name', label: 'Industry Name', required: true },
            { key: 'description', label: 'Description' },
            { key: 'color', label: 'Color (hex)' },
          ],
        }}
        onImportDone={() => { qc.invalidateQueries({ queryKey: ['industries-admin'] }); qc.invalidateQueries({ queryKey: ['industries'] }); }}
        actions={(row) => (
          <div className="flex gap-1.5">
            <button onClick={() => { setEditing(row); setModal(true); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={14} /></button>
            <button onClick={() => { if (confirm(`Delete industry "${row.name}"?`)) del.mutate(row.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
          </div>
        )}
      />

      <Modal isOpen={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Edit Industry' : 'Add Industry'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input name="name" required defaultValue={editing?.name} className="input" placeholder="e.g. Retail" />
            {editing && <p className="text-[11px] text-gray-400 mt-1">Machine key: <span className="font-mono">{editing.key}</span> (fixed once created)</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea name="description" defaultValue={editing?.description} rows={2} className="input resize-none" />
          </div>
          <div>
            <label className="label">Color</label>
            <input name="color" type="color" defaultValue={editing?.color || '#6366f1'} className="h-10 w-20 rounded-lg border border-gray-200" />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" name="hasTracking" defaultChecked={editing?.hasTracking} />
            Enable SOP/KPI tracking for this industry
          </label>
          <p className="text-[11px] text-gray-400 -mt-2">
            After saving, use "Configure Template" on the list to build its tracking sections/fields.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary text-sm py-2">
              {save.isPending ? 'Saving...' : editing ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
