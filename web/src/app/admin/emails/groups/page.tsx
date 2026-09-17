'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import { Eye, Pencil, Trash2 } from 'lucide-react';

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-AE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

interface EmailGroup {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description', render: (v: string | null) => v || '—' },
  { key: 'memberCount', label: 'Member Count' },
  { key: 'updatedAt', label: 'Updated At', render: (v: string) => fmtDate(v) },
];

export default function EmailGroupsListPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmailGroup | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<EmailGroup | null>(null);

  const { data = [], isLoading } = useQuery<EmailGroup[]>({
    queryKey: ['email-groups'],
    queryFn: () => api.get('/emails/groups').then(r => r.data),
  });

  const create = useMutation({
    mutationFn: (payload: { name: string; description?: string }) => api.post('/emails/groups', payload),
    onSuccess: ({ data: group }) => {
      toast.success('Group created');
      qc.invalidateQueries({ queryKey: ['email-groups'] });
      closeModal();
      router.push(`/admin/emails/groups/${group.id}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create group'),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; description?: string } }) =>
      api.put(`/emails/groups/${id}`, payload),
    onSuccess: () => {
      toast.success('Group updated');
      qc.invalidateQueries({ queryKey: ['email-groups'] });
      closeModal();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update group'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/emails/groups/${id}`),
    onSuccess: () => {
      toast.success('Group deleted');
      qc.invalidateQueries({ queryKey: ['email-groups'] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete group'),
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '' });
    setModalOpen(true);
  }

  function openEdit(group: EmailGroup) {
    setEditing(group);
    setForm({ name: group.name, description: group.description || '' });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    const payload = { name: form.name.trim(), description: form.description.trim() || undefined };
    if (editing) update.mutate({ id: editing.id, payload });
    else create.mutate(payload);
  }

  const saving = create.isPending || update.isPending;

  return (
    <>
      <DataTable
        title={`Groups (${data.length})`}
        columns={columns}
        data={data}
        isLoading={isLoading}
        onAdd={openCreate}
        addLabel="New Group"
        actions={(row: EmailGroup) => (
          <div className="flex items-center gap-1">
            <button onClick={() => router.push(`/admin/emails/groups/${row.id}`)} title="View group"
              className="p-1.5 hover:bg-primary-50 rounded-lg text-primary-600 transition-colors">
              <Eye size={14} />
            </button>
            <button onClick={() => openEdit(row)} title="Rename"
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <Pencil size={14} />
            </button>
            <button onClick={() => setDeleteTarget(row)} title="Delete"
              className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      />

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Rename Group' : 'New Group'} size="sm">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-4 disabled:opacity-60">
              {saving ? 'Saving…' : editing ? 'Save' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Group" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          This permanently deletes &ldquo;{deleteTarget?.name}&rdquo; and all its members. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteTarget(null)} className="text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => deleteTarget && remove.mutate(deleteTarget.id)} disabled={remove.isPending}
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-60">
            {remove.isPending ? 'Deleting…' : 'Delete Group'}
          </button>
        </div>
      </Modal>
    </>
  );
}
