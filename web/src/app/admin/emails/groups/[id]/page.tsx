'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Modal from '@/components/admin/Modal';
import RecipientDirectory, { DirectorySelection } from '@/components/admin/email/RecipientDirectory';
import { RECIPIENT_TYPES } from '@/components/admin/email/AudiencePicker';
import { ArrowLeft, Pencil, Plus, Trash2, Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-AE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const LIMIT = 20;

export default function EmailGroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const qc = useQueryClient();
  const id = params.id as string;

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  // Debounce search input -> search query param
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: group, isLoading } = useQuery({
    queryKey: ['email-group', id, page, search],
    queryFn: () => api.get(`/emails/groups/${id}`, { params: { page, limit: LIMIT, search: search || undefined } }).then(r => r.data),
  });

  const update = useMutation({
    mutationFn: (payload: { name?: string; description?: string }) => api.put(`/emails/groups/${id}`, payload),
    onSuccess: () => {
      toast.success('Group updated');
      qc.invalidateQueries({ queryKey: ['email-group', id] });
      qc.invalidateQueries({ queryKey: ['email-groups'] });
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update group'),
  });

  const addMembers = useMutation({
    mutationFn: (members: DirectorySelection[]) => api.post(`/emails/groups/${id}/members`, { members }),
    onSuccess: (res) => {
      toast.success(`Added ${res.data?.added ?? ''} member${res.data?.added === 1 ? '' : 's'}`.trim());
      qc.invalidateQueries({ queryKey: ['email-group', id] });
      qc.invalidateQueries({ queryKey: ['email-groups'] });
      setDirectoryOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to add members'),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/emails/groups/${id}/members/${memberId}`),
    onSuccess: () => {
      toast.success('Member removed');
      qc.invalidateQueries({ queryKey: ['email-group', id] });
      qc.invalidateQueries({ queryKey: ['email-groups'] });
      setRemoveTarget(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to remove member'),
  });

  function openEdit() {
    if (!group) return;
    setForm({ name: group.name, description: group.description || '' });
    setEditOpen(true);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    update.mutate({ name: form.name.trim(), description: form.description.trim() || undefined });
  }

  if (isLoading || !group) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>;
  }

  const members = group.members || { data: [], total: 0, page: 1, limit: LIMIT };
  const totalPages = Math.ceil(members.total / (members.limit || LIMIT));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/emails/groups')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{group.name}</h1>
            <p className="text-xs text-gray-400">{group.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openEdit}
            className="text-sm font-semibold px-3.5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
            <Pencil size={13} /> Edit
          </button>
          <button onClick={() => setDirectoryOpen(true)} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
            <Plus size={14} /> Add Members
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Members</p>
          <p className="text-lg font-bold text-gray-900 flex items-center gap-1.5"><Users size={16} className="text-primary-500" /> {members.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Created</p>
          <p className="text-sm font-semibold text-gray-700">{fmtDate(group.createdAt)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Updated</p>
          <p className="text-sm font-semibold text-gray-700">{fmtDate(group.updatedAt)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-gray-900">Members</h3>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search members..."
              className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>
        {members.data.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No members yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Recipient Type</th>
                  <th className="px-4 py-2">Added At</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.data.map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{m.name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{m.email}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {RECIPIENT_TYPES.find(rt => rt.value === m.recipientType)?.label || m.recipientType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(m.addedAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setRemoveTarget({ id: m.id, name: m.name || m.email })} title="Remove member"
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft size={14} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Group" size="sm">
        <form onSubmit={submitEdit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditOpen(false)} className="text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={update.isPending} className="btn-primary text-sm py-2 px-4 disabled:opacity-60">
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove Member" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Remove &ldquo;{removeTarget?.name}&rdquo; from this group?
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setRemoveTarget(null)} className="text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => removeTarget && removeMember.mutate(removeTarget.id)} disabled={removeMember.isPending}
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-60">
            {removeMember.isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </Modal>

      <RecipientDirectory
        open={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        confirmLabel="Add Members"
        onConfirm={(selection) => addMembers.mutate(selection)}
      />
    </div>
  );
}
