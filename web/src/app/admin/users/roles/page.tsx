'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { MODULES as MODULE_ACTIONS, ROLE_PRESETS } from '@/lib/permissionMatrix';
import { useAuth } from '@/lib/auth';
import {
  ArrowLeft, Plus, Pencil, Trash2, Shield, ShieldCheck, ShieldAlert,
  Eye, Users, Briefcase, Building2, FileText, DollarSign,
  BarChart3, Settings, UserCheck, Calendar, ClipboardList,
  X, Loader2, Check, Palette, ChevronDown, ChevronUp, Landmark, Mail,
  type LucideIcon,
} from 'lucide-react';

/* ── Permission matrix: the same data the server enforces (src/lib/permissionMatrix.ts) ── */
const MODULE_META: Record<string, { label: string; icon: LucideIcon }> = {
  dashboard:   { label: 'Dashboard',       icon: BarChart3 },
  candidates:  { label: 'Candidates',      icon: Users },
  jobs:        { label: 'Job Orders',      icon: Briefcase },
  clients:     { label: 'Clients / CRM',   icon: Building2 },
  interviews:  { label: 'Interviews',      icon: Calendar },
  employees:   { label: 'Employees',       icon: UserCheck },
  attendance:  { label: 'Attendance',      icon: ClipboardList },
  leave:       { label: 'Leave',           icon: Calendar },
  payroll:     { label: 'Payroll',         icon: DollarSign },
  documents:   { label: 'Documents',       icon: FileText },
  enquiries:   { label: 'Enquiries',       icon: ClipboardList },
  invoices:    { label: 'Invoices',        icon: DollarSign },
  finance:     { label: 'Finance',         icon: Landmark },
  emails:      { label: 'Emails',          icon: Mail },
  reports:     { label: 'Reports',         icon: BarChart3 },
  site_editor: { label: 'Site Editor',     icon: Palette },
  users:       { label: 'User Management', icon: ShieldCheck },
  settings:    { label: 'Settings',        icon: Settings },
};

const MODULES = Object.entries(MODULE_ACTIONS).map(([key, actions]) => ({
  key,
  actions,
  label: MODULE_META[key]?.label || key,
  icon: MODULE_META[key]?.icon || Shield,
}));

const ACTION_LABELS: Record<string, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
  export: 'Export', approve: 'Approve', reject: 'Reject',
  upload: 'Upload', make_public: 'Make Public', send: 'Send',
};

const COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6',
  '#14b8a6','#f97316','#ef4444','#84cc16','#06b6d4','#a855f7',
];

