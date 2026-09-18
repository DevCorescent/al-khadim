'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth, useCan } from '@/lib/auth';
import Link from 'next/link';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, KeyRound,
  Shield, ShieldCheck, Users, UserCheck, Eye, EyeOff,
  Search, Filter, ChevronDown, X, Loader2, ShieldAlert,
  Mail, Phone, Building2, Clock, CheckCircle, XCircle,
} from 'lucide-react';

const ROLES = ['SUPER_ADMIN','ADMIN','MANAGER','RECRUITER','HR','ACCOUNTANT','VIEWER'] as const;
type RoleType = typeof ROLES[number];

const ROLE_CONFIG: Record<RoleType, { label: string; color: string; bg: string; icon: any }> = {
  SUPER_ADMIN: { label: 'Super Admin',  color: 'text-purple-700', bg: 'bg-purple-100', icon: ShieldAlert },
  ADMIN:       { label: 'Admin',        color: 'text-blue-700',   bg: 'bg-blue-100',   icon: ShieldCheck },
  MANAGER:     { label: 'Manager',      color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Shield },
  RECRUITER:   { label: 'Recruiter',    color: 'text-emerald-700',bg: 'bg-emerald-100',icon: UserCheck },
  HR:          { label: 'HR',           color: 'text-teal-700',   bg: 'bg-teal-100',   icon: Users },
  ACCOUNTANT:  { label: 'Accountant',   color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Building2 },
  VIEWER:      { label: 'Viewer',       color: 'text-gray-600',   bg: 'bg-gray-100',   icon: Eye },
};

function RoleBadge({ role, customRole }: { role: string; customRole?: string }) {
  if (customRole) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
        <Shield size={10} /> {customRole}
      </span>
    );
  }
  const cfg = ROLE_CONFIG[role as RoleType] || ROLE_CONFIG.VIEWER;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm'|'md'|'lg' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '?';
  const colors = ['bg-blue-500','bg-emerald-500','bg-purple-500','bg-amber-500','bg-rose-500','bg-indigo-500','bg-teal-500'];
  const color  = colors[name?.charCodeAt(0) % colors.length] || 'bg-gray-400';
  const sz     = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
      {initials}
    </div>
  );
}

