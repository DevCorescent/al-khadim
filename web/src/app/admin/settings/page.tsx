'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Building2, DollarSign, Globe, Save } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { GeneralSettings } from '@/lib/useSettings';

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECRUITER', 'HR', 'ACCOUNTANT', 'VIEWER'];
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700',
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  RECRUITER: 'bg-green-100 text-green-700',
  HR: 'bg-yellow-100 text-yellow-700',
  ACCOUNTANT: 'bg-orange-100 text-orange-700',
  VIEWER: 'bg-gray-100 text-gray-600',
};

const CURRENCIES = [
  { code:'AED', symbol:'د.إ', name:'UAE Dirham' },
  { code:'USD', symbol:'$',   name:'US Dollar' },
  { code:'EUR', symbol:'€',   name:'Euro' },
  { code:'GBP', symbol:'£',   name:'British Pound' },
  { code:'SAR', symbol:'ر.س', name:'Saudi Riyal' },
  { code:'QAR', symbol:'ر.ق', name:'Qatari Riyal' },
  { code:'KWD', symbol:'د.ك', name:'Kuwaiti Dinar' },
  { code:'BHD', symbol:'.د.ب',name:'Bahraini Dinar' },
  { code:'OMR', symbol:'ر.ع.',name:'Omani Rial' },
  { code:'INR', symbol:'₹',   name:'Indian Rupee' },
  { code:'PKR', symbol:'₨',   name:'Pakistani Rupee' },
  { code:'SGD', symbol:'S$',  name:'Singapore Dollar' },
  { code:'MYR', symbol:'RM',  name:'Malaysian Ringgit' },
  { code:'CAD', symbol:'C$',  name:'Canadian Dollar' },
  { code:'AUD', symbol:'A$',  name:'Australian Dollar' },
  { code:'CHF', symbol:'Fr',  name:'Swiss Franc' },
  { code:'JPY', symbol:'¥',   name:'Japanese Yen' },
  { code:'CNY', symbol:'¥',   name:'Chinese Yuan' },
  { code:'ZAR', symbol:'R',   name:'South African Rand' },
  { code:'NGN', symbol:'₦',   name:'Nigerian Naira' },
  { code:'EGP', symbol:'E£',  name:'Egyptian Pound' },
  { code:'TRY', symbol:'₺',   name:'Turkish Lira' },
  { code:'BRL', symbol:'R$',  name:'Brazilian Real' },
  { code:'MXN', symbol:'$',   name:'Mexican Peso' },
  { code:'KES', symbol:'KSh', name:'Kenyan Shilling' },
  { code:'IDR', symbol:'Rp',  name:'Indonesian Rupiah' },
  { code:'THB', symbol:'฿',   name:'Thai Baht' },
  { code:'PHP', symbol:'₱',   name:'Philippine Peso' },
];

const DATE_FORMATS = ['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD','DD MMM YYYY'];

const TIMEZONES = [
  'Asia/Dubai','Asia/Riyadh','Asia/Kuwait','Asia/Bahrain','Asia/Muscat',
  'Asia/Kolkata','Asia/Karachi','Asia/Dhaka','Asia/Colombo','Asia/Kathmandu',
  'Asia/Singapore','Asia/Kuala_Lumpur','Asia/Jakarta','Asia/Manila',
  'Asia/Shanghai','Asia/Tokyo','Asia/Seoul',
  'Europe/London','Europe/Paris','Europe/Berlin','Europe/Amsterdam',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Toronto','America/Sao_Paulo','Africa/Nairobi','Africa/Lagos',
  'Africa/Cairo','Australia/Sydney','Pacific/Auckland',
];