/* ── Permission checkbox grid ── */
function PermissionGrid({ perms, onChange }: {
  perms: Record<string, string[]>;
  onChange: (p: Record<string, string[]>) => void;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);

  function toggle(module: string, action: string) {
    const curr = perms[module] || [];
    const next  = curr.includes(action) ? curr.filter(a => a !== action) : [...curr, action];
    onChange({ ...perms, [module]: next });
  }

  function toggleAll(module: string, actions: string[]) {
    const curr = perms[module] || [];
    const allHave = actions.every(a => curr.includes(a));
    onChange({ ...perms, [module]: allHave ? [] : [...actions] });
  }

  function applyPreset(preset: string) {
    onChange(ROLE_PRESETS[preset] || {});
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className="text-xs font-bold text-gray-400 self-center mr-1">Quick set:</span>
        {Object.keys(ROLE_PRESETS).map(r => (
          <button key={r} type="button" onClick={() => applyPreset(r)}
            className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-primary-100 hover:text-primary-700 transition-colors">
            {r}
          </button>
        ))}
        <button type="button" onClick={() => onChange({})}
          className="text-xs font-semibold px-2.5 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors ml-1">
          Clear all
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {MODULES.map(({ key, label, icon: Icon, actions }) => {
          const granted = perms[key] || [];
          const allGranted = actions.every(a => granted.includes(a));
          const someGranted = granted.length > 0;
          const isCollapsed = collapsed.includes(key);

          return (
            <div key={key} className={`border rounded-xl overflow-hidden transition-all ${someGranted ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <input type="checkbox" checked={allGranted} ref={el => { if (el) el.indeterminate = someGranted && !allGranted; }}
                  onChange={() => toggleAll(key, actions)}
                  className="w-4 h-4 rounded accent-primary-400 cursor-pointer" />
                <Icon size={13} className={someGranted ? 'text-primary-500' : 'text-gray-400'} />
                <span className={`text-sm font-bold flex-1 ${someGranted ? 'text-gray-800' : 'text-gray-500'}`}>{label}</span>
                {someGranted && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-md">{granted.length}/{actions.length}</span>
                )}
                <button type="button" onClick={() => setCollapsed(c => c.includes(key) ? c.filter(k => k !== key) : [...c, key])}
                  className="text-gray-400 hover:text-gray-600">
                  {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                </button>
              </div>
              {!isCollapsed && (
                <div className="flex flex-wrap gap-1.5 px-9 pb-2.5">
                  {actions.map(action => (
                    <button key={action} type="button" onClick={() => toggle(key, action)}
                      className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                        granted.includes(action)
                          ? 'bg-primary-400 text-white border-primary-400'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}>
                      {granted.includes(action) && <Check size={9} />}
                      {ACTION_LABELS[action] || action}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Role Form ── */
function RoleForm({ editing, onClose }: { editing: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName]       = useState(editing?.name        || '');
  const [desc, setDesc]       = useState(editing?.description || '');
  const [color, setColor]     = useState(editing?.color       || '#6366f1');
  const [perms, setPerms]     = useState<Record<string,string[]>>(editing?.permissions || {});

  const save = useMutation({
    mutationFn: (body: any) => editing
      ? api.put(`/roles/${editing.id}`, body)
      : api.post('/roles', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success(editing ? 'Role updated!' : 'Role created!');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + '20', border: `1px solid ${color}40` }}>
              <Shield size={14} style={{ color }} />
            </div>
            <h2 className="font-bold text-gray-900">{editing ? 'Edit Role' : 'Create Custom Role'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Name + Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Role Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Senior Recruiter" required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 bg-white" />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Badge Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ background: c, borderColor: color === c ? c : 'transparent', boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }} />
              ))}
              <div className="flex items-center gap-2 ml-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-gray-200 p-0.5 cursor-pointer" />
                <span className="text-xs font-mono text-gray-400">{color}</span>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Permissions</label>
            <PermissionGrid perms={perms} onChange={setPerms} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          <p className="text-xs text-gray-400">
            {Object.values(perms).flat().length} permission{Object.values(perms).flat().length !== 1 ? 's' : ''} granted
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-white transition-colors">Cancel</button>
            <button onClick={() => save.mutate({ name, description: desc, color, permissions: perms })}
              disabled={!name || save.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary-400 text-white rounded-xl text-sm font-bold hover:bg-primary-500 transition-all disabled:opacity-60">
              {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {editing ? 'Save Changes' : 'Create Role'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Built-in role viewer ── */
const BUILTIN_ROLES = [
  { role: 'SUPER_ADMIN', label: 'Super Admin',  color: '#7c3aed', description: 'Full unrestricted access to everything', icon: ShieldAlert },
  { role: 'ADMIN',       label: 'Admin',        color: '#2563eb', description: 'Everything except deleting users', icon: ShieldCheck },
  { role: 'MANAGER',     label: 'Manager',      color: '#4f46e5', description: 'CRM, recruitment, interviews, leave approvals, reports', icon: Shield },
  { role: 'RECRUITER',   label: 'Recruiter',    color: '#059669', description: 'Candidates, jobs, interviews', icon: Users },
  { role: 'HR',          label: 'HR',           color: '#0d9488', description: 'Employees, attendance, leave, payroll view', icon: UserCheck },
  { role: 'ACCOUNTANT',  label: 'Accountant',   color: '#d97706', description: 'Payroll, invoices, finance, reports', icon: DollarSign },
  { role: 'VIEWER',      label: 'Viewer',       color: '#6b7280', description: 'Read-only access to dashboard and listings', icon: Eye },
];

export default function RolesPage() {
  const qc = useQueryClient();
  // Creating, editing and deleting custom roles is SUPER_ADMIN-only on the server.
  const canManage = useAuth(s => s.user?.role === 'SUPER_ADMIN');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [viewing, setViewing]   = useState<string | null>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-roles'] }); toast.success('Role deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/users" className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 border border-gray-200 transition-colors">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Roles & Permissions</h1>
            <p className="text-xs text-gray-400">Define what each role can access</p>
          </div>
        </div>
        {canManage && <button onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-400 text-white text-sm font-bold rounded-xl hover:bg-primary-500 transition-all shadow-sm shadow-primary-400/20">
          <Plus size={14} /> New Custom Role
        </button>}
      </div>

      {/* Built-in roles */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">System Roles (built-in)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {BUILTIN_ROLES.map(({ role, label, color, description, icon: Icon }) => (
            <div key={role}
              onClick={() => setViewing(viewing === role ? null : role)}
              className="bg-white border border-gray-200 rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '15', border: `1px solid ${color}30` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{label}</p>
                  <p className="text-[10px] font-mono text-gray-400">{role}</p>
                </div>
                <div className="ml-auto w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center">
                  {viewing === role ? <ChevronUp size={11} className="text-gray-400" /> : <ChevronDown size={11} className="text-gray-400" />}
                </div>
              </div>
              <p className="text-xs text-gray-500">{description}</p>

              {viewing === role && ROLE_PRESETS[role] && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  {MODULES.filter(m => ROLE_PRESETS[role]?.[m.key]?.length).map(m => (
                    <div key={m.key} className="flex items-start gap-2">
                      <m.icon size={11} className="text-gray-400 mt-0.5 shrink-0" />
                      <span className="text-[10px] font-semibold text-gray-500 w-20 shrink-0">{m.label}</span>
                      <div className="flex flex-wrap gap-1">
                        {ROLE_PRESETS[role][m.key].map(a => (
                          <span key={a} className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: color + '15', color }}>
                            {ACTION_LABELS[a] || a}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Custom roles */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Custom Roles</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-primary-400" /></div>
        ) : roles.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-12 text-center">
            <Shield size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold text-sm">No custom roles yet</p>
            <p className="text-gray-400 text-xs mt-1 mb-4">Create roles with fine-grained permission control</p>
            {canManage && <button onClick={() => setFormOpen(true)} className="text-primary-500 text-sm font-bold hover:underline">+ Create first custom role</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {roles.map((r: any) => {
              const grantCount = Object.values(r.permissions as Record<string,string[]>).flat().length;
              return (
                <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: r.color + '20', border: `1px solid ${r.color}40` }}>
                        <Shield size={16} style={{ color: r.color }} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{r.name}</p>
                        <p className="text-[10px] text-gray-400">{r.description || 'Custom role'}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: r.color + '15', color: r.color }}>
                      Custom
                    </span>
                  </div>

                  {/* Permission summary */}
                  <div className="flex flex-wrap gap-1 mb-4 min-h-[28px]">
                    {Object.entries(r.permissions as Record<string,string[]>).filter(([,v]) => v.length > 0).slice(0,5).map(([mod, acts]) => (
                      <span key={mod} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {MODULES.find(m => m.key === mod)?.label || mod}: {(acts as string[]).length}
                      </span>
                    ))}
                    {Object.keys(r.permissions).filter(k => (r.permissions[k] as string[]).length > 0).length > 5 && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">+more</span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mb-3">{grantCount} permission{grantCount !== 1 ? 's' : ''} granted</p>

                  {canManage && <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                    <button onClick={() => { setEditing(r); setFormOpen(true); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                      <Pencil size={11} /> Edit
                    </button>
                    <button onClick={() => { if (confirm(`Delete role "${r.name}"?`)) del.mutate(r.id); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {formOpen && (
        <RoleForm editing={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
      )}
    </div>
  );
}
