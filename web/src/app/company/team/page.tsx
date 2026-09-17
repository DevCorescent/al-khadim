'use client';
import { useState } from 'react';
import { useClientAuth, clientApi } from '@/lib/clientAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserPlus, Send, Power, Users2 } from 'lucide-react';

export default function CompanyTeamPage() {
  const { accessToken, clientUser } = useClientAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'COMPANY_ADMIN' | 'COMPANY_MEMBER'>('COMPANY_MEMBER');

  const { data: team, isLoading } = useQuery({
    queryKey: ['company-team'],
    queryFn: () => clientApi(accessToken!).get('/api/client-auth/team').then(r => r.data),
    enabled: !!accessToken,
  });

  const inviteMutation = useMutation({
    mutationFn: () => clientApi(accessToken!).post('/api/client-auth/team/invite', { name, email, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-team'] });
      toast.success('Invite sent');
      setOpen(false); setName(''); setEmail(''); setRole('COMPANY_MEMBER');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to invite'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => clientApi(accessToken!).patch(`/api/client-auth/team/${id}/toggle-active`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-team'] }); toast.success('Updated'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update'),
  });

  if (clientUser?.role !== 'COMPANY_ADMIN') {
    return <div className="p-8 text-center text-gray-400 text-sm">Only company admins can manage the team.</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Team</h1>
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 bg-primary-400 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-primary-500 transition-colors">
          <UserPlus size={13} /> Invite Teammate
        </button>
      </div>

      {open && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 grid sm:grid-cols-4 gap-3 items-end mb-4">
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name</label>
            <input className="input text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email</label>
            <input className="input text-sm" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@company.com" />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Role</label>
            <select className="input text-sm" value={role} onChange={e => setRole(e.target.value as any)}>
              <option value="COMPANY_MEMBER">Member</option>
              <option value="COMPANY_ADMIN">Admin</option>
            </select>
          </div>
          <button onClick={() => inviteMutation.mutate()} disabled={!name || !email || inviteMutation.isPending}
            className="btn-primary text-sm py-2.5 justify-center disabled:opacity-50">
            {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-800 text-sm">Team Members ({team?.length || 0})</p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : (team || []).length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No teammates yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {team.map((u: any) => (
              <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-800">{u.name}</p>
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{u.role === 'COMPANY_ADMIN' ? 'Admin' : 'Member'}</span>
                    {!u.acceptedAt && <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Invite Pending</span>}
                    {!u.isActive && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Deactivated</span>}
                  </div>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                {u.id !== clientUser?.id && (
                  <button onClick={() => toggleMutation.mutate(u.id)} title={u.isActive ? 'Deactivate' : 'Activate'}
                    className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-red-400 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                    <Power size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
