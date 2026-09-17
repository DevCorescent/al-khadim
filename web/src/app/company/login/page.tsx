'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useClientAuth } from '@/lib/clientAuth';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Building2 } from 'lucide-react';

export default function CompanyLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useClientAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter email and password'); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success('Welcome back!');
      router.replace('/company/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-5/12 bg-slate-900 flex-col justify-between p-14 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-400/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary-400/5 rounded-full blur-[80px]" />
        </div>
        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <div className="w-10 h-10 bg-primary-400 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">A</span>
          </div>
          <span className="text-white font-bold text-lg">Al Khadim</span>
        </Link>
        <div className="relative z-10">
          <p className="text-primary-400 text-xs font-bold tracking-widest uppercase mb-4">COMPANY PORTAL</p>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Review candidates<br />shared with<br />
            <span className="text-gray-400 font-normal">your company.</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            View profiles shared by Al Khadim, download resumes, and shortlist, reject, or request interviews — all in one place.
          </p>
        </div>
        <p className="relative z-10 text-gray-700 text-xs">© {new Date().getFullYear()} Al Khadim LLC · UAE</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-9 h-9 bg-primary-400 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-gray-900">Al Khadim</span>
          </Link>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-full px-3 py-1 mb-4">
              <Building2 size={12} className="text-primary-500" />
              <span className="text-xs font-semibold text-primary-600">Company Portal</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Sign in</h1>
            <p className="text-gray-400 text-sm">Access candidate profiles shared with you</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                  placeholder="you@company.com" className="input pl-10" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••" className="input pl-10 pr-11" />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full btn-primary justify-center py-3.5 rounded-xl text-sm disabled:opacity-60">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Signing in…</>
                : <>Sign In <ArrowRight size={15} /></>
              }
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-8">
            New company? <Link href="/company/register" className="text-primary-500 font-semibold hover:underline">Create a business profile</Link>
          </p>
          <p className="text-center mt-2">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← Back to website</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
