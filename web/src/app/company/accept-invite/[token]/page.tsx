'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useClientAuth } from '@/lib/clientAuth';
import { Lock, ArrowRight, Building2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { setTokens } = useClientAuth();

  const [invite, setInvite] = useState<{ name: string; email: string; companyName: string } | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/client-auth/accept-invite/${token}`)
      .then(r => setInvite(r.data))
      .catch(e => setError(e.response?.data?.error || 'This invite link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/api/client-auth/accept-invite/${token}`, { password });
      setTokens(data.accessToken, data.refreshToken, data.clientUser);
      toast.success('Welcome! Your account is ready.');
      router.replace('/company/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to set password');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 mb-2">Invite link invalid</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-8">
        <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-full px-3 py-1 mb-4">
          <Building2 size={12} className="text-primary-500" />
          <span className="text-xs font-semibold text-primary-600">Company Portal</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome, {invite?.name}</h1>
        <p className="text-sm text-gray-500 mb-6">Set a password to join <strong>{invite?.companyName}</strong>'s portal on Al Khadim.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="At least 8 characters" className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                placeholder="Re-enter password" className="input pl-10" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full btn-primary justify-center py-3 rounded-xl text-sm disabled:opacity-60">
            {submitting ? 'Setting up…' : <>Get Started <ArrowRight size={15} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