/* ── User Form Modal ── */
function UserModal({ open, onClose, editing, roles }: {
  open: boolean; onClose: () => void; editing: any; roles: any[];
}) {
  const qc = useQueryClient();
  const [showPass, setShowPass] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>(editing?.role || 'RECRUITER');
  const [customRole, setCustomRole] = useState(editing?.customRole || '');

  const save = useMutation({
    mutationFn: (body: any) => editing
      ? api.put(`/users/${editing.id}`, body)
      : api.post('/users', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(editing ? 'User updated!' : 'User created!');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error saving user'),
  });

  if (!open) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = Object.fromEntries(fd.entries());
    body.role = selectedRole;
    body.customRole = customRole || null;
    if (!editing) delete body.customRole; // only set on edit if explicitly chosen
    save.mutate(body);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center">
              {editing ? <Pencil size={14} className="text-primary-500" /> : <Plus size={14} className="text-primary-500" />}
            </div>
            <h2 className="font-bold text-gray-900">{editing ? 'Edit User' : 'Create New User'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name *</label>
              <input name="name" required defaultValue={editing?.name}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email *</label>
              <input name="email" type="email" required defaultValue={editing?.email} disabled={!!editing}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 bg-white disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Phone</label>
              <input name="phone" defaultValue={editing?.phone}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Department</label>
              <input name="department" defaultValue={editing?.department} placeholder="e.g. Recruitment"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 bg-white" />
            </div>
          </div>

          {!editing && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password *</label>
              <div className="relative">
                <input name="password" type={showPass ? 'text' : 'password'} required minLength={8}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 bg-white" />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Min 8 characters</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">System Role *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROLES.map(r => {
                const cfg = ROLE_CONFIG[r];
                const Icon = cfg.icon;
                return (
                  <button key={r} type="button" onClick={() => setSelectedRole(r)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                      selectedRole === r ? `${cfg.bg} ${cfg.color} border-current` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}>
                    <Icon size={12} /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {roles.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Custom Role Label <span className="text-gray-300 font-normal">(optional)</span></label>
              <select value={customRole} onChange={e => setCustomRole(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white">
                <option value="">None — use system role</option>
                {roles.map((r: any) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={save.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary-400 text-white rounded-xl text-sm font-bold hover:bg-primary-500 transition-all disabled:opacity-60">
              {save.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
              {editing ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Reset Password Modal ── */
function ResetPasswordModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [showPass, setShowPass] = useState(false);
  const qc = useQueryClient();
  const reset = useMutation({
    mutationFn: (body: any) => api.post(`/users/${user.id}/reset-password`, body),
    onSuccess: () => { toast.success('Password reset!'); onClose(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center"><KeyRound size={16} className="text-amber-500" /></div>
          <div>
            <h2 className="font-bold text-gray-900">Reset Password</h2>
            <p className="text-xs text-gray-400">{user.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><X size={14} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); reset.mutate({ newPassword: (e.currentTarget as any).newPassword.value }); }} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">New Password</label>
            <div className="relative">
              <input name="newPassword" type={showPass ? 'text' : 'password'} required minLength={8}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white" />
              <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><EyeOff size={13} /></button>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={reset.isPending} className="flex-1 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-60">
              {reset.isPending ? 'Resetting…' : 'Reset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const can = useCan();
  const canCreate = can('users', 'create');
  const canEdit   = can('users', 'edit');
  const canDelete = me?.role === 'SUPER_ADMIN'; // server: users.delete AND SUPER_ADMIN
  // Only a SUPER_ADMIN may manage SUPER_ADMIN accounts (users.controller loadManageableUser).
  const canManage = (u: any) => canEdit && (u.role !== 'SUPER_ADMIN' || me?.role === 'SUPER_ADMIN');
  const [search, setSearch]       = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [modal, setModal]         = useState(false);
  const [editing, setEditing]     = useState<any>(null);
  const [resetUser, setResetUser] = useState<any>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search, filterRole],
    queryFn: () => api.get(`/users?search=${search}&role=${filterRole}`).then(r => r.data),
  });

  const { data: customRoles = [] } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/toggle-active`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Status updated'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Cannot delete user'),
  });

  const active   = users.filter((u: any) => u.isActive).length;
  const inactive = users.filter((u: any) => !u.isActive).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',   value: users.length, color: 'bg-blue-50 border-blue-100',    text: 'text-blue-600',   icon: Users },
          { label: 'Active',        value: active,       color: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', icon: CheckCircle },
          { label: 'Inactive',      value: inactive,     color: 'bg-rose-50 border-rose-100',    text: 'text-rose-600',   icon: XCircle },
          { label: 'Custom Roles',  value: customRoles.length, color: 'bg-violet-50 border-violet-100', text: 'text-violet-600', icon: Shield },
        ].map(({ label, value, color, text, icon: Icon }) => (
          <div key={label} className={`${color} border rounded-2xl p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center ${text} shadow-sm`}><Icon size={18} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs font-semibold text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
              className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 bg-white" />
          </div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white text-gray-600">
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/users/roles"
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors">
            <Shield size={14} /> Manage Roles
          </Link>
          {canCreate && <button onClick={() => { setEditing(null); setModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-400 text-white text-sm font-bold rounded-xl hover:bg-primary-500 transition-all shadow-sm shadow-primary-400/20">
            <Plus size={14} /> New User
          </button>}
        </div>
      </div>

      {/* Users grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
      ) : users.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">
          <Users size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No users found</p>
          {canCreate && <button onClick={() => setModal(true)} className="mt-3 text-primary-500 text-sm font-bold hover:underline">Create first user →</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((u: any) => (
            <div key={u.id} className={`bg-white border rounded-2xl p-5 transition-all hover:shadow-md ${u.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} />
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <RoleBadge role={u.role} customRole={u.customRole} />
                {u.department && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Building2 size={11} /> {u.department}
                  </div>
                )}
                {u.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Phone size={11} /> {u.phone}
                  </div>
                )}
                {u.lastLogin && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock size={11} /> Last login: {new Date(u.lastLogin).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Actions */}
              {(canManage(u) || (canDelete && u.id !== me?.id)) && (
              <div className="flex items-center gap-1.5 border-t border-gray-100 pt-3">
                {canManage(u) && (
                  <>
                    <button onClick={() => { setEditing(u); setModal(true); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => setResetUser(u)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                      <KeyRound size={12} /> Reset PW
                    </button>
                  </>
                )}
                {canManage(u) && u.id !== me?.id && (
                  <button onClick={() => toggleActive.mutate(u.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      u.isActive ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                    }`}>
                    {u.isActive ? <><ToggleLeft size={12} /> Disable</> : <><ToggleRight size={12} /> Enable</>}
                  </button>
                )}
                {canDelete && u.id !== me?.id && (
                  <button onClick={() => { if (confirm(`Delete ${u.name}? This cannot be undone.`)) del.mutate(u.id); }}
                    className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <UserModal open={modal} onClose={() => { setModal(false); setEditing(null); }} editing={editing} roles={customRoles} />
      )}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
    </div>
  );
}