const MONTHS = [
  {v:'01',l:'January'},{v:'02',l:'February'},{v:'03',l:'March'},{v:'04',l:'April'},
  {v:'05',l:'May'},{v:'06',l:'June'},{v:'07',l:'July'},{v:'08',l:'August'},
  {v:'09',l:'September'},{v:'10',l:'October'},{v:'11',l:'November'},{v:'12',l:'December'},
];

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role', render: (v: string) => <span className={`badge ${ROLE_COLORS[v]}`}>{v}</span> },
  { key: 'phone', label: 'Phone' },
  { key: 'isActive', label: 'Status', render: (v: boolean) => <span className={`badge ${v ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{v ? 'Active' : 'Inactive'}</span> },
  { key: 'lastLogin', label: 'Last Login', render: (v: string) => v ? new Date(v).toLocaleDateString() : 'Never' },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [pwModal, setPwModal] = useState(false);

  // General settings state
  const { data: generalData } = useQuery<GeneralSettings>({
    queryKey: ['site-config-general'],
    queryFn: () => api.get('/site-config/general').then(r => r.data),
  });
  const [general, setGeneral] = useState<Partial<GeneralSettings>>({});
  // Sync fetched data into local state once
  const effectiveGeneral: GeneralSettings = {
    companyName:'Al Khadim LLC', companyEmail:'', companyPhone:'', companyAddress:'',
    currency:'AED', currencySymbol:'د.إ', dateFormat:'DD/MM/YYYY',
    timezone:'Asia/Dubai', fiscalYearStart:'01', language:'en',
    ...generalData, ...general,
  };

  const saveGeneral = useMutation({
    mutationFn: (d: Partial<GeneralSettings>) => api.put('/site-config/general', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-config-general'] });
      toast.success('Settings saved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Save failed'),
  });

  function handleGeneralChange(field: keyof GeneralSettings, value: string) {
    const updated: Partial<GeneralSettings> = { ...general, [field]: value };
    // Auto-fill symbol when currency changes
    if (field === 'currency') {
      const cur = CURRENCIES.find(c => c.code === value);
      if (cur) updated.currencySymbol = cur.symbol;
    }
    setGeneral(updated);
  }

  function submitGeneral(e: React.FormEvent) {
    e.preventDefault();
    saveGeneral.mutate(effectiveGeneral);
  }

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/users/${editing.id}`, d) : api.post('/users', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Saved'); setModal(false); setEditing(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete user'),
  });

  const changePw = useMutation({
    mutationFn: (d: any) => api.put('/auth/change-password', d),
    onSuccess: () => { toast.success('Password changed'); setPwModal(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form.entries());
    save.mutate({ ...data, isActive: data.isActive === 'true' });
  };

  const handlePwSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    changePw.mutate(Object.fromEntries(form.entries()));
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">My Profile</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-primary-400 rounded-full flex items-center justify-center text-white font-bold text-2xl">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{user?.name}</p>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <span className={`badge mt-1 ${ROLE_COLORS[user?.role || ''] || 'bg-gray-100 text-gray-600'}`}>{user?.role}</span>
          </div>
        </div>
        <button onClick={() => setPwModal(true)} className="btn-outline text-sm py-2 px-4">Change Password</button>
      </div>

      {/* ── General Settings ── */}
      <form onSubmit={submitGeneral} className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-primary-500"/>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">General Settings</h3>
              <p className="text-xs text-gray-400">Company info, currency & regional preferences</p>
            </div>
          </div>
          <button type="submit" disabled={saveGeneral.isPending}
            className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-60 transition-colors">
            <Save size={14}/>{saveGeneral.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>

        {/* Company Info */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={13} className="text-gray-400"/>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Company Information</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Company Name</label>
              <input value={effectiveGeneral.companyName}
                onChange={e => handleGeneralChange('companyName', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"
                placeholder="Al Khadim LLC"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Company Email</label>
              <input type="email" value={effectiveGeneral.companyEmail}
                onChange={e => handleGeneralChange('companyEmail', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"
                placeholder="info@company.com"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Phone Number</label>
              <input value={effectiveGeneral.companyPhone}
                onChange={e => handleGeneralChange('companyPhone', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"
                placeholder="+971 4 XXX XXXX"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Address</label>
              <input value={effectiveGeneral.companyAddress}
                onChange={e => handleGeneralChange('companyAddress', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30"
                placeholder="Dubai, United Arab Emirates"/>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100"/>

        {/* Currency & Finance */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={13} className="text-gray-400"/>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Currency & Finance</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Dashboard Currency</label>
              <select value={effectiveGeneral.currency}
                onChange={e => handleGeneralChange('currency', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Used in financial KPIs, reports, and dashboard widgets</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Currency Symbol</label>
              <div className="flex items-center gap-2">
                <input value={effectiveGeneral.currencySymbol}
                  onChange={e => handleGeneralChange('currencySymbol', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 font-mono"
                  placeholder="د.إ"/>
                <div className="flex-shrink-0 px-3 py-2.5 bg-primary-50 border border-primary-200 rounded-xl text-sm font-bold text-primary-600">
                  Preview: {effectiveGeneral.currencySymbol} 1,234.00
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Fiscal Year Start</label>
              <select value={effectiveGeneral.fiscalYearStart}
                onChange={e => handleGeneralChange('fiscalYearStart', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100"/>

        {/* Regional */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe size={13} className="text-gray-400"/>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Regional Preferences</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Date Format</label>
              <select value={effectiveGeneral.dateFormat}
                onChange={e => handleGeneralChange('dateFormat', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                {DATE_FORMATS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Timezone</label>
              <select value={effectiveGeneral.timezone}
                onChange={e => handleGeneralChange('timezone', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Current config preview */}
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 flex items-center gap-6 flex-wrap">
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Currency</p>
            <p className="text-lg font-black text-gray-800">{effectiveGeneral.currency}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Symbol</p>
            <p className="text-lg font-black text-gray-800">{effectiveGeneral.currencySymbol}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Date Format</p>
            <p className="text-lg font-black text-gray-800">{effectiveGeneral.dateFormat}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Timezone</p>
            <p className="text-sm font-bold text-gray-800">{effectiveGeneral.timezone}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Sample Amount</p>
            <p className="text-lg font-black text-primary-600">{effectiveGeneral.currency} 12,500.00</p>
          </div>
        </div>
      </form>

      {/* User Management */}
      <DataTable
        title={`User Management (${users?.length || 0})`}
        columns={columns}
        data={users || []}
        isLoading={isLoading}
        onAdd={() => { setEditing(null); setModal(true); }}
        addLabel="Add User"
        actions={(row) => row.id !== user?.id ? (
          <div className="flex gap-1.5">
            <button onClick={() => { setEditing(row); setModal(true); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={14} /></button>
            <button onClick={() => { if (confirm('Delete user?')) del.mutate(row.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
          </div>
        ) : <span className="text-xs text-gray-400">You</span>}
      />

      {/* Add/Edit User Modal */}
      <Modal isOpen={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input name="name" required defaultValue={editing?.name} className="input" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input name="email" type="email" required defaultValue={editing?.email} disabled={!!editing} className="input" />
          </div>
          {!editing && (
            <div>
              <label className="label">Password *</label>
              <input name="password" type="password" required minLength={8} className="input" placeholder="Min. 8 characters" />
            </div>
          )}
          <div>
            <label className="label">Role *</label>
            <select name="role" required defaultValue={editing?.role || 'VIEWER'} className="input">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" defaultValue={editing?.phone} className="input" />
          </div>
          {editing && (
            <div>
              <label className="label">Status</label>
              <select name="isActive" defaultValue={String(editing?.isActive)} className="input">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary text-sm py-2">Save</button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={pwModal} onClose={() => setPwModal(false)} title="Change Password" size="sm">
        <form onSubmit={handlePwSubmit} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input name="currentPassword" type="password" required className="input" />
          </div>
          <div>
            <label className="label">New Password</label>
            <input name="newPassword" type="password" required minLength={8} className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setPwModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={changePw.isPending} className="btn-primary text-sm py-2">Update</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
