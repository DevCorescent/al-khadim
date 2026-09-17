'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { Pencil, Trash2 } from 'lucide-react';

const columns = [
  {
    key: 'name', label: 'Category',
    render: (v: string, row: any) => (
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: row.color }} />
        <span className="font-semibold text-gray-800">{v}</span>
      </div>
    ),
  },
  { key: 'description', label: 'Description', render: (v: string) => v || <span className="text-gray-300">—</span> },
];

export default function CategoriesSettingsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['categories-admin'],
    queryFn: () => api.get('/categories').then((r) => r.data),
    staleTime: 0,
  });

  const save = useMutation({
    mutationFn: (d: any) => (editing ? api.put(`/categories/${editing.id}`, d) : api.post('/categories', d)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories-admin'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success(editing ? 'Category updated' : 'Category added');
      setModal(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories-admin'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    save.mutate(Object.fromEntries(form.entries()));
  }

  return (
    <>
      <DataTable
        title={`Categories (${data?.length || 0})`}
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        onAdd={() => { setEditing(null); setModal(true); }}
        addLabel="Add Category"
        exportFilename="categories"
        importConfig={{
          endpoint: '/categories',
          fields: [
            { key: 'name', label: 'Category Name', required: true },
            { key: 'description', label: 'Description' },
            { key: 'color', label: 'Color (hex)' },
          ],
        }}
        onImportDone={() => { qc.invalidateQueries({ queryKey: ['categories-admin'] }); qc.invalidateQueries({ queryKey: ['categories'] }); }}
        actions={(row) => (
          <div className="flex gap-1.5">
            <button onClick={() => { setEditing(row); setModal(true); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={14} /></button>
            <button onClick={() => { if (confirm(`Delete category "${row.name}"?`)) del.mutate(row.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
          </div>
        )}
      />

      <Modal isOpen={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Edit Category' : 'Add Category'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input name="name" required defaultValue={editing?.name} className="input" placeholder="e.g. Engineering" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea name="description" defaultValue={editing?.description} rows={2} className="input resize-none" />
          </div>
          <div>
            <label className="label">Color</label>
            <input name="color" type="color" defaultValue={editing?.color || '#6366f1'} className="h-10 w-20 rounded-lg border border-gray-200" />
          </div>
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
